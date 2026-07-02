import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../lib/auth.js";
import { getIo, sampleRoom } from "../lib/io.js";
import { notify } from "../lib/notify.js";
import { finalizeAuction } from "../lib/auctionEngine.js";

const router = Router();

const bidSchema = z.object({
  amountCents: z.coerce.number().int().min(1).max(100_000_00),
});

router.post("/samples/:id/bids", requireAuth, async (req, res) => {
  const parsed = bidSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid bid amount" });
  }
  const { amountCents } = parsed.data;
  const sampleId = req.params.id;

  const sample = await prisma.sample.findUnique({ where: { id: sampleId } });
  if (!sample) return res.status(404).json({ error: "Sample not found" });
  if (sample.status !== "live" || sample.endTime.getTime() <= Date.now()) {
    return res.status(400).json({ error: "This auction is no longer live" });
  }
  if (sample.sellerId === req.userId) {
    return res.status(403).json({ error: "You cannot bid on your own sample" });
  }

  const topBid = await prisma.bid.findFirst({
    where: { sampleId },
    orderBy: { amountCents: "desc" },
  });
  if (topBid && topBid.userId === req.userId) {
    return res.status(400).json({ error: "You are already the highest bidder" });
  }

  const minValid = topBid ? topBid.amountCents + sample.minIncrementCents : sample.startingPriceCents;
  if (amountCents < minValid) {
    return res.status(400).json({ error: `Bid must be at least $${(minValid / 100).toFixed(2)}` });
  }

  const now = Date.now();
  const msRemaining = sample.endTime.getTime() - now;
  const antiSnipeMs = sample.antiSnipeSeconds * 1000;
  const newEndTime = msRemaining < antiSnipeMs ? new Date(now + antiSnipeMs) : sample.endTime;
  const extended = newEndTime.getTime() !== sample.endTime.getTime();

  const bid = await prisma.bid.create({
    data: { sampleId, userId: req.userId!, amountCents },
    include: { user: true },
  });
  await prisma.sample.update({
    where: { id: sampleId },
    data: { currentPriceCents: amountCents, endTime: newEndTime },
  });

  getIo().to(sampleRoom(sampleId)).emit("bid:new", {
    sampleId,
    bid: {
      id: bid.id,
      amountCents: bid.amountCents,
      createdAt: bid.createdAt,
      user: { id: bid.user.id, username: bid.user.username, avatarSeed: bid.user.avatarSeed },
    },
    currentPriceCents: amountCents,
    endTime: newEndTime,
    extended,
  });

  getIo().emit("activity", {
    id: bid.id,
    type: "bid",
    sampleId: sample.id,
    sampleTitle: sample.title,
    username: bid.user.username,
    avatarSeed: bid.user.avatarSeed,
    amountCents,
    createdAt: bid.createdAt,
  });

  if (topBid && topBid.userId !== req.userId) {
    await notify(topBid.userId, "outbid", `You've been outbid on "${sample.title}".`, sample.id);
  }

  if (sample.buyNowPriceCents && amountCents >= sample.buyNowPriceCents) {
    await finalizeAuction(sampleId);
  }

  res.status(201).json({
    bid: { id: bid.id, amountCents: bid.amountCents, createdAt: bid.createdAt },
    currentPriceCents: amountCents,
    endTime: newEndTime,
    extended,
  });
});

export default router;
