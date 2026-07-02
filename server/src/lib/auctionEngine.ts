import crypto from "node:crypto";
import { prisma } from "./prisma.js";
import { getIo, sampleRoom } from "./io.js";
import { notify } from "./notify.js";

export async function finalizeAuction(sampleId: string) {
  const sample = await prisma.sample.findUnique({ where: { id: sampleId } });
  if (!sample || sample.status !== "live") return;

  const topBid = await prisma.bid.findFirst({
    where: { sampleId },
    orderBy: { amountCents: "desc" },
  });

  const updated = await prisma.sample.update({
    where: { id: sampleId },
    data: {
      status: "ended",
      winnerId: topBid?.userId,
    },
    include: { seller: true, winner: true },
  });

  if (topBid) {
    const contentHash = crypto
      .createHash("sha256")
      .update(`${sample.id}:${topBid.userId}:${topBid.amountCents}:${Date.now()}`)
      .digest("hex");
    const code = `SMPL-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
    await prisma.certificate.create({
      data: { sampleId, code, contentHash },
    });

    await notify(
      topBid.userId,
      "won",
      `You won "${sample.title}" for $${(topBid.amountCents / 100).toFixed(2)}. It's yours forever.`,
      sample.id
    );
    await notify(
      sample.sellerId,
      "sold",
      `"${sample.title}" sold for $${(topBid.amountCents / 100).toFixed(2)}.`,
      sample.id
    );

    const losingBidders = await prisma.bid.findMany({
      where: { sampleId, userId: { not: topBid.userId } },
      distinct: ["userId"],
      select: { userId: true },
    });
    for (const loser of losingBidders) {
      await notify(loser.userId, "lost", `The auction for "${sample.title}" has ended without you.`, sample.id);
    }
  } else {
    await notify(sample.sellerId, "unsold", `"${sample.title}" ended with no bids.`, sample.id);
  }

  getIo().to(sampleRoom(sampleId)).emit("auction:ended", {
    sampleId,
    winner: updated.winner ? { id: updated.winner.id, username: updated.winner.username } : null,
  });

  if (topBid && updated.winner) {
    getIo().emit("activity", {
      id: `sold-${sampleId}`,
      type: "sold",
      sampleId: sample.id,
      sampleTitle: sample.title,
      username: updated.winner.username,
      avatarSeed: updated.winner.avatarSeed,
      amountCents: topBid.amountCents,
      createdAt: new Date(),
    });
  }
}

export async function sweepExpiredAuctions() {
  const expired = await prisma.sample.findMany({
    where: { status: "live", endTime: { lte: new Date() } },
    select: { id: true },
  });
  for (const sample of expired) {
    await finalizeAuction(sample.id);
  }
}
