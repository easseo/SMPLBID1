/**
 * Tests for server/src/lib/auctionEngine.ts — finalizeAuction
 *
 * Covers:
 *  - Happy path: winner assigned, certificate created, won/sold/lost notifications sent
 *  - No-bid branch: status=ended, no certificate, unsold notification to seller
 *  - Already-ended branch: idempotent (no-op)
 */
import { describe, it, expect } from "vitest";
import { finalizeAuction } from "../lib/auctionEngine.js";
import { prisma } from "../lib/prisma.js";
import { createUser, createSample, createBid } from "./fixtures.js";

describe("finalizeAuction — happy path (bids exist)", () => {
  it("sets status to 'ended' and assigns the top bidder as winner", async () => {
    const seller = await createUser();
    const bidder = await createUser();
    const sample = await createSample({ sellerId: seller.id });

    await createBid(sample.id, bidder.id, 5000);

    await finalizeAuction(sample.id);

    const updated = await prisma.sample.findUniqueOrThrow({ where: { id: sample.id } });
    expect(updated.status).toBe("ended");
    expect(updated.winnerId).toBe(bidder.id);
  });

  it("picks the highest bid when multiple bids exist", async () => {
    const seller = await createUser();
    const bidder1 = await createUser();
    const bidder2 = await createUser();
    const sample = await createSample({ sellerId: seller.id });

    await createBid(sample.id, bidder1.id, 3000);
    await createBid(sample.id, bidder2.id, 7000);
    await createBid(sample.id, bidder1.id, 5000); // lower than bidder2's

    await finalizeAuction(sample.id);

    const updated = await prisma.sample.findUniqueOrThrow({ where: { id: sample.id } });
    expect(updated.winnerId).toBe(bidder2.id);
  });

  it("creates a Certificate row with a SMPL- code and content hash", async () => {
    const seller = await createUser();
    const bidder = await createUser();
    const sample = await createSample({ sellerId: seller.id });
    await createBid(sample.id, bidder.id, 4000);

    await finalizeAuction(sample.id);

    const cert = await prisma.certificate.findUnique({ where: { sampleId: sample.id } });
    expect(cert).not.toBeNull();
    expect(cert!.code).toMatch(/^SMPL-[0-9A-F]{8}$/);
    expect(cert!.contentHash).toHaveLength(64); // SHA-256 hex
  });

  it("sends a 'won' notification to the winner", async () => {
    const seller = await createUser();
    const bidder = await createUser();
    const sample = await createSample({ sellerId: seller.id });
    await createBid(sample.id, bidder.id, 2500);

    await finalizeAuction(sample.id);

    const wonNotif = await prisma.notification.findFirst({
      where: { userId: bidder.id, type: "won" },
    });
    expect(wonNotif).not.toBeNull();
    expect(wonNotif!.message).toContain("$25.00");
    expect(wonNotif!.sampleId).toBe(sample.id);
  });

  it("sends a 'sold' notification to the seller", async () => {
    const seller = await createUser();
    const bidder = await createUser();
    const sample = await createSample({ sellerId: seller.id });
    await createBid(sample.id, bidder.id, 3000);

    await finalizeAuction(sample.id);

    const soldNotif = await prisma.notification.findFirst({
      where: { userId: seller.id, type: "sold" },
    });
    expect(soldNotif).not.toBeNull();
    expect(soldNotif!.message).toContain("$30.00");
  });

  it("sends 'lost' notifications to all non-winning bidders", async () => {
    const seller = await createUser();
    const winner = await createUser();
    const loser1 = await createUser();
    const loser2 = await createUser();
    const sample = await createSample({ sellerId: seller.id });

    await createBid(sample.id, loser1.id, 1000);
    await createBid(sample.id, loser2.id, 1500);
    await createBid(sample.id, winner.id, 5000);

    await finalizeAuction(sample.id);

    const loser1Notif = await prisma.notification.findFirst({
      where: { userId: loser1.id, type: "lost" },
    });
    const loser2Notif = await prisma.notification.findFirst({
      where: { userId: loser2.id, type: "lost" },
    });
    expect(loser1Notif).not.toBeNull();
    expect(loser2Notif).not.toBeNull();

    // The winner should NOT receive a 'lost' notification
    const winnerLostNotif = await prisma.notification.findFirst({
      where: { userId: winner.id, type: "lost" },
    });
    expect(winnerLostNotif).toBeNull();
  });
});

describe("finalizeAuction — no-bid branch", () => {
  it("sets status to 'ended' when there are no bids", async () => {
    const seller = await createUser();
    const sample = await createSample({ sellerId: seller.id });

    await finalizeAuction(sample.id);

    const updated = await prisma.sample.findUniqueOrThrow({ where: { id: sample.id } });
    expect(updated.status).toBe("ended");
    expect(updated.winnerId).toBeNull();
  });

  it("does NOT create a Certificate when there are no bids", async () => {
    const seller = await createUser();
    const sample = await createSample({ sellerId: seller.id });

    await finalizeAuction(sample.id);

    const cert = await prisma.certificate.findUnique({ where: { sampleId: sample.id } });
    expect(cert).toBeNull();
  });

  it("sends an 'unsold' notification to the seller", async () => {
    const seller = await createUser();
    const sample = await createSample({ sellerId: seller.id });

    await finalizeAuction(sample.id);

    const unsoldNotif = await prisma.notification.findFirst({
      where: { userId: seller.id, type: "unsold" },
    });
    expect(unsoldNotif).not.toBeNull();
    expect(unsoldNotif!.sampleId).toBe(sample.id);
  });

  it("sends no 'won', 'sold', or 'lost' notifications when there are no bids", async () => {
    const seller = await createUser();
    const sample = await createSample({ sellerId: seller.id });

    await finalizeAuction(sample.id);

    const wrongNotifs = await prisma.notification.findMany({
      where: { type: { in: ["won", "sold", "lost"] } },
    });
    expect(wrongNotifs).toHaveLength(0);
  });
});

describe("finalizeAuction — already-ended branch (idempotent)", () => {
  it("is a no-op when the sample is already ended", async () => {
    const seller = await createUser();
    const bidder = await createUser();
    // Create the sample already ended with a winner
    const sample = await createSample({ sellerId: seller.id, status: "ended" });
    await prisma.sample.update({
      where: { id: sample.id },
      data: { winnerId: bidder.id },
    });

    const notifsBefore = await prisma.notification.count();
    const certsBefore = await prisma.certificate.count();

    await finalizeAuction(sample.id); // should be a no-op

    const notifsAfter = await prisma.notification.count();
    const certsAfter = await prisma.certificate.count();

    expect(notifsAfter).toBe(notifsBefore);
    expect(certsAfter).toBe(certsBefore);
  });

  it("does not change the winner when called twice (idempotent)", async () => {
    const seller = await createUser();
    const winner = await createUser();
    const lateBidder = await createUser();
    const sample = await createSample({ sellerId: seller.id });
    await createBid(sample.id, winner.id, 5000);

    // First call — finalizes normally
    await finalizeAuction(sample.id);

    // Add a higher bid after finalization (should not matter)
    await prisma.bid.create({
      data: { sampleId: sample.id, userId: lateBidder.id, amountCents: 9999 },
    });

    // Second call — should be a no-op because status is now "ended"
    await finalizeAuction(sample.id);

    const updated = await prisma.sample.findUniqueOrThrow({ where: { id: sample.id } });
    expect(updated.winnerId).toBe(winner.id); // winner unchanged
  });
});
