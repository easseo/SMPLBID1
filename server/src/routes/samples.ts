import { Router } from "express";
import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import fsp from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../lib/auth.js";
import { buildWaveform } from "../lib/waveform.js";
import { getWavDurationSeconds } from "../lib/wavDuration.js";
import { getMp3DurationSeconds } from "../lib/mp3Duration.js";
import { getM4aDurationSeconds } from "../lib/m4aDuration.js";
import { detectImageType } from "../lib/imageSignature.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = path.join(__dirname, "..", "..", "uploads");

const router = Router();

const PREVIEW_MIN_SECONDS = 10;
const PREVIEW_MAX_SECONDS = 15;
const FULL_MIN_SECONDS = 20;
const FULL_MAX_SECONDS = 30;
// Mirrors the client-side tolerance — containers round durations, so a file trimmed
// to exactly the limit can measure a fraction of a second past it.
const DURATION_TOLERANCE_SECONDS = 0.5;

// Fallback only for the rare case a preview file's real duration can't be parsed
// (e.g. an unusual encoder that neither frame-walker recognizes) — the primary
// enforcement is the real MP3/M4A duration parse below, not this byte range.
const PREVIEW_MIN_BYTES = 20_000;
const PREVIEW_MAX_BYTES = 700_000;

function getPreviewDurationSeconds(buffer: Buffer, mimetype: string): number | null {
  if (mimetype === "audio/mp4" || mimetype === "audio/x-m4a" || mimetype === "audio/m4a") {
    return getM4aDurationSeconds(buffer);
  }
  return getMp3DurationSeconds(buffer);
}

function mimeForFile(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".wav") return "audio/wav";
  if (ext === ".ogg") return "audio/ogg";
  if (ext === ".m4a") return "audio/mp4";
  return "audio/mpeg";
}

const PREVIEW_MIMES = new Set(["audio/mpeg", "audio/mp3", "audio/mp4", "audio/x-m4a", "audio/m4a"]);
const WAV_MIMES = new Set(["audio/wav", "audio/wave", "audio/x-wav", "audio/vnd.wave"]);
const IMAGE_MIMES = new Set(["image/jpeg", "image/png", "image/webp"]);

// The extension used to persist an uploaded file must never come from
// user-controlled input (a multipart part's filename/originalname is fully
// attacker-chosen). Otherwise a request could declare Content-Type
// "image/png" — passing fileFilter — while naming the part "evil.html" or
// "evil.svg" with real HTML/JS as its body; express.static would then serve
// that file back with a browser-executable Content-Type from our own
// origin (stored XSS / session riding via the auth cookie's ambient
// credentials). Extensions are instead chosen server-side from the fixed,
// already-validated mimetype.
const SAFE_EXTENSIONS: Record<string, string> = {
  "audio/mpeg": ".mp3",
  "audio/mp3": ".mp3",
  "audio/mp4": ".m4a",
  "audio/x-m4a": ".m4a",
  "audio/m4a": ".m4a",
  "audio/wav": ".wav",
  "audio/wave": ".wav",
  "audio/x-wav": ".wav",
  "audio/vnd.wave": ".wav",
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    // Safe by construction: file.mimetype has already passed fileFilter's
    // allowlist check by the time this runs, so the lookup always hits.
    const ext = SAFE_EXTENSIONS[file.mimetype] ?? ".bin";
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.fieldname === "preview" && !PREVIEW_MIMES.has(file.mimetype)) {
      cb(new Error("Preview clip must be an MP3 or M4A file"));
      return;
    }
    if (file.fieldname === "full" && !WAV_MIMES.has(file.mimetype)) {
      cb(new Error("Full file must be a WAV file"));
      return;
    }
    if (file.fieldname === "image" && !IMAGE_MIMES.has(file.mimetype)) {
      cb(new Error("Cover image must be a JPEG, PNG, or WEBP file"));
      return;
    }
    cb(null, true);
  },
});

const uploadFields = upload.fields([
  { name: "preview", maxCount: 1 },
  { name: "full", maxCount: 1 },
  { name: "image", maxCount: 1 },
]);

const createSchema = z
  .object({
    title: z.string().trim().min(2).max(80),
    description: z.string().trim().min(1).max(1000),
    genre: z.string().trim().min(1).max(40),
    bpm: z.coerce.number().int().min(20).max(300),
    key: z.string().trim().min(1).max(10),
    startingPriceCents: z.coerce.number().int().min(100).max(100_000_00),
    buyNowPriceCents: z.coerce.number().int().min(100).max(100_000_00).optional(),
    durationMinutes: z.coerce.number().int().min(2).max(60 * 24 * 14),
  })
  .refine((data) => !data.buyNowPriceCents || data.buyNowPriceCents > data.startingPriceCents, {
    message: "Buy-now price must be higher than the starting price",
    path: ["buyNowPriceCents"],
  });

function serializeSample(sample: any, viewerId?: string) {
  const isSeller = viewerId && viewerId === sample.sellerId;
  const isWinner = viewerId && viewerId === sample.winnerId;
  return {
    id: sample.id,
    title: sample.title,
    description: sample.description,
    genre: sample.genre,
    bpm: sample.bpm,
    key: sample.key,
    imageUrl: sample.imageUrl,
    waveform: JSON.parse(sample.waveform),
    startingPriceCents: sample.startingPriceCents,
    currentPriceCents: sample.currentPriceCents,
    buyNowPriceCents: sample.buyNowPriceCents,
    minIncrementCents: sample.minIncrementCents,
    antiSnipeSeconds: sample.antiSnipeSeconds,
    status: sample.status,
    startTime: sample.startTime,
    endTime: sample.endTime,
    createdAt: sample.createdAt,
    seller: sample.seller
      ? { id: sample.seller.id, username: sample.seller.username, verified: sample.seller.verified, avatarSeed: sample.seller.avatarSeed }
      : undefined,
    winner: sample.winner
      ? { id: sample.winner.id, username: sample.winner.username, avatarSeed: sample.winner.avatarSeed }
      : undefined,
    bidCount: sample._count?.bids ?? undefined,
    canDownloadFull: Boolean(isSeller || (isWinner && sample.status === "ended")),
    certificateCode: sample.certificate?.code,
  };
}

router.get("/", async (req, res) => {
  const status = typeof req.query.status === "string" ? req.query.status : undefined;
  const samples = await prisma.sample.findMany({
    where: status ? { status } : undefined,
    include: { seller: true, winner: true, _count: { select: { bids: true } } },
    orderBy: { endTime: "asc" },
  });
  res.json({ samples: samples.map((s) => serializeSample(s, req.userId)) });
});

router.get("/:id", async (req, res) => {
  const sample = await prisma.sample.findUnique({
    where: { id: req.params.id },
    include: { seller: true, winner: true, certificate: true, _count: { select: { bids: true } } },
  });
  if (!sample) return res.status(404).json({ error: "Sample not found" });
  const bids = await prisma.bid.findMany({
    where: { sampleId: sample.id },
    include: { user: true },
    orderBy: [{ createdAt: "desc" }, { amountCents: "desc" }],
    take: 50,
  });
  res.json({
    sample: serializeSample(sample, req.userId),
    bids: bids.map((b) => ({
      id: b.id,
      amountCents: b.amountCents,
      createdAt: b.createdAt,
      user: { id: b.user.id, username: b.user.username, avatarSeed: b.user.avatarSeed },
    })),
  });
});

function runUpload(req: Parameters<typeof uploadFields>[0], res: Parameters<typeof uploadFields>[1]) {
  return new Promise<void>((resolve, reject) => {
    uploadFields(req, res, (err) => (err ? reject(err) : resolve()));
  });
}

router.post("/", requireAuth, async (req, res) => {
  try {
    await runUpload(req, res);
  } catch (err) {
    return res.status(400).json({ error: err instanceof Error ? err.message : "Upload failed" });
  }

  const files = req.files as
    | { preview?: Express.Multer.File[]; full?: Express.Multer.File[]; image?: Express.Multer.File[] }
    | undefined;
  const previewFile = files?.preview?.[0];
  const fullFile = files?.full?.[0];
  const imageFile = files?.image?.[0];

  async function cleanup() {
    if (previewFile) await fsp.unlink(previewFile.path).catch(() => {});
    if (fullFile) await fsp.unlink(fullFile.path).catch(() => {});
    if (imageFile) await fsp.unlink(imageFile.path).catch(() => {});
  }

  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    await cleanup();
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
  }
  if (!previewFile || !fullFile || !imageFile) {
    await cleanup();
    return res.status(400).json({ error: "A preview clip, a full file, and a cover image are all required" });
  }

  const previewBuffer = await fsp.readFile(previewFile.path);
  const previewDuration = getPreviewDurationSeconds(previewBuffer, previewFile.mimetype);
  if (previewDuration !== null) {
    if (
      previewDuration < PREVIEW_MIN_SECONDS - DURATION_TOLERANCE_SECONDS ||
      previewDuration > PREVIEW_MAX_SECONDS + DURATION_TOLERANCE_SECONDS
    ) {
      await cleanup();
      return res.status(400).json({
        error: `Preview clip must be ${PREVIEW_MIN_SECONDS}-${PREVIEW_MAX_SECONDS}s long (got ${previewDuration.toFixed(1)}s)`,
      });
    }
  } else if (previewFile.size < PREVIEW_MIN_BYTES || previewFile.size > PREVIEW_MAX_BYTES) {
    // Couldn't parse exact duration (unusual encoder) — fall back to the byte-size guard.
    await cleanup();
    return res
      .status(400)
      .json({ error: `Preview clip must be roughly ${PREVIEW_MIN_SECONDS}-${PREVIEW_MAX_SECONDS}s long` });
  }

  const fullBuffer = await fsp.readFile(fullFile.path);
  const fullDuration = getWavDurationSeconds(fullBuffer);
  if (fullDuration === null) {
    await cleanup();
    return res.status(400).json({ error: "Full file must be a valid WAV file" });
  }
  if (fullDuration < FULL_MIN_SECONDS - DURATION_TOLERANCE_SECONDS || fullDuration > FULL_MAX_SECONDS + DURATION_TOLERANCE_SECONDS) {
    await cleanup();
    return res.status(400).json({
      error: `Full file must be ${FULL_MIN_SECONDS}-${FULL_MAX_SECONDS}s long (got ${fullDuration.toFixed(1)}s)`,
    });
  }

  const imageBuffer = await fsp.readFile(imageFile.path);
  if (!detectImageType(imageBuffer)) {
    await cleanup();
    return res.status(400).json({ error: "Cover image file is not a valid JPEG, PNG, or WEBP" });
  }

  const data = parsed.data;
  const waveform = buildWaveform(fullBuffer);
  const previewUrl = `/uploads/${previewFile.filename}`;
  const fullAudioUrl = `/uploads/${fullFile.filename}`;
  const imageUrl = `/uploads/${imageFile.filename}`;
  const endTime = new Date(Date.now() + data.durationMinutes * 60_000);

  const sample = await prisma.sample.create({
    data: {
      title: data.title,
      description: data.description,
      genre: data.genre,
      bpm: data.bpm,
      key: data.key,
      imageUrl,
      previewUrl,
      fullAudioUrl,
      waveform: JSON.stringify(waveform),
      startingPriceCents: data.startingPriceCents,
      currentPriceCents: data.startingPriceCents,
      buyNowPriceCents: data.buyNowPriceCents,
      endTime,
      sellerId: req.userId!,
    },
    include: { seller: true, winner: true },
  });

  res.status(201).json({ sample: serializeSample(sample, req.userId) });
});

router.get("/:id/preview", async (req, res) => {
  const sample = await prisma.sample.findUnique({ where: { id: req.params.id } });
  if (!sample) return res.status(404).json({ error: "Sample not found" });
  const filePath = path.join(UPLOAD_DIR, path.basename(sample.previewUrl));
  const stat = await fsp.stat(filePath).catch(() => null);
  if (!stat) return res.status(404).json({ error: "Audio file missing" });

  res.setHeader("Content-Type", mimeForFile(filePath));
  res.setHeader("Content-Length", String(stat.size));
  fs.createReadStream(filePath).pipe(res);
});

router.get("/:id/full", requireAuth, async (req, res) => {
  const sample = await prisma.sample.findUnique({ where: { id: req.params.id } });
  if (!sample) return res.status(404).json({ error: "Sample not found" });
  const isSeller = req.userId === sample.sellerId;
  const isWinner = req.userId === sample.winnerId && sample.status === "ended";
  if (!isSeller && !isWinner) {
    return res.status(403).json({ error: "You do not have access to the full file" });
  }
  const filePath = path.join(UPLOAD_DIR, path.basename(sample.fullAudioUrl));
  const stat = await fsp.stat(filePath).catch(() => null);
  if (!stat) return res.status(404).json({ error: "Audio file missing" });
  res.setHeader("Content-Type", mimeForFile(filePath));
  res.setHeader("Content-Length", String(stat.size));
  fs.createReadStream(filePath).pipe(res);
});

export default router;
