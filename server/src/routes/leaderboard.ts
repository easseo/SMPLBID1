import { Router } from "express";
import { prisma } from "../lib/prisma.js";

const router = Router();

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

router.get("/", async (_req, res) => {
  const weekAgo = new Date(Date.now() - WEEK_MS);

  const wonThisWeek = await prisma.sample.findMany({
    where: { status: "ended", winnerId: { not: null }, endTime: { gte: weekAgo } },
    select: { sellerId: true, currentPriceCents: true },
  });

  const sellerTotals = new Map<string, { earnedCents: number; sales: number }>();
  for (const s of wonThisWeek) {
    const entry = sellerTotals.get(s.sellerId) ?? { earnedCents: 0, sales: 0 };
    entry.earnedCents += s.currentPriceCents;
    entry.sales += 1;
    sellerTotals.set(s.sellerId, entry);
  }

  const sellerIds = [...sellerTotals.keys()];
  const sellers = await prisma.user.findMany({ where: { id: { in: sellerIds } } });
  const sellerMap = new Map(sellers.map((u) => [u.id, u]));

  const topCreators = [...sellerTotals.entries()]
    .map(([userId, v]) => {
      const u = sellerMap.get(userId);
      return u ? { user: { id: u.id, username: u.username, verified: u.verified, avatarSeed: u.avatarSeed }, ...v } : null;
    })
    .filter((v): v is NonNullable<typeof v> => v !== null)
    .sort((a, b) => b.earnedCents - a.earnedCents)
    .slice(0, 10);

  const liveSamples = await prisma.sample.findMany({
    where: { status: "live" },
    include: { _count: { select: { bids: true } } },
    orderBy: { bids: { _count: "desc" } },
    take: 10,
  });

  const mostContested = liveSamples
    .filter((s) => s._count.bids > 0)
    .map((s) => ({
      id: s.id,
      title: s.title,
      bidCount: s._count.bids,
      currentPriceCents: s.currentPriceCents,
    }));

  res.json({ topCreators, mostContested });
});

export default router;
