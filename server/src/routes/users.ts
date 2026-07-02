import { Router } from "express";
import { prisma } from "../lib/prisma.js";

const router = Router();

router.get("/:username", async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { username: req.params.username },
    include: {
      samplesListed: {
        include: { winner: true, _count: { select: { bids: true } } },
        orderBy: { createdAt: "desc" },
      },
      samplesWon: {
        include: { seller: true, certificate: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!user) return res.status(404).json({ error: "User not found" });

  res.json({
    user: {
      id: user.id,
      username: user.username,
      bio: user.bio,
      avatarSeed: user.avatarSeed,
      verified: user.verified,
      accountType: user.accountType,
      createdAt: user.createdAt,
    },
    listed: user.samplesListed.map((s) => ({
      id: s.id,
      title: s.title,
      status: s.status,
      currentPriceCents: s.currentPriceCents,
      endTime: s.endTime,
      bidCount: s._count.bids,
      winner: s.winner ? { username: s.winner.username } : null,
    })),
    won: user.samplesWon.map((s) => ({
      id: s.id,
      title: s.title,
      currentPriceCents: s.currentPriceCents,
      seller: { username: s.seller.username },
      certificateCode: s.certificate?.code,
    })),
  });
});

export default router;
