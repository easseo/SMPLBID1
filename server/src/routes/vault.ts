import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../lib/auth.js";

const router = Router();

router.get("/", requireAuth, async (req, res) => {
  const userId = req.userId!;

  const won = await prisma.sample.findMany({
    where: { winnerId: userId, status: "ended" },
    include: { seller: true, certificate: true },
    orderBy: { endTime: "desc" },
  });

  res.json({
    samples: won.map((s) => ({
      id: s.id,
      title: s.title,
      genre: s.genre,
      bpm: s.bpm,
      key: s.key,
      imageUrl: s.imageUrl,
      finalPriceCents: s.currentPriceCents,
      endTime: s.endTime,
      seller: { username: s.seller.username, verified: s.seller.verified },
      hasStems: Boolean(s.stemsUrl),
      hasMidi: Boolean(s.midiUrl),
      certificateCode: s.certificate?.code ?? null,
    })),
  });
});

export default router;
