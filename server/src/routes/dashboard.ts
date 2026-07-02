import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../lib/auth.js";

const router = Router();

router.get("/", requireAuth, async (req, res) => {
  const userId = req.userId!;

  const [activeListings, activeBidSamples, wonSamples, soldSamples] = await Promise.all([
    prisma.sample.findMany({
      where: { sellerId: userId, status: "live" },
      include: { _count: { select: { bids: true } } },
      orderBy: { endTime: "asc" },
    }),
    prisma.sample.findMany({
      where: { status: "live", bids: { some: { userId } }, sellerId: { not: userId } },
      include: { _count: { select: { bids: true } } },
      orderBy: { endTime: "asc" },
    }),
    prisma.sample.findMany({
      where: { winnerId: userId, status: "ended" },
      select: { currentPriceCents: true },
    }),
    prisma.sample.findMany({
      where: { sellerId: userId, status: "ended", winnerId: { not: null } },
      select: { currentPriceCents: true },
    }),
  ]);

  const totalSpentCents = wonSamples.reduce((sum, s) => sum + s.currentPriceCents, 0);
  const totalEarnedCents = soldSamples.reduce((sum, s) => sum + s.currentPriceCents, 0);

  res.json({
    stats: {
      activeListingsCount: activeListings.length,
      activeBidsCount: activeBidSamples.length,
      wonCount: wonSamples.length,
      totalSpentCents,
      soldCount: soldSamples.length,
      totalEarnedCents,
    },
    activeListings: activeListings.map((s) => ({
      id: s.id,
      title: s.title,
      imageUrl: s.imageUrl,
      currentPriceCents: s.currentPriceCents,
      endTime: s.endTime,
      bidCount: s._count.bids,
    })),
    activeBids: activeBidSamples.map((s) => ({
      id: s.id,
      title: s.title,
      imageUrl: s.imageUrl,
      currentPriceCents: s.currentPriceCents,
      endTime: s.endTime,
      bidCount: s._count.bids,
    })),
  });
});

export default router;
