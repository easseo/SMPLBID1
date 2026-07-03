/**
 * Tests for server/src/routes/bids.ts
 *
 * Covers:
 *  - Minimum increment enforcement
 *  - Self-bid guard (403)
 *  - Ended-auction guard
 *  - Anti-snipe extension (endTime pushed forward inside window)
 *  - Buy-now trigger (auction finalized immediately)
 *  - 401 when not authenticated
 */
import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "./testApp.js";
import { signToken, COOKIE_NAME } from "../lib/auth.js";
import { prisma } from "../lib/prisma.js";
import { createUser, createSample, createBid } from "./fixtures.js";

/** Create a supertest agent pre-loaded with an auth cookie for userId. */
function authed(userId: string) {
  const token = signToken({ userId });
  return request(app).post("/api/samples/:id/bids").set("Cookie", `${COOKIE_NAME}=${token}`);
}

/** Generic authenticated POST helper so we can override the URL. */
function bid(userId: string, sampleId: string, amountCents: number) {
  const token = signToken({ userId });
  return request(app)
    .post(`/api/samples/${sampleId}/bids`)
    .set("Cookie", `${COOKIE_NAME}=${token}`)
    .send({ amountCents });
}

// ---------------------------------------------------------------------------
// Auth guard
// ---------------------------------------------------------------------------
describe("POST /api/samples/:id/bids — auth guard", () => {
  it("returns 401 when no auth cookie is set", async () => {
    const seller = await createUser();
    const sample = await createSample({ sellerId: seller.id });

    const res = await request(app)
      .post(`/api/samples/${sample.id}/bids`)
      .send({ amountCents: 2000 });

    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// Happy path
// ---------------------------------------------------------------------------
describe("POST /api/samples/:id/bids — happy path", () => {
  it("accepts a valid first bid at the starting price", async () => {
    const seller = await createUser();
    const bidder = await createUser();
    const sample = await createSample({ sellerId: seller.id, startingPriceCents: 1000 });

    const res = await bid(bidder.id, sample.id, 1000);

    expect(res.status).toBe(201);
    expect(res.body.bid.amountCents).toBe(1000);
    expect(res.body.currentPriceCents).toBe(1000);
  });

  it("creates a Bid row in the database", async () => {
    const seller = await createUser();
    const bidder = await createUser();
    const sample = await createSample({ sellerId: seller.id, startingPriceCents: 500 });

    await bid(bidder.id, sample.id, 500);

    const dbBid = await prisma.bid.findFirst({ where: { sampleId: sample.id, userId: bidder.id } });
    expect(dbBid).not.toBeNull();
    expect(dbBid!.amountCents).toBe(500);
  });

  it("updates Sample.currentPriceCents", async () => {
    const seller = await createUser();
    const bidder = await createUser();
    const sample = await createSample({ sellerId: seller.id, startingPriceCents: 1000 });

    await bid(bidder.id, sample.id, 1500);

    const updated = await prisma.sample.findUniqueOrThrow({ where: { id: sample.id } });
    expect(updated.currentPriceCents).toBe(1500);
  });
});

// ---------------------------------------------------------------------------
// Self-bid guard
// ---------------------------------------------------------------------------
describe("POST /api/samples/:id/bids — self-bid guard", () => {
  it("returns 403 when the seller tries to bid on their own sample", async () => {
    const seller = await createUser();
    const sample = await createSample({ sellerId: seller.id, startingPriceCents: 1000 });

    const res = await bid(seller.id, sample.id, 1000);

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/cannot bid on your own/i);
  });
});

// ---------------------------------------------------------------------------
// Ended-auction guard
// ---------------------------------------------------------------------------
describe("POST /api/samples/:id/bids — ended-auction guard", () => {
  it("returns 400 when sample.status is 'ended'", async () => {
    const seller = await createUser();
    const bidder = await createUser();
    const sample = await createSample({ sellerId: seller.id, status: "ended" });

    const res = await bid(bidder.id, sample.id, 1000);

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/no longer live/i);
  });

  it("returns 400 when endTime is in the past (even if status is 'live')", async () => {
    const seller = await createUser();
    const bidder = await createUser();
    const pastEndTime = new Date(Date.now() - 60 * 1000); // 1 minute ago
    const sample = await createSample({
      sellerId: seller.id,
      status: "live",
      endTime: pastEndTime,
    });

    const res = await bid(bidder.id, sample.id, 1000);

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/no longer live/i);
  });
});

// ---------------------------------------------------------------------------
// Minimum increment enforcement
// ---------------------------------------------------------------------------
describe("POST /api/samples/:id/bids — minimum increment", () => {
  it("returns 400 when first bid is below startingPriceCents", async () => {
    const seller = await createUser();
    const bidder = await createUser();
    const sample = await createSample({ sellerId: seller.id, startingPriceCents: 2000 });

    const res = await bid(bidder.id, sample.id, 1999);

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/\$20\.00/); // must be at least $20.00
  });

  it("returns 400 when subsequent bid is below currentPrice + minIncrement", async () => {
    const seller = await createUser();
    const bidder1 = await createUser();
    const bidder2 = await createUser();
    const sample = await createSample({
      sellerId: seller.id,
      startingPriceCents: 1000,
      minIncrementCents: 200,
    });

    // First bid by bidder1
    await bid(bidder1.id, sample.id, 1000);

    // bidder2 tries to bid only 100 cents above (not enough — increment is 200)
    const res = await bid(bidder2.id, sample.id, 1100);

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/\$12\.00/); // must be at least $12.00
  });

  it("accepts a bid at exactly the minimum required amount", async () => {
    const seller = await createUser();
    const bidder1 = await createUser();
    const bidder2 = await createUser();
    const sample = await createSample({
      sellerId: seller.id,
      startingPriceCents: 1000,
      minIncrementCents: 200,
    });

    await bid(bidder1.id, sample.id, 1000);

    // Exactly at minimum: 1000 + 200 = 1200
    const res = await bid(bidder2.id, sample.id, 1200);

    expect(res.status).toBe(201);
    expect(res.body.currentPriceCents).toBe(1200);
  });

  it("returns 400 when bidder is already the top bidder", async () => {
    const seller = await createUser();
    const bidder = await createUser();
    const sample = await createSample({ sellerId: seller.id, startingPriceCents: 1000 });

    await bid(bidder.id, sample.id, 1000);

    // Same bidder tries to bid again
    const res = await bid(bidder.id, sample.id, 2000);

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/already the highest bidder/i);
  });
});

// ---------------------------------------------------------------------------
// Anti-snipe extension
// ---------------------------------------------------------------------------
describe("POST /api/samples/:id/bids — anti-snipe extension", () => {
  it("extends endTime when bid lands within the anti-snipe window", async () => {
    const seller = await createUser();
    const bidder = await createUser();
    // End time 10 seconds from now, anti-snipe window is 30 seconds
    // so the bid lands inside the window → should extend
    const shortEndTime = new Date(Date.now() + 10 * 1000);
    const sample = await createSample({
      sellerId: seller.id,
      startingPriceCents: 1000,
      antiSnipeSeconds: 30,
      endTime: shortEndTime,
    });

    const res = await bid(bidder.id, sample.id, 1000);

    expect(res.status).toBe(201);
    expect(res.body.extended).toBe(true);

    // The new endTime should be at least 25 seconds from now (30 - some execution time)
    const newEndTime = new Date(res.body.endTime).getTime();
    expect(newEndTime).toBeGreaterThan(Date.now() + 25 * 1000);

    // DB should also reflect the extended endTime
    const updated = await prisma.sample.findUniqueOrThrow({ where: { id: sample.id } });
    expect(updated.endTime.getTime()).toBeGreaterThan(shortEndTime.getTime());
  });

  it("does NOT extend endTime when bid lands outside the anti-snipe window", async () => {
    const seller = await createUser();
    const bidder = await createUser();
    // End time 5 minutes from now — well outside the 30 second window
    const farEndTime = new Date(Date.now() + 5 * 60 * 1000);
    const sample = await createSample({
      sellerId: seller.id,
      startingPriceCents: 1000,
      antiSnipeSeconds: 30,
      endTime: farEndTime,
    });

    const res = await bid(bidder.id, sample.id, 1000);

    expect(res.status).toBe(201);
    expect(res.body.extended).toBe(false);

    // endTime should remain the same (within a 1-second tolerance for test execution)
    const responseEndTime = new Date(res.body.endTime).getTime();
    expect(Math.abs(responseEndTime - farEndTime.getTime())).toBeLessThan(1000);
  });
});

// ---------------------------------------------------------------------------
// Buy-now trigger
// ---------------------------------------------------------------------------
describe("POST /api/samples/:id/bids — buy-now trigger", () => {
  it("finalizes the auction immediately when bid meets the buy-now price", async () => {
    const seller = await createUser();
    const bidder = await createUser();
    const sample = await createSample({
      sellerId: seller.id,
      startingPriceCents: 1000,
      buyNowPriceCents: 5000,
    });

    const res = await bid(bidder.id, sample.id, 5000);

    expect(res.status).toBe(201);

    // Sample should now be finalized
    const updated = await prisma.sample.findUniqueOrThrow({ where: { id: sample.id } });
    expect(updated.status).toBe("ended");
    expect(updated.winnerId).toBe(bidder.id);

    // Certificate should exist
    const cert = await prisma.certificate.findUnique({ where: { sampleId: sample.id } });
    expect(cert).not.toBeNull();

    // Winner notification
    const wonNotif = await prisma.notification.findFirst({
      where: { userId: bidder.id, type: "won" },
    });
    expect(wonNotif).not.toBeNull();
  });

  it("does NOT finalize when bid is below buy-now price", async () => {
    const seller = await createUser();
    const bidder = await createUser();
    const sample = await createSample({
      sellerId: seller.id,
      startingPriceCents: 1000,
      buyNowPriceCents: 5000,
    });

    const res = await bid(bidder.id, sample.id, 1000);

    expect(res.status).toBe(201);

    const updated = await prisma.sample.findUniqueOrThrow({ where: { id: sample.id } });
    expect(updated.status).toBe("live");
    expect(updated.winnerId).toBeNull();
  });

  it("sends 'outbid' notification to the previous top bidder on buy-now trigger", async () => {
    const seller = await createUser();
    const firstBidder = await createUser();
    const buyNowBidder = await createUser();
    const sample = await createSample({
      sellerId: seller.id,
      startingPriceCents: 1000,
      buyNowPriceCents: 5000,
    });

    // First bid
    await bid(firstBidder.id, sample.id, 1000);

    // Buy-now bid — firstBidder gets outbid notification then loses
    await bid(buyNowBidder.id, sample.id, 5000);

    const outbidNotif = await prisma.notification.findFirst({
      where: { userId: firstBidder.id, type: "outbid" },
    });
    expect(outbidNotif).not.toBeNull();

    // firstBidder also gets a "lost" notification from finalization
    const lostNotif = await prisma.notification.findFirst({
      where: { userId: firstBidder.id, type: "lost" },
    });
    expect(lostNotif).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 404 for unknown sample
// ---------------------------------------------------------------------------
describe("POST /api/samples/:id/bids — sample not found", () => {
  it("returns 404 for a non-existent sample ID", async () => {
    const bidder = await createUser();
    const res = await bid(bidder.id, "nonexistent-sample-id", 1000);

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/not found/i);
  });
});
