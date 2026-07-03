import { useEffect, useRef, useState } from "react";
import { Play, Pause, ShieldCheck } from "lucide-react";
import { Waveform } from "./Waveform";

interface Props {
  src: string;
  waveform: number[];
  watermark?: boolean;
}

// Preview playback mixes in a faint periodic tone via a fully separate Web Audio
// oscillator graph — never routed through the <audio> element itself, so the
// watermark can't ever silently break real playback (a routed
// createMediaElementSource graph can get stuck 'suspended' with no error, leaving
// the UI looking like it's playing while producing no sound at all).
export function AudioPlayer({ src, waveform, watermark = true }: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const watermarkTimer = useRef<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    return () => {
      if (watermarkTimer.current) window.clearInterval(watermarkTimer.current);
      ctxRef.current?.close().catch(() => {});
    };
  }, []);

  function ensureWatermarkContext(): AudioContext {
    if (!ctxRef.current) ctxRef.current = new AudioContext();
    ctxRef.current.resume().catch(() => {});
    return ctxRef.current;
  }

  function scheduleBlip(ctx: AudioContext) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 1760;
    osc.type = "sine";
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.035, ctx.currentTime + 0.02);
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.18);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.2);
  }

  function togglePlay() {
    const audio = audioRef.current;
    if (!audio) return;

    if (playing) {
      audio.pause();
      setPlaying(false);
      if (watermarkTimer.current) {
        window.clearInterval(watermarkTimer.current);
        watermarkTimer.current = null;
      }
      return;
    }

    audio
      .play()
      .then(() => setPlaying(true))
      .catch(() => setPlaying(false));

    if (watermark) {
      const ctx = ensureWatermarkContext();
      scheduleBlip(ctx);
      watermarkTimer.current = window.setInterval(() => scheduleBlip(ensureWatermarkContext()), 4000);
    }
  }

  function handleTimeUpdate() {
    const audio = audioRef.current;
    if (!audio || !audio.duration) return;
    setProgress(audio.currentTime / audio.duration);
  }

  function handleEnded() {
    setPlaying(false);
    setProgress(0);
    if (watermarkTimer.current) {
      window.clearInterval(watermarkTimer.current);
      watermarkTimer.current = null;
    }
  }

  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-surface-2 p-3">
      <audio ref={audioRef} src={src} onTimeUpdate={handleTimeUpdate} onEnded={handleEnded} />
      <button
        onClick={togglePlay}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-background shadow-[0_0_12px_rgba(245,216,137,0.35)] transition hover:scale-105"
        aria-label={playing ? "Pause" : "Play"}
      >
        {playing ? <Pause size={16} /> : <Play size={16} className="ml-0.5" />}
      </button>
      <div className="h-10 flex-1">
        <Waveform data={waveform} progress={progress} />
      </div>
      {watermark && (
        <div className="flex shrink-0 items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-muted" title="Previews carry an inaudible-to-most watermark tone to deter piracy">
          <ShieldCheck size={12} className="text-verified" />
          Preview up to 15 seconds
        </div>
      )}
    </div>
  );
}
