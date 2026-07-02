import { Router } from "express";
import { prisma } from "../lib/prisma.js";

const router = Router();

router.get("/", async (_req, res) => {
  const wonSamples = await prisma.sample.findMany({
    where: { status: "ended", winnerId: { not: null } },
    select: { winnerId: true, sellerId: true, currentPriceCents: true },
  });

  const buyerTotals = new Map<string, { spentCents: number; wins: number }>();
  const sellerTotals = new Map<string, { earnedCents: number; sales: number }>();

  for (const s of wonSamples) {
    if (s.winnerId) {
      const entry = buyerTotals.get(s.winnerId) ?? { spentCents: 0, wins: 0 };
      entry.spentCents += s.currentPriceCents;
      entry.wins += 1;
      buyerTotals.set(s.winnerId, entry);
    }
    const sellerEntry = sellerTotals.get(s.sellerId) ?? { earnedCents: 0, sales: 0 };
    sellerEntry.earnedCents += s.currentPriceCents;
    sellerEntry.sales += 1;
    sellerTotals.set(s.sellerId, sellerEntry);
  }

  const userIds = [...new Set([...buyerTotals.keys(), ...sellerTotals.keys()])];
  const users = await prisma.user.findMany({ where: { id: { in: userIds } } });
  const userMap = new Map(users.map((u) => [u.id, u]));

  const topBuyers = [...buyerTotals.entries()]
    .map(([userId, v]) => {
      const u = userMap.get(userId);
      return u ? { user: { id: u.id, username: u.username, verified: u.verified, avatarSeed: u.avatarSeed }, ...v } : null;
    })
    .filter(Boolean)
    .sort((a: any, b: any) => b.spentCents - a.spentCents)
    .slice(0, 20);

  const topSellers = [...sellerTotals.entries()]
    .map(([userId, v]) => {
      const u = userMap.get(userId);
      return u ? { user: { id: u.id, username: u.username, verified: u.verified, avatarSeed: u.avatarSeed }, ...v } : null;
    })
    .filter(Boolean)
    .sort((a: any, b: any) => b.earnedCents - a.earnedCents)
    .slice(0, 20);

  res.json({ topBuyers, topSellers });
});

export default router;
