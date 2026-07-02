import { useEffect, useMemo, useState, type FormEvent, type KeyboardEvent } from "react";
import { useNavigate } from "react-router-dom";
import {
  UploadCloud,
  CheckCircle2,
  XCircle,
  Loader2,
  ImageIcon,
  Headphones,
  Music,
  Archive,
  Music2,
  Save,
  Sparkles,
  Check,
} from "lucide-react";
import { api, ApiError } from "../lib/api";
import type { SampleSummary } from "../lib/types";
import { useAudioFileCheck } from "../hooks/useAudioFileCheck";

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const DRAFT_KEY = "smplbid:upload-draft";

const DURATION_OPTIONS = [
  { label: "10 minutes (demo)", value: 10 },
  { label: "1 hour", value: 60 },
  { label: "6 hours", value: 360 },
  { label: "24 hours", value: 1440 },
  { label: "3 days", value: 4320 },
  { label: "7 days", value: 10080 },
];

const GENRES = [
  "Hip-Hop",
  "Trap",
  "Drill",
  "R&B",
  "Pop",
  "Electronic",
  "House",
  "Techno",
  "Lo-Fi",
  "Afrobeats",
  "Reggaeton",
  "Ambient",
  "Rock",
  "Soul / Funk",
  "Cinematic",
  "Other",
];

const SUBGENRES: Record<string, string[]> = {
  "Hip-Hop": ["Boom Bap", "Jazz Rap", "West Coast", "Old School", "Abstract"],
  Trap: ["Dark Trap", "Melodic Trap", "Rage", "Plugg"],
  Drill: ["UK Drill", "NY Drill", "Chicago Drill"],
  "R&B": ["Neo Soul", "Alt R&B", "Slow Jam"],
  Electronic: ["Synthwave", "IDM", "Breakbeat", "Garage"],
  House: ["Deep House", "Tech House", "Afro House"],
  Techno: ["Melodic Techno", "Industrial", "Minimal"],
  "Lo-Fi": ["Chillhop", "Jazzhop", "Tape Loops"],
};

const MOODS = [
  "Dark",
  "Melancholic",
  "Uplifting",
  "Aggressive",
  "Chill",
  "Dreamy",
  "Energetic",
  "Romantic",
  "Eerie",
  "Triumphant",
];

const KEYS = [
  "C Major", "C Minor", "C# Major", "C# Minor",
  "D Major", "D Minor", "D# Major", "D# Minor",
  "E Major", "E Minor",
  "F Major", "F Minor", "F# Major", "F# Minor",
  "G Major", "G Minor", "G# Major", "G# Minor",
  "A Major", "A Minor", "A# Major", "A# Minor",
  "B Major", "B Minor",
];

const PRICE_SUGGESTIONS: Record<string, [number, number]> = {
  "Hip-Hop": [8, 18],
  Trap: [10, 20],
  Drill: [10, 22],
  "R&B": [8, 16],
  Electronic: [9, 20],
  House: [9, 18],
  Techno: [9, 18],
  "Lo-Fi": [6, 14],
  Cinematic: [12, 28],
};

const PREVIEW_MIN = 10;
const PREVIEW_MAX = 15;
const FULL_MIN = 20;
const FULL_MAX = 30;

const MAX_TAGS = 10;

interface Draft {
  title?: string;
  description?: string;
  genre?: string;
  subgenre?: string;
  bpm?: string;
  key?: string;
  mood?: string;
  tags?: string[];
  startingPrice?: string;
  buyNowPrice?: string;
  durationMinutes?: number;
}

function readDraft(): Draft {
  try {
    return JSON.parse(localStorage.getItem(DRAFT_KEY) ?? "{}");
  } catch {
    return {};
  }
}

export function UploadSample() {
  const navigate = useNavigate();
  const saved = useMemo(readDraft, []);

  const [title, setTitle] = useState(saved.title ?? "");
  const [description, setDescription] = useState(saved.description ?? "");
  const [genre, setGenre] = useState(saved.genre ?? "");
  const [subgenre, setSubgenre] = useState(saved.subgenre ?? "");
  const [bpm, setBpm] = useState(saved.bpm ?? "120");
  const [key, setKey] = useState(saved.key ?? "");
  const [mood, setMood] = useState(saved.mood ?? "");
  const [tags, setTags] = useState<string[]>(saved.tags ?? []);
  const [tagInput, setTagInput] = useState("");
  const [startingPrice, setStartingPrice] = useState(saved.startingPrice ?? "10");
  const [buyNowPrice, setBuyNowPrice] = useState(saved.buyNowPrice ?? "");
  const [durationMinutes, setDurationMinutes] = useState(saved.durationMinutes ?? 1440);
  const [rightsConfirmed, setRightsConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const preview = useAudioFileCheck(PREVIEW_MIN, PREVIEW_MAX);
  const full = useAudioFileCheck(FULL_MIN, FULL_MAX);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [stemsFile, setStemsFile] = useState<File | null>(null);
  const [midiFile, setMidiFile] = useState<File | null>(null);

  // Drafts autosave — text fields only; files can't survive a reload.
  useEffect(() => {
    const draft: Draft = {
      title,
      description,
      genre,
      subgenre,
      bpm,
      key,
      mood,
      tags,
      startingPrice,
      buyNowPrice,
      durationMinutes,
    };
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  }, [title, description, genre, subgenre, bpm, key, mood, tags, startingPrice, buyNowPrice, durationMinutes]);

  function clearDraft() {
    localStorage.removeItem(DRAFT_KEY);
    setTitle("");
    setDescription("");
    setGenre("");
    setSubgenre("");
    setBpm("120");
    setKey("");
    setMood("");
    setTags([]);
    setTagInput("");
    setStartingPrice("10");
    setBuyNowPrice("");
    setDurationMinutes(1440);
    setRightsConfirmed(false);
    setError(null);
  }

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

  function commitTag() {
    const value = tagInput.trim().replace(/,+$/, "");
    setTagInput("");
    if (!value || tags.includes(value) || tags.length >= MAX_TAGS) return;
    setTags([...tags, value]);
  }

  function handleTagKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      commitTag();
    } else if (e.key === "Backspace" && !tagInput && tags.length > 0) {
      setTags(tags.slice(0, -1));
    }
  }

  const suggestion = PRICE_SUGGESTIONS[genre];

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
      setError("Buy Now price must be greater than the starting bid");
      return;
    }
    if (!rightsConfirmed) {
      setError("Confirm you own the rights to this sample first");
      return;
    }
    setSubmitting(true);
    try {
      const form = new FormData();
      form.append("title", title);
      form.append("description", description);
      form.append("genre", genre);
      form.append("subgenre", subgenre);
      form.append("mood", mood);
      form.append("tags", tags.join(","));
      form.append("bpm", bpm);
      form.append("key", key);
      form.append("startingPriceCents", String(Math.round(parseFloat(startingPrice) * 100)));
      if (buyNowPrice) form.append("buyNowPriceCents", String(Math.round(parseFloat(buyNowPrice) * 100)));
      form.append("durationMinutes", String(durationMinutes));
      form.append("image", imageFile);
      form.append("preview", preview.file);
      form.append("full", full.file);
      if (stemsFile) form.append("stems", stemsFile);
      if (midiFile) form.append("midi", midiFile);

      const res = await api.post<{ sample: SampleSummary }>("/samples", form);
      localStorage.removeItem(DRAFT_KEY);
      navigate(`/sample/${res.sample.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create auction");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="flex items-start justify-between gap-4">
        <h1 className="text-4xl font-bold tracking-tight md:text-5xl">Drop an exclusive sample</h1>
        <button
          type="button"
          onClick={clearDraft}
          className="mt-2 inline-flex shrink-0 items-center gap-1.5 text-sm font-medium text-muted transition hover:text-foreground"
        >
          <Save size={15} /> Clear draft
        </button>
      </div>
      <p className="mt-2 text-muted">One owner. One sale. Forever exclusive. Drafts autosave.</p>

      <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-6">
        {/* ---------- 1. Basics ---------- */}
        <Section number={1} title="Basics" subtitle="Tell buyers what this is.">
          <Field label="Sample Title" required>
            <input
              required
              maxLength={80}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={inputClass}
              placeholder="Midnight 808s — exclusive"
            />
          </Field>

          <Field label="Description">
            <textarea
              required
              maxLength={1000}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={`${inputClass} min-h-28 resize-y`}
              placeholder="What makes this one special?"
            />
          </Field>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Genre" required>
              <select required value={genre} onChange={(e) => { setGenre(e.target.value); setSubgenre(""); }} className={inputClass}>
                <option value="" disabled>
                  Pick genre
                </option>
                {GENRES.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Subgenre">
              <select value={subgenre} onChange={(e) => setSubgenre(e.target.value)} className={inputClass}>
                <option value="">None</option>
                {(SUBGENRES[genre] ?? []).map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="BPM" required>
              <input required type="number" min={20} max={300} value={bpm} onChange={(e) => setBpm(e.target.value)} className={inputClass} />
            </Field>
            <Field label="Musical Key" required>
              <select required value={key} onChange={(e) => setKey(e.target.value)} className={inputClass}>
                <option value="" disabled>
                  Pick key
                </option>
                {KEYS.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Mood" required>
              <select required value={mood} onChange={(e) => setMood(e.target.value)} className={inputClass}>
                <option value="" disabled>
                  Pick mood
                </option>
                {MOODS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Auction Duration" required>
              <select value={durationMinutes} onChange={(e) => setDurationMinutes(Number(e.target.value))} className={inputClass}>
                {DURATION_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <Field label={`Tags (${tags.length}/${MAX_TAGS})`}>
            <div className="mt-2 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-surface-2/60 px-3 py-2.5 transition focus-within:border-primary">
              {tags.map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary"
                >
                  {t}
                  <button
                    type="button"
                    onClick={() => setTags(tags.filter((x) => x !== t))}
                    className="text-primary/70 transition hover:text-primary"
                    aria-label={`Remove tag ${t}`}
                  >
                    ×
                  </button>
                </span>
              ))}
              <input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleTagKeyDown}
                onBlur={commitTag}
                disabled={tags.length >= MAX_TAGS}
                className="min-w-28 flex-1 bg-transparent py-0.5 text-sm outline-none placeholder:text-muted-2"
                placeholder={tags.length === 0 ? "dark, 808, melodic…" : ""}
              />
            </div>
          </Field>
        </Section>

        {/* ---------- 2. Files ---------- */}
        <Section number={2} title="Files" subtitle="Preview is public. Original WAV is private until sold.">
          <div>
            <FileLabel>Cover Image (optional but recommended)</FileLabel>
            <label
              className={`block cursor-pointer overflow-hidden rounded-2xl border transition hover:border-primary/50 ${
                imageError ? "border-error/50" : imageFile ? "border-success" : "border-dashed border-border"
              }`}
            >
              {imagePreviewUrl ? (
                <div className="relative aspect-[4/3] w-full">
                  <img src={imagePreviewUrl} alt="" className="h-full w-full object-cover" />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-3">
                    <span className="text-xs font-medium text-white">{imageFile?.name}</span>
                  </div>
                </div>
              ) : (
                <DropRow icon={<ImageIcon size={20} />} title="Drop file or click to browse" hint="JPG/PNG/WEBP, square recommended. Max 8MB." />
              )}
              {imageError && <p className="w-full bg-error/10 px-4 py-2 text-xs text-error">{imageError}</p>}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => handleImageChange(e.target.files?.[0] ?? null)}
              />
            </label>
          </div>

          <AudioDropzone
            label="Preview Audio (MP3)"
            required
            icon={<Headphones size={20} />}
            hint={`Public ${PREVIEW_MIN}–${PREVIEW_MAX}s clip. MP3/M4A only.`}
            accept="audio/mpeg,audio/mp4,audio/x-m4a,.mp3,.m4a"
            state={preview}
          />

          <AudioDropzone
            label="Original Sample (WAV)"
            required
            icon={<Music size={20} />}
            hint={`Private. Only the buyer can download after purchase. WAV, ${FULL_MIN}–${FULL_MAX}s.`}
            accept="audio/wav,.wav"
            state={full}
          />

          <div className="grid gap-5 sm:grid-cols-2">
            <SimpleFileDrop
              label="STEMS (optional)"
              icon={<Archive size={20} />}
              hint="ZIP archive of stems. ZIP only."
              file={stemsFile}
              onChange={setStemsFile}
            />
            <SimpleFileDrop
              label="MIDI (optional)"
              icon={<Music2 size={20} />}
              hint="ZIP archive of .mid/.midi files. ZIP only."
              file={midiFile}
              onChange={setMidiFile}
            />
          </div>
        </Section>

        {/* ---------- 3. Pricing ---------- */}
        <Section number={3} title="Pricing" subtitle="Buy Now ends the auction instantly.">
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <Field label="Starting Bid (USD)" required>
                <input
                  required
                  type="number"
                  min={1}
                  step="1"
                  value={startingPrice}
                  onChange={(e) => setStartingPrice(e.target.value)}
                  className={inputClass}
                />
              </Field>
              {suggestion && (
                <p className="mt-2 flex items-center gap-1.5 text-sm font-medium text-primary">
                  <Sparkles size={14} /> Suggested for {genre}: ${suggestion[0]}–${suggestion[1]}
                </p>
              )}
            </div>
            <div>
              <Field label="Buy Now Price (USD)">
                <input
                  type="number"
                  min={1}
                  step="1"
                  value={buyNowPrice}
                  onChange={(e) => setBuyNowPrice(e.target.value)}
                  className={inputClass}
                  placeholder="Optional"
                />
              </Field>
              <p className="mt-2 text-sm text-muted">Must be greater than starting bid.</p>
            </div>
          </div>
        </Section>

        {/* ---------- 4. Rights confirmation ---------- */}
        <Section number={4} title="Rights confirmation" subtitle="Required by SMPLbid.">
          <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-border bg-surface-2/40 p-5 transition hover:border-primary/50">
            <input
              type="checkbox"
              checked={rightsConfirmed}
              onChange={(e) => setRightsConfirmed(e.target.checked)}
              className="sr-only"
            />
            <span
              className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition ${
                rightsConfirmed ? "border-primary bg-primary text-background" : "border-primary/60"
              }`}
            >
              {rightsConfirmed && <Check size={12} strokeWidth={3} />}
            </span>
            <span className="text-sm leading-relaxed">
              I confirm that I own all rights to this sample and have the legal right to sell exclusive ownership
              through SMPLbid.
            </span>
          </label>
        </Section>

        {error && <p className="rounded-xl border border-error/30 bg-error/10 px-4 py-3 text-sm text-error">{error}</p>}

        <button
          type="submit"
          disabled={submitting || !rightsConfirmed}
          className="shimmer-bg glow-shadow flex w-full items-center justify-center gap-2.5 rounded-2xl py-4 text-lg font-bold transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? (
            <>
              <Loader2 size={20} className="animate-spin" /> Publishing…
            </>
          ) : (
            <>
              <UploadCloud size={20} /> Publish &amp; Go Live
            </>
          )}
        </button>
      </form>
    </div>
  );
}

const inputClass =
  "mt-2 w-full rounded-xl border border-border bg-surface-2/60 px-4 py-3 text-sm outline-none transition focus:border-primary";

function Section({
  number,
  title,
  subtitle,
  children,
}: {
  number: number;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-border bg-surface p-6 sm:p-8">
      <h2 className="text-2xl font-bold">
        {number}. {title}
      </h2>
      <p className="mt-1 text-sm text-muted">{subtitle}</p>
      <div className="mt-6 flex flex-col gap-5">{children}</div>
    </section>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-semibold">
        {label}
        {required && <span className="text-primary"> *</span>}
      </span>
      {children}
    </label>
  );
}

function FileLabel({ children }: { children: React.ReactNode }) {
  return <div className="mb-2 text-sm font-semibold">{children}</div>;
}

function DropRow({ icon, title, hint }: { icon: React.ReactNode; title: string; hint: string }) {
  return (
    <div className="flex items-center gap-4 p-5">
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-muted">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block truncate font-semibold">{title}</span>
        <span className="mt-0.5 block text-sm text-muted">{hint}</span>
      </span>
    </div>
  );
}

function AudioDropzone({
  label,
  required,
  icon,
  hint,
  accept,
  state,
}: {
  label: string;
  required?: boolean;
  icon: React.ReactNode;
  hint: string;
  accept: string;
  state: ReturnType<typeof useAudioFileCheck>;
}) {
  const borderClass =
    state.status === "valid"
      ? "border-success"
      : state.status === "invalid"
        ? "border-error/50"
        : "border-dashed border-border";

  return (
    <div>
      <FileLabel>
        {label}
        {required && <span className="text-primary"> *</span>}
      </FileLabel>
      <label className={`block cursor-pointer rounded-2xl border ${borderClass} transition hover:border-primary/50`}>
        <div className="flex items-center gap-4 p-5">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-muted">
            {state.status === "checking" ? (
              <Loader2 size={20} className="animate-spin" />
            ) : state.status === "valid" ? (
              <CheckCircle2 size={20} className="text-success" />
            ) : state.status === "invalid" ? (
              <XCircle size={20} className="text-error" />
            ) : (
              icon
            )}
          </span>
          <span className="min-w-0">
            <span className="block truncate font-semibold">
              {state.file ? state.file.name : "Drop file or click to browse"}
            </span>
            <span
              className={`mt-0.5 block text-sm ${
                state.status === "valid" ? "text-success" : state.status === "invalid" ? "text-error" : "text-muted"
              }`}
            >
              {state.status === "valid" && state.duration
                ? `Looks good — ${state.duration.toFixed(1)}s`
                : state.status === "invalid" && state.error
                  ? state.error
                  : hint}
            </span>
          </span>
        </div>
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

const ZIP_MIMES = ["application/zip", "application/x-zip-compressed"];

function isZipFile(file: File) {
  return ZIP_MIMES.includes(file.type) || file.name.toLowerCase().endsWith(".zip");
}

function SimpleFileDrop({
  label,
  icon,
  hint,
  file,
  onChange,
}: {
  label: string;
  icon: React.ReactNode;
  hint: string;
  file: File | null;
  onChange: (file: File | null) => void;
}) {
  const [fileError, setFileError] = useState<string | null>(null);

  function handleChange(selected: File | null) {
    setFileError(null);
    if (!selected) {
      onChange(null);
      return;
    }
    if (!isZipFile(selected)) {
      onChange(null);
      setFileError("Only ZIP files are accepted");
      return;
    }
    onChange(selected);
  }

  return (
    <div>
      <FileLabel>{label}</FileLabel>
      <label
        className={`block cursor-pointer rounded-2xl border transition hover:border-primary/50 ${
          fileError ? "border-error/50" : file ? "border-success" : "border-dashed border-border"
        }`}
      >
        <div className="flex items-center gap-4 p-5">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-muted">
            {file ? <CheckCircle2 size={20} className="text-success" /> : fileError ? <XCircle size={20} className="text-error" /> : icon}
          </span>
          <span className="min-w-0">
            <span className="block truncate font-semibold">{file ? file.name : "Drop file or click to browse"}</span>
            <span className={`mt-0.5 block text-sm ${fileError ? "text-error" : "text-muted"}`}>
              {fileError ?? hint}
            </span>
          </span>
        </div>
        <input
          type="file"
          accept=".zip,application/zip,application/x-zip-compressed"
          className="hidden"
          onChange={(e) => handleChange(e.target.files?.[0] ?? null)}
        />
      </label>
    </div>
  );
}
