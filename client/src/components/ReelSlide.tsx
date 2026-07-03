import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Play, Pause, Volume2, VolumeX, Zap, Flame, Gavel, ExternalLink } from "lucide-react";
import { api, centsToDisplay, ApiError } from "../lib/api";
import { avatarGradient } from "../lib/avatar";
import type { SampleSummary } from "../lib/types";
import { Waveform } from "./Waveform";
import { CountdownBadge } from "./CountdownBadge";
import { VerifiedBadge } from "./VerifiedBadge";
import { Avatar } from "./Avatar";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";

interface Props {
  sample: SampleSummary;
  active: boolean;
  soundOn: boolean;
  onToggleSound: () => void;
}

export function ReelSlide({ sample, active, soundOn, onToggleSound }: Props) {
  const { user } = useAuth();
  const { push } = useToast();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const watermarkTimer = useRef<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [customOpen, setCustomOpen] = useState(false);
  const [customAmount, setCustomAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const isSeller = sample.seller?.id === user?.id;
  const ended = sample.status === "ended";
  const minNext = (sample.bidCount ?? 0) > 0
    ? sample.currentPriceCents + sample.minIncrementCents
    : sample.startingPriceCents;

  useEffect(() => {
    return () => {
      if (watermarkTimer.current) window.clearInterval(watermarkTimer.current);
      ctxRef.current?.close().catch(() => {});
    };
  }, []);

  // Primary playback stays on the plain <audio> element — muting/unmuting it directly
  // is always reliable. The watermark tone below is a fully separate audio graph (its
  // own AudioContext + oscillator, connected straight to speakers) so it can never
  // interfere with — or silently break — the actual sample playback.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || ended) return;
    audio.muted = !soundOn;
    if (active) {
      audio.currentTime = 0;
      audio.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
    } else {
      audio.pause();
      setPlaying(false);
      stopWatermark();
    }
  }, [active, ended]);

  useEffect(() => {
    const audio = audioRef.current;
    if (audio) audio.muted = !soundOn;
    if (soundOn && active && playing) {
      startWatermark();
    } else {
      stopWatermark();
    }
  }, [soundOn, active, playing]);

  function ensureWatermarkContext(): AudioContext {
    if (!ctxRef.current) ctxRef.current = new AudioContext();
    ctxRef.current.resume().catch(() => {});
    return ctxRef.current;
  }

  function scheduleBlip(ctx: AudioContext) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 1760;
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.035, ctx.currentTime + 0.02);
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.18);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.2);
  }

  function startWatermark() {
    if (watermarkTimer.current) return;
    const ctx = ensureWatermarkContext();
    scheduleBlip(ctx);
    watermarkTimer.current = window.setInterval(() => scheduleBlip(ensureWatermarkContext()), 4000);
  }

  function stopWatermark() {
    if (watermarkTimer.current) {
      window.clearInterval(watermarkTimer.current);
      watermarkTimer.current = null;
    }
  }

  function togglePlay() {
    const audio = audioRef.current;
    if (!audio || ended) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      audio.play().then(() => setPlaying(true)).catch(() => {});
    }
  }

  // Unmuting/playback-context-unlocking has to happen synchronously inside the
  // click handler itself (not a later effect) for browsers with strict autoplay
  // gesture requirements — this is called directly from both the speaker icon and
  // a tap anywhere on the slide, since relying on a small icon alone is easy to miss.
  function handleToggleSound() {
    const audio = audioRef.current;
    const turningOn = !soundOn;
    if (audio) {
      audio.muted = !turningOn;
      if (turningOn && active) audio.play().catch(() => {});
    }
    if (turningOn) ensureWatermarkContext();
    onToggleSound();
  }

  function handlePrimaryTap() {
    if (!soundOn) {
      handleToggleSound();
      return;
    }
    togglePlay();
  }

  function handleTimeUpdate() {
    const audio = audioRef.current;
    if (!audio || !audio.duration) return;
    setProgress(audio.currentTime / audio.duration);
  }

  async function submitBid(amountCents: number) {
    if (!user) {
      push({ title: "Log in to bid", tone: "info" });
      return;
    }
    setSubmitting(true);
    try {
      await api.post(`/samples/${sample.id}/bids`, { amountCents });
      push({ title: `Bid placed — ${centsToDisplay(amountCents)}`, tone: "success" });
      setCustomOpen(false);
      setCustomAmount("");
    } catch (err) {
      push({ title: err instanceof ApiError ? err.message : "Failed to place bid", tone: "warning" });
    } finally {
      setSubmitting(false);
    }
  }

  const bg = sample.seller ? avatarGradient(sample.seller.avatarSeed) : avatarGradient(sample.id);

  return (
    <div className="relative flex h-full w-full shrink-0 snap-start snap-always flex-col items-center overflow-hidden bg-background">
      {sample.imageUrl ? (
        <>
          <img
            src={sample.imageUrl}
            alt=""
            className="pointer-events-none absolute inset-0 h-full w-full object-cover"
            draggable={false}
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/90 via-black/25 to-black/60" />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-transparent" />
        </>
      ) : (
        <>
          <div className="pointer-events-none absolute inset-0 opacity-25 blur-3xl" style={{ background: bg }} />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background via-background/40 to-background/70" />
        </>
      )}

      {!ended && (
        <audio ref={audioRef} src={`/api/samples/${sample.id}/preview`} loop onTimeUpdate={handleTimeUpdate} />
      )}

      <button
        onClick={handleToggleSound}
        className="absolute right-4 top-4 z-20 flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface/70 backdrop-blur transition hover:bg-surface-2 2xl:h-12 2xl:w-12"
        aria-label={soundOn ? "Mute" : "Tap for sound"}
      >
        <span className="2xl:hidden">{soundOn ? <Volume2 size={15} /> : <VolumeX size={15} />}</span>
        <span className="hidden 2xl:block">{soundOn ? <Volume2 size={20} /> : <VolumeX size={20} />}</span>
      </button>

      {/* flex-1 + justify-center keeps the play circle vertically centered in
          whatever space the info bar leaves, so it can never be pushed past the
          slide's top edge and clipped on short windows. pt-14 clears the
          absolute genre-filter pills. */}
      {/* translate-y nudges the whole block down without changing layout math,
          keeping the play circle clear of the genre filter bar above. */}
      <div className="relative z-10 flex min-h-0 w-full max-w-2xl flex-1 translate-y-6 flex-col items-center justify-center px-6 pt-28 2xl:max-w-3xl">
        <button onClick={handlePrimaryTap} className="flex w-full flex-col items-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full border border-white/30 bg-white/25 text-white shadow-[0_4px_30px_rgba(0,0,0,0.3)] backdrop-blur-md transition group-hover:scale-105 lg:h-24 lg:w-24 2xl:h-28 2xl:w-28">
            {ended ? null : !soundOn ? (
              <>
                <VolumeX size={26} className="lg:hidden" />
                <VolumeX size={34} className="hidden lg:block" />
              </>
            ) : playing ? (
              <>
                <Pause size={28} className="lg:hidden" />
                <Pause size={36} className="hidden lg:block" />
              </>
            ) : (
              <>
                <Play size={28} className="ml-1 lg:hidden" />
                <Play size={36} className="ml-1.5 hidden lg:block" />
              </>
            )}
          </div>
          {!ended && !soundOn && (
            <p className="mt-3 animate-pulse text-base font-semibold text-white lg:text-lg 2xl:text-xl">Tap for sound</p>
          )}
          <div className="mt-8 h-24 w-full max-w-xl lg:h-28 lg:max-w-2xl 2xl:h-32 2xl:max-w-3xl">
            <Waveform data={sample.waveform} progress={ended ? 1 : progress} />
          </div>
        </button>

        <Link
          to={`/sample/${sample.id}`}
          onClick={(e) => e.stopPropagation()}
          className="mt-6 inline-flex items-center gap-1.5 rounded-full border border-border bg-surface/80 px-5 py-2 text-sm font-semibold backdrop-blur transition hover:border-primary/50 hover:bg-surface-2 lg:px-6 lg:py-2.5 lg:text-base 2xl:px-7 2xl:py-3 2xl:text-lg"
        >
          Full auction page <ExternalLink size={14} />
        </Link>

        <div className="mt-3">
          <CountdownBadge endTime={sample.endTime} ended={ended} size="lg" />
        </div>
      </div>

      {ended && (
        <div className="absolute left-1/2 top-1/3 z-20 -translate-x-1/2 -translate-y-1/2 rotate-[-8deg] rounded-lg border-2 border-live px-4 py-1 text-lg font-black uppercase tracking-widest text-live">
          Sold
        </div>
      )}

      <div className="relative z-20 flex w-full shrink-0 flex-col gap-3 p-5 lg:gap-4 lg:p-8 2xl:p-12">
        <div className="flex items-end justify-between gap-4 lg:gap-8">
        <div className="min-w-0 max-w-[65%] lg:max-w-[70%]">
          <div className="min-w-0">
            <h2 className="truncate text-2xl font-bold lg:text-4xl 2xl:text-5xl">{sample.title}</h2>
            <p className="mt-1 text-sm text-muted lg:mt-2 lg:text-lg 2xl:text-xl">
              {sample.genre} · {sample.bpm} BPM · {sample.key}
            </p>
          </div>
          {sample.seller && (
            <Link to={`/u/${sample.seller.username}`} className="mt-3 flex items-center gap-2 lg:mt-4 lg:gap-3 2xl:gap-4">
              <span className="lg:hidden">
                <Avatar seed={sample.seller.avatarSeed} username={sample.seller.username} size={28} />
              </span>
              <span className="hidden lg:block 2xl:hidden">
                <Avatar seed={sample.seller.avatarSeed} username={sample.seller.username} size={36} />
              </span>
              <span className="hidden 2xl:block">
                <Avatar seed={sample.seller.avatarSeed} username={sample.seller.username} size={46} />
              </span>
              <span className="flex items-center gap-1 text-sm font-medium lg:text-lg 2xl:text-xl">
                {sample.seller.username}
                {sample.seller.verified && <VerifiedBadge size={13} />}
              </span>
            </Link>
          )}
        </div>

        <div className="flex flex-col items-center gap-3 lg:gap-4">
          <div className="text-center">
            <p className="text-xs font-bold uppercase tracking-widest text-primary-glow lg:text-sm 2xl:text-base">
              {ended ? "Sold for" : "Current bid"}
            </p>
            <p className="text-xl font-bold lg:text-3xl 2xl:text-5xl">{centsToDisplay(sample.currentPriceCents)}</p>
          </div>

          {!ended && !isSeller && (
            <>
              <button
                onClick={() => submitBid(minNext)}
                disabled={submitting}
                className="shimmer-bg flex flex-col items-center gap-0.5 rounded-full px-4 py-2.5 text-xs font-semibold text-white shadow-lg transition hover:scale-105 disabled:opacity-50 lg:px-6 lg:py-3.5 lg:text-base 2xl:px-8 2xl:py-4 2xl:text-lg"
              >
                <Gavel size={16} />
                Bid {centsToDisplay(minNext)}
              </button>

              <button
                onClick={() => setCustomOpen((v) => !v)}
                className="text-[11px] text-muted hover:text-foreground lg:text-sm 2xl:text-base"
              >
                {customOpen ? "Cancel" : "Custom amount"}
              </button>

              {customOpen && (
                <div className="flex w-40 flex-col gap-1.5 rounded-xl border border-border bg-surface p-2 lg:w-52 lg:gap-2 lg:p-3 2xl:w-64 2xl:p-4">
                  <input
                    type="number"
                    step="0.5"
                    min={minNext / 100}
                    value={customAmount}
                    onChange={(e) => setCustomAmount(e.target.value)}
                    placeholder={`Min ${centsToDisplay(minNext)}`}
                    className="w-full rounded-md border border-border bg-surface-2 px-2 py-1.5 text-xs outline-none focus:border-primary lg:px-3 lg:py-2 lg:text-sm 2xl:text-base"
                  />
                  <button
                    onClick={() => {
                      const cents = Math.round(parseFloat(customAmount) * 100);
                      if (cents) submitBid(cents);
                    }}
                    disabled={submitting}
                    className="rounded-md bg-primary px-2 py-1.5 text-xs font-semibold text-background disabled:opacity-50 lg:px-3 lg:py-2 lg:text-sm 2xl:text-base"
                  >
                    Confirm
                  </button>
                </div>
              )}

              {sample.buyNowPriceCents && (
                <button
                  onClick={() => submitBid(sample.buyNowPriceCents!)}
                  disabled={submitting}
                  className="flex items-center gap-1 rounded-full bg-accent/15 px-3 py-1.5 text-[11px] font-semibold text-accent transition hover:bg-accent/25 disabled:opacity-50 lg:px-4 lg:py-2 lg:text-sm 2xl:px-5 2xl:py-2.5 2xl:text-base"
                >
                  <Flame size={12} />
                  Buy it now {centsToDisplay(sample.buyNowPriceCents)}
                </button>
              )}
            </>
          )}

          {!ended && isSeller && <p className="max-w-[7rem] text-center text-[11px] text-muted-2 lg:max-w-none lg:text-sm">Your listing</p>}

          {ended && sample.winner && sample.certificateCode && user && sample.winner.id === user.id && (
            <Link
              to={`/certificate/${sample.certificateCode}`}
              className="flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 text-[11px] font-semibold text-primary transition hover:bg-primary/20 lg:px-4 lg:py-2 lg:text-sm"
            >
              <Zap size={12} /> Certificate
            </Link>
          )}
        </div>
        </div>
      </div>
    </div>
  );
}
