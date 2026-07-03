/**
 * Test fixtures — helpers to create consistent test data.
 */
import { prisma } from "../lib/prisma.js";

let counter = 0;
function uid() {
  return `test-${Date.now()}-${++counter}`;
}

export interface TestUser {
  id: string;
  username: string;
  email: string;
}

export async function createUser(overrides: Partial<{ username: string; email: string }> = {}): Promise<TestUser> {
  const tag = uid();
  const user = await prisma.user.create({
    data: {
      username: overrides.username ?? `user-${tag}`,
      email: overrides.email ?? `user-${tag}@test.com`,
      passwordHash: "hashed",
    },
  });
  return { id: user.id, username: user.username, email: user.email };
}

export interface SampleOptions {
  sellerId: string;
  status?: string;
  startingPriceCents?: number;
  currentPriceCents?: number;
  buyNowPriceCents?: number | null;
  minIncrementCents?: number;
  antiSnipeSeconds?: number;
  endTime?: Date;
}

export async function createSample(opts: SampleOptions) {
  const now = new Date();
  const endTime = opts.endTime ?? new Date(now.getTime() + 60 * 60 * 1000); // 1 hour from now
  return prisma.sample.create({
    data: {
      title: `Test Sample ${uid()}`,
      description: "A test sample",
      genre: "Hip-Hop",
      bpm: 120,
      key: "C",
      previewUrl: "/uploads/test-preview.mp3",
      fullAudioUrl: "/uploads/test-full.wav",
      waveform: "[]",
      startingPriceCents: opts.startingPriceCents ?? 1000,
      currentPriceCents: opts.currentPriceCents ?? opts.startingPriceCents ?? 1000,
      buyNowPriceCents: opts.buyNowPriceCents ?? null,
      minIncrementCents: opts.minIncrementCents ?? 100,
      antiSnipeSeconds: opts.antiSnipeSeconds ?? 30,
      status: opts.status ?? "live",
      endTime,
      sellerId: opts.sellerId,
    },
  });
}

export async function createBid(sampleId: string, userId: string, amountCents: number) {
  const bid = await prisma.bid.create({
    data: { sampleId, userId, amountCents },
  });
  await prisma.sample.update({
    where: { id: sampleId },
    data: { currentPriceCents: amountCents },
  });
  return bid;
}
