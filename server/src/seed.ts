import "dotenv/config";
import path from "node:path";
import fsp from "node:fs/promises";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import bcrypt from "bcryptjs";
import { prisma } from "./lib/prisma.js";
import { generateToneWav } from "./lib/genTone.js";
import { buildWaveform } from "./lib/waveform.js";
import { generateCoverArtSvg } from "./lib/coverArt.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = path.join(__dirname, "..", "uploads");

const DEMO_PASSWORD = "password123";

const USERS = [
  { username: "kaidenmakes", email: "kaiden@demo.smplbid.com", verified: true, bio: "Grammy-nominated engineer. Drums, bass, texture.", accountType: "seller" },
  { username: "luna_waves", email: "luna@demo.smplbid.com", verified: true, bio: "Ambient & cinematic textures from Reykjavik.", accountType: "seller" },
  { username: "trapgodhenry", email: "henry@demo.smplbid.com", verified: false, bio: "808s, vocal chops, late-night sessions.", accountType: "both" },
  { username: "sundriedsamples", email: "sun@demo.smplbid.com", verified: true, bio: "Field recordings + analog synth layers.", accountType: "seller" },
  { username: "mira_beats", email: "mira@demo.smplbid.com", verified: false, bio: "Collector. Always hunting for the rarest one-shots.", accountType: "buyer" },
  { username: "dj_ohmega", email: "ohmega@demo.smplbid.com", verified: false, bio: "House & techno producer, 12 years deep.", accountType: "both" },
];

const GENRES = [
  { genre: "Trap", bpm: 140, key: "F# Minor", freq: 110 },
  { genre: "Lo-fi", bpm: 82, key: "C Major", freq: 220 },
  { genre: "Ambient", bpm: 60, key: "D Minor", freq: 174 },
  { genre: "House", bpm: 124, key: "A Minor", freq: 196 },
  { genre: "Drill", bpm: 142, key: "G Minor", freq: 98 },
  { genre: "Synthwave", bpm: 100, key: "E Minor", freq: 165 },
];

const SAMPLE_NAMES = [
  "Midnight Static Loop",
  "Velvet Chop 3AM",
  "Rusted Bell Texture",
  "Glass Vocal Fragment",
  "Analog Sub Growl",
  "Neon Drift Pad",
  "Cassette Hiss Break",
  "Obsidian Snare Roll",
  "Faded Tape Melody",
  "Chrome Hat Pattern",
];

function randChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function resetUploads() {
  await fsp.rm(UPLOAD_DIR, { recursive: true, force: true });
  await fsp.mkdir(UPLOAD_DIR, { recursive: true });
}

async function writeWav(freq: number, durationSeconds: number): Promise<{ url: string; buffer: Buffer }> {
  const buffer = generateToneWav({ durationSeconds, baseFreq: freq });
  const filename = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}.wav`;
  await fsp.writeFile(path.join(UPLOAD_DIR, filename), buffer);
  return { url: `/uploads/${filename}`, buffer };
}

async function writeCoverArt(seed: string): Promise<string> {
  const svg = generateCoverArtSvg(seed);
  const filename = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}.svg`;
  await fsp.writeFile(path.join(UPLOAD_DIR, filename), svg);
  return `/uploads/${filename}`;
}

// Preview and full are generated from the same deterministic tone function, so the
// preview's first ~12s are numerically identical to the start of the full 25s track —
// a genuine excerpt, matching what the real two-file upload flow produces.
async function writeTonePair(freq: number): Promise<{ previewUrl: string; fullUrl: string; fullBuffer: Buffer }> {
  const [preview, full] = await Promise.all([writeWav(freq, 12), writeWav(freq, 25)]);
  return { previewUrl: preview.url, fullUrl: full.url, fullBuffer: full.buffer };
}

async function main() {
  console.log("Resetting database...");
  await prisma.certificate.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.bid.deleteMany();
  await prisma.sample.deleteMany();
  await prisma.user.deleteMany();
  await resetUploads();

  console.log("Creating users...");
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);
  const users = [];
  for (const u of USERS) {
    users.push(
      await prisma.user.create({
        data: { ...u, passwordHash },
      })
    );
  }

  console.log("Creating ended (historical) auctions for leaderboard...");
  for (let i = 0; i < 10; i++) {
    const seller = randChoice(users);
    let winnerCandidate = randChoice(users);
    while (winnerCandidate.id === seller.id) winnerCandidate = randChoice(users);

    const meta = randChoice(GENRES);
    const { previewUrl, fullUrl, fullBuffer } = await writeTonePair(meta.freq * (0.85 + Math.random() * 0.3));
    const imageUrl = await writeCoverArt(`${meta.genre}-${i}-${Date.now()}`);
    const startingPriceCents = 500 + Math.floor(Math.random() * 2000);
    const finalPriceCents = startingPriceCents + 500 + Math.floor(Math.random() * 15000);
    const endTime = new Date(Date.now() - (i + 1) * 3 * 60 * 60 * 1000);

    const sample = await prisma.sample.create({
      data: {
        title: `${randChoice(SAMPLE_NAMES)} #${i + 1}`,
        description: "A one-of-one exclusive sample. Once sold, it's gone forever — no re-sale, no re-use by anyone else.",
        genre: meta.genre,
        bpm: meta.bpm,
        key: meta.key,
        imageUrl,
        previewUrl,
        fullAudioUrl: fullUrl,
        waveform: JSON.stringify(buildWaveform(fullBuffer)),
        startingPriceCents,
        currentPriceCents: finalPriceCents,
        status: "ended",
        startTime: new Date(endTime.getTime() - 60 * 60 * 1000),
        endTime,
        sellerId: seller.id,
        winnerId: winnerCandidate.id,
      },
    });

    await prisma.bid.create({
      data: { sampleId: sample.id, userId: winnerCandidate.id, amountCents: finalPriceCents },
    });

    const contentHash = crypto
      .createHash("sha256")
      .update(`${sample.id}:${winnerCandidate.id}:${finalPriceCents}`)
      .digest("hex");
    await prisma.certificate.create({
      data: {
        sampleId: sample.id,
        code: `SMPL-${crypto.randomBytes(4).toString("hex").toUpperCase()}`,
        contentHash,
      },
    });
  }

  console.log("Creating live auctions...");
  const liveDurations = [65, 70, 80, 90, 100, 120, 150, 180, 210, 240, 300, 360, 480, 600, 720, 1000, 1440, 2160, 3000, 4320, 7200, 10080, 14400, 20160, 40320]; // minutes: 25 auctions, all >1h
  for (let i = 0; i < liveDurations.length; i++) {
    const seller = randChoice(users);
    const meta = randChoice(GENRES);
    const { previewUrl, fullUrl, fullBuffer } = await writeTonePair(meta.freq * (0.85 + Math.random() * 0.3));
    const imageUrl = await writeCoverArt(`${meta.genre}-live-${i}-${Date.now()}`);
    const startingPriceCents = 500 + Math.floor(Math.random() * 1500);

    const sample = await prisma.sample.create({
      data: {
        title: `${randChoice(SAMPLE_NAMES)} #${i + 100}`,
        description: "A one-of-one exclusive sample. Once sold, it's gone forever — no re-sale, no re-use by anyone else.",
        genre: meta.genre,
        bpm: meta.bpm,
        key: meta.key,
        imageUrl,
        previewUrl,
        fullAudioUrl: fullUrl,
        waveform: JSON.stringify(buildWaveform(fullBuffer)),
        startingPriceCents,
        currentPriceCents: startingPriceCents,
        buyNowPriceCents: Math.random() > 0.6 ? startingPriceCents + 20000 + Math.floor(Math.random() * 30000) : null,
        endTime: new Date(Date.now() + liveDurations[i] * 60 * 1000),
        sellerId: seller.id,
      },
    });

    // Give some samples an existing bid history so the arena doesn't look empty.
    if (i % 3 !== 0) {
      const numBids = 1 + Math.floor(Math.random() * 4);
      let price = startingPriceCents;
      for (let b = 0; b < numBids; b++) {
        let bidder = randChoice(users);
        while (bidder.id === seller.id) bidder = randChoice(users);
        price += 300 + Math.floor(Math.random() * 1200);
        await prisma.bid.create({
          data: { sampleId: sample.id, userId: bidder.id, amountCents: price },
        });
      }
      await prisma.sample.update({ where: { id: sample.id }, data: { currentPriceCents: price } });
    }
  }

  console.log(`\nSeed complete. Demo login for any user: password "${DEMO_PASSWORD}"`);
  console.log("Users:", USERS.map((u) => u.username).join(", "));
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
