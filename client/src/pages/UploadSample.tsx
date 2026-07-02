import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { UploadCloud, CheckCircle2, XCircle, Loader2, Lock, Globe, ImageIcon } from "lucide-react";
import { api, ApiError } from "../lib/api";
import type { SampleSummary } from "../lib/types";
import { useAudioFileCheck } from "../hooks/useAudioFileCheck";

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

const DURATION_OPTIONS = [
  { label: "10 minutes (demo)", value: 10 },
  { label: "1 hour", value: 60 },
  { label: "6 hours", value: 360 },
  { label: "24 hours", value: 1440 },
  { label: "3 days", value: 4320 },
  { label: "7 days", value: 10080 },
];

const PREVIEW_MIN = 10;
const PREVIEW_MAX = 15;
const FULL_MIN = 20;
const FULL_MAX = 30;

export function UploadSample() {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [genre, setGenre] = useState("");
  const [bpm, setBpm] = useState("120");
  const [key, setKey] = useState("");
  const [startingPrice, setStartingPrice] = useState("10");
  const [buyNowPrice, setBuyNowPrice] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(1440);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const preview = useAudioFileCheck(PREVIEW_MIN, PREVIEW_MAX);
  const full = useAudioFileCheck(FULL_MIN, FULL_MAX);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);

  useEffect(() => {
    if (!imageFile) {
      setImagePreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(imageFile);
    setImagePreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [imageFile]);

  function handleImageChange(file: File | null) {
    setImageError(null);
    if (!file) {
      setImageFile(null);
      return;
    }
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setImageError("Cover image must be a JPEG, PNG, or WEBP file");
      setImageFile(null);
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setImageError("Cover image must be under 8MB");
      setImageFile(null);
      return;
    }
    setImageFile(file);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!imageFile) {
      setError("Attach a cover image first");
      return;
    }
    if (preview.status !== "valid" || !preview.file) {
      setError("Attach a valid MP3 preview clip first");
      return;
    }
    if (full.status !== "valid" || !full.file) {
      setError("Attach a valid WAV full file first");
      return;
    }
    if (buyNowPrice && parseFloat(buyNowPrice) <= parseFloat(startingPrice)) {
      setError("Buy-now price must be higher than the starting price");
      return;
    }
    setSubmitting(true);
    try {
      const form = new FormData();
      form.append("title", title);
      form.append("description", description);
      form.append("genre", genre);
      form.append("bpm", bpm);
      form.append("key", key);
      form.append("startingPriceCents", String(Math.round(parseFloat(startingPrice) * 100)));
      if (buyNowPrice) form.append("buyNowPriceCents", String(Math.round(parseFloat(buyNowPrice) * 100)));
      form.append("durationMinutes", String(durationMinutes));
      form.append("image", imageFile);
      form.append("preview", preview.file);
      form.append("full", full.file);

      const res = await api.post<{ sample: SampleSummary }>("/samples", form);
      navigate(`/sample/${res.sample.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create auction");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      <h1 className="text-3xl font-bold">Sell an exclusive sample</h1>
      <p className="mt-1 text-sm text-muted">
        Once it sells, it's gone — permanently removed from your library and everyone else's. Only the winner keeps
        the rights.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
        <div>
          <div className="mb-1 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted">
            <ImageIcon size={14} /> Cover image
          </div>
          <label
            className={`flex cursor-pointer flex-col items-center gap-2 overflow-hidden rounded-xl border bg-surface-2 text-center transition hover:border-primary/50 ${
              imageError ? "border-live/50" : imageFile ? "border-success/50" : "border-dashed border-border"
            }`}
          >
            {imagePreviewUrl ? (
              <div className="relative aspect-[4/3] w-full">
                <img src={imagePreviewUrl} alt="" className="h-full w-full object-cover" />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                  <span className="text-xs font-medium text-white">{imageFile?.name}</span>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 px-4 py-8">
                <UploadCloud size={22} className="text-primary" />
                <span className="text-sm font-medium">Click to attach — JPEG, PNG, or WEBP, up to 8MB</span>
              </div>
            )}
            {imageError && <p className="w-full bg-live/10 px-3 py-2 text-xs text-live">{imageError}</p>}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => handleImageChange(e.target.files?.[0] ?? null)}
            />
          </label>
        </div>

        <AudioDropzone
          label="Preview clip"
          icon={<Globe size={14} />}
          hint={`MP3 or M4A · ${PREVIEW_MIN}-${PREVIEW_MAX}s · public, anyone can listen`}
          accept="audio/mpeg,audio/mp4,audio/x-m4a,.mp3,.m4a"
          state={preview}
        />

        <AudioDropzone
          label="Full file"
          icon={<Lock size={14} />}
          hint={`WAV · ${FULL_MIN}-${FULL_MAX}s · locked — only the winner can download it, after they win`}
          accept="audio/wav,.wav"
          state={full}
        />

        <Field label="Title">
          <input required maxLength={80} value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} placeholder="Midnight Static Loop" />
        </Field>

        <Field label="Description">
          <textarea
            required
            maxLength={1000}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className={`${inputClass} min-h-24 resize-y`}
            placeholder="What makes this sample special?"
          />
          <span className="mt-1 block text-right text-[11px] text-muted-2">{description.length}/1000</span>
        </Field>

        <div className="grid grid-cols-3 gap-3">
          <Field label="Genre">
            <input required value={genre} onChange={(e) => setGenre(e.target.value)} className={inputClass} placeholder="Trap" />
          </Field>
          <Field label="BPM">
            <input required type="number" min={20} max={300} value={bpm} onChange={(e) => setBpm(e.target.value)} className={inputClass} />
          </Field>
          <Field label="Key">
            <input required value={key} onChange={(e) => setKey(e.target.value)} className={inputClass} placeholder="F# Minor" />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Starting price ($)">
            <input required type="number" min={1} step="0.01" value={startingPrice} onChange={(e) => setStartingPrice(e.target.value)} className={inputClass} />
          </Field>
          <Field label="Buy-now price ($, optional)">
            <input type="number" min={1} step="0.01" value={buyNowPrice} onChange={(e) => setBuyNowPrice(e.target.value)} className={inputClass} placeholder="Skip the wait" />
          </Field>
        </div>

        <Field label="Auction duration">
          <select value={durationMinutes} onChange={(e) => setDurationMinutes(Number(e.target.value))} className={inputClass}>
            {DURATION_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>

        {error && <p className="rounded-lg border border-live/30 bg-live/10 px-3 py-2 text-sm text-live">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="shimmer-bg mt-2 rounded-lg py-2.5 font-semibold text-white shadow-lg transition hover:scale-[1.01] disabled:opacity-60"
        >
          {submitting ? "Uploading…" : "Launch auction"}
        </button>
      </form>
    </div>
  );
}

const inputClass = "mt-1 w-full rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-sm outline-none focus:border-primary";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-medium uppercase tracking-wide text-muted">{label}</span>
      {children}
    </label>
  );
}

function AudioDropzone({
  label,
  icon,
  hint,
  accept,
  state,
}: {
  label: string;
  icon: React.ReactNode;
  hint: string;
  accept: string;
  state: ReturnType<typeof useAudioFileCheck>;
}) {
  const borderClass =
    state.status === "valid"
      ? "border-success/50"
      : state.status === "invalid"
        ? "border-live/50"
        : "border-dashed border-border";

  return (
    <div>
      <div className="mb-1 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted">
        {icon} {label}
      </div>
      <label
        className={`flex cursor-pointer flex-col items-center gap-2 rounded-xl border ${borderClass} bg-surface-2 px-4 py-6 text-center transition hover:border-primary/50`}
      >
        {state.status === "checking" ? (
          <Loader2 size={22} className="animate-spin text-muted" />
        ) : state.status === "valid" ? (
          <CheckCircle2 size={22} className="text-success" />
        ) : state.status === "invalid" ? (
          <XCircle size={22} className="text-live" />
        ) : (
          <UploadCloud size={22} className="text-primary" />
        )}
        <span className="text-sm font-medium">
          {state.file ? state.file.name : `Click to attach — ${hint}`}
        </span>
        {state.status === "valid" && state.duration && (
          <span className="text-xs text-success">Looks good — {state.duration.toFixed(1)}s</span>
        )}
        {state.status === "invalid" && state.error && <span className="text-xs text-live">{state.error}</span>}
        {state.file && state.status !== "invalid" && state.status !== "checking" && (
          <span className="text-[11px] text-muted-2">{hint}</span>
        )}
        <input
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => state.onFileChange(e.target.files?.[0] ?? null)}
        />
      </label>
    </div>
  );
}
