import { Router } from "express";
import { prisma } from "../lib/prisma.js";

const router = Router();

router.get("/:code", async (req, res) => {
  const certificate = await prisma.certificate.findUnique({
    where: { code: req.params.code },
    include: {
      sample: {
        include: { seller: true, winner: true },
      },
    },
  });
  if (!certificate) return res.status(404).json({ error: "Certificate not found" });

  res.json({
    certificate: {
      code: certificate.code,
      issuedAt: certificate.issuedAt,
      contentHash: certificate.contentHash,
      sample: {
        id: certificate.sample.id,
        title: certificate.sample.title,
        genre: certificate.sample.genre,
        bpm: certificate.sample.bpm,
        key: certificate.sample.key,
        finalPriceCents: certificate.sample.currentPriceCents,
        seller: { username: certificate.sample.seller.username, verified: certificate.sample.seller.verified },
        winner: certificate.sample.winner ? { username: certificate.sample.winner.username } : null,
      },
    },
  });
});

export default router;
