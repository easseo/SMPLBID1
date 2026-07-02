import { useState } from "react";

type Status = "idle" | "checking" | "valid" | "invalid";

// Encoders/containers round durations (frame padding, header rounding, etc.), so a
// file requested at exactly the boundary can decode to e.g. 30.02s. Without slack,
// a file the user deliberately trimmed to the limit gets rejected for being "too
// long" by a fraction of a second neither they nor the displayed value can see.
const DURATION_TOLERANCE_SECONDS = 0.5;

export function useAudioFileCheck(minSeconds: number, maxSeconds: number) {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [duration, setDuration] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setFile(null);
    setStatus("idle");
    setDuration(null);
    setError(null);
  }

  function onFileChange(selected: File | null) {
    if (!selected) {
      reset();
      return;
    }
    setStatus("checking");
    setError(null);
    setFile(selected);

    const url = URL.createObjectURL(selected);
    const probe = new Audio();
    probe.preload = "metadata";
    probe.onloadedmetadata = () => {
      const d = probe.duration;
      setDuration(d);
      if (d < minSeconds - DURATION_TOLERANCE_SECONDS) {
        setStatus("invalid");
        setError(`Too short — needs at least ${minSeconds}s (got ${d.toFixed(1)}s)`);
      } else if (d > maxSeconds + DURATION_TOLERANCE_SECONDS) {
        setStatus("invalid");
        setError(`Too long — max ${maxSeconds}s (got ${d.toFixed(1)}s)`);
      } else {
        setStatus("valid");
      }
      URL.revokeObjectURL(url);
    };
    probe.onerror = () => {
      setStatus("invalid");
      setError("Couldn't read this audio file");
      URL.revokeObjectURL(url);
    };
    probe.src = url;
  }

  return { file, status, duration, error, onFileChange, reset };
}
