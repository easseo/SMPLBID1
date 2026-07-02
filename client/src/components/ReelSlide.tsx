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
    <div className="relative flex h-full w-full shrink-0 snap-start snap-always items-stretch justify-center overflow-hidden bg-background">
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
        className="absolute right-4 top-4 z-20 flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface/70 backdrop-blur transition hover:bg-surface-2"
        aria-label={soundOn ? "Mute" : "Tap for sound"}
      >
        {soundOn ? <Volume2 size={15} /> : <VolumeX size={15} />}
      </button>

      <button
        onClick={handlePrimaryTap}
        className="relative z-10 flex w-full max-w-2xl flex-col items-center justify-center px-6"
      >
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white/10 backdrop-blur transition group-hover:scale-105">
          {ended ? null : !soundOn ? <VolumeX size={26} /> : playing ? <Pause size={28} /> : <Play size={28} className="ml-1" />}
        </div>
        {!ended && !soundOn && (
          <p className="mt-3 animate-pulse text-sm font-medium text-white/80">Tap for sound</p>
        )}
        <div className="mt-8 h-24 w-full max-w-xl">
          <Waveform data={sample.waveform} progress={ended ? 1 : progress} />
        </div>
      </button>

      {ended && (
        <div className="absolute left-1/2 top-1/3 z-20 -translate-x-1/2 -translate-y-1/2 rotate-[-8deg] rounded-lg border-2 border-live px-4 py-1 text-lg font-black uppercase tracking-widest text-live">
          Sold
        </div>
      )}

      <div className="absolute inset-x-0 bottom-0 z-20 flex items-end justify-between gap-4 p-5 lg:gap-8 lg:p-8">
        <div className="min-w-0 max-w-[65%] lg:max-w-[55%]">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="truncate text-2xl font-bold lg:text-4xl">{sample.title}</h2>
              <p className="mt-1 text-sm text-muted lg:mt-2 lg:text-lg">
                {sample.genre} · {sample.bpm} BPM · {sample.key}
              </p>
            </div>
            <div className="shrink-0">
              <CountdownBadge endTime={sample.endTime} ended={ended} />
            </div>
          </div>
          {sample.seller && (
            <Link to={`/u/${sample.seller.username}`} className="mt-3 flex items-center gap-2 lg:mt-4 lg:gap-3">
              <span className="lg:scale-125 lg:origin-left">
                <Avatar seed={sample.seller.avatarSeed} username={sample.seller.username} size={28} />
              </span>
              <span className="flex items-center gap-1 text-sm font-medium lg:text-lg">
                {sample.seller.username}
                {sample.seller.verified && <VerifiedBadge size={13} />}
              </span>
            </Link>
          )}
          <Link
            to={`/sample/${sample.id}`}
            className="mt-3 inline-flex items-center gap-1 text-xs text-muted hover:text-foreground lg:mt-4 lg:text-sm"
          >
            Full auction page <ExternalLink size={11} />
          </Link>
        </div>

        <div className="flex flex-col items-center gap-3 lg:gap-4">
          <div className="text-center">
            <p className="text-[10px] uppercase tracking-wide text-muted-2 lg:text-xs">
              {ended ? "Sold for" : "Current bid"}
            </p>
            <p className="text-xl font-bold lg:text-3xl">{centsToDisplay(sample.currentPriceCents)}</p>
          </div>

          {!ended && !isSeller && (
            <>
              <button
                onClick={() => submitBid(minNext)}
                disabled={submitting}
                className="shimmer-bg flex flex-col items-center gap-0.5 rounded-full px-4 py-2.5 text-xs font-semibold text-white shadow-lg transition hover:scale-105 disabled:opacity-50 lg:px-6 lg:py-3.5 lg:text-base"
              >
                <Gavel size={16} />
                Bid {centsToDisplay(minNext)}
              </button>

              <button
                onClick={() => setCustomOpen((v) => !v)}
                className="text-[11px] text-muted hover:text-foreground lg:text-sm"
              >
                {customOpen ? "Cancel" : "Custom amount"}
              </button>

              {customOpen && (
                <div className="flex w-40 flex-col gap-1.5 rounded-xl border border-border bg-surface p-2 lg:w-52 lg:gap-2 lg:p-3">
                  <input
                    type="number"
                    step="0.5"
                    min={minNext / 100}
                    value={customAmount}
                    onChange={(e) => setCustomAmount(e.target.value)}
                    placeholder={`Min ${centsToDisplay(minNext)}`}
                    className="w-full rounded-md border border-border bg-surface-2 px-2 py-1.5 text-xs outline-none focus:border-primary lg:px-3 lg:py-2 lg:text-sm"
                  />
                  <button
                    onClick={() => {
                      const cents = Math.round(parseFloat(customAmount) * 100);
                      if (cents) submitBid(cents);
                    }}
                    disabled={submitting}
                    className="rounded-md bg-primary px-2 py-1.5 text-xs font-semibold text-white disabled:opacity-50 lg:px-3 lg:py-2 lg:text-sm"
                  >
                    Confirm
                  </button>
                </div>
              )}

              {sample.buyNowPriceCents && (
                <button
                  onClick={() => submitBid(sample.buyNowPriceCents!)}
                  disabled={submitting}
                  className="flex items-center gap-1 rounded-full bg-accent/15 px-3 py-1.5 text-[11px] font-semibold text-accent transition hover:bg-accent/25 disabled:opacity-50 lg:px-4 lg:py-2 lg:text-sm"
                >
                  <Flame size={12} />
                  Buy {centsToDisplay(sample.buyNowPriceCents)}
                </button>
              )}
            </>
          )}

          {!ended && isSeller && <p className="max-w-[7rem] text-center text-[11px] text-muted-2 lg:max-w-none lg:text-sm">Your listing</p>}

          {ended && sample.winner && sample.certificateCode && (
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
  );
}
