/**
 * Tests for server/src/lib/auth.ts
 *
 * Covers:
 *  - signToken + verifyToken round-trip (happy path)
 *  - Reject token signed with a different secret
 *  - Reject token with alg:"none" (algorithm-confusion attack)
 */
import { describe, it, expect } from "vitest";
import jwt from "jsonwebtoken";
import { signToken, verifyToken } from "../lib/auth.js";

describe("auth — signToken / verifyToken", () => {
  it("round-trip: signs a payload and verifies it successfully", () => {
    const payload = { userId: "user-cuid-abc123" };
    const token = signToken(payload);

    expect(typeof token).toBe("string");
    expect(token.split(".")).toHaveLength(3); // header.payload.signature

    const result = verifyToken(token);
    expect(result).not.toBeNull();
    expect(result?.userId).toBe(payload.userId);
  });

  it("verifyToken returns null for a token signed with a different secret", () => {
    const token = jwt.sign({ userId: "evil-user" }, "wrong-secret", {
      algorithm: "HS256",
      expiresIn: "1h",
    });

    const result = verifyToken(token);
    expect(result).toBeNull();
  });

  it("verifyToken returns null for a token with alg:none (algorithm-confusion attack)", () => {
    // Craft a token with alg:none — a classic JWT attack vector.
    // The header encodes {"alg":"none","typ":"JWT"}, the signature is empty.
    const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
    const body = Buffer.from(JSON.stringify({ userId: "attacker", iat: Math.floor(Date.now() / 1000) })).toString(
      "base64url"
    );
    const noneToken = `${header}.${body}.`;

    const result = verifyToken(noneToken);
    expect(result).toBeNull();
  });

  it("verifyToken returns null for an expired token", () => {
    const token = jwt.sign({ userId: "user-abc" }, "test-secret-for-vitest", {
      algorithm: "HS256",
      expiresIn: -1, // already expired
    });

    const result = verifyToken(token);
    expect(result).toBeNull();
  });

  it("verifyToken returns null for a completely malformed string", () => {
    expect(verifyToken("not.a.token")).toBeNull();
    expect(verifyToken("")).toBeNull();
    expect(verifyToken("garbage")).toBeNull();
  });

  it("signToken always produces an HS256 token (not alg:none or RS256)", () => {
    const token = signToken({ userId: "check-alg" });
    const [headerB64] = token.split(".");
    const header = JSON.parse(Buffer.from(headerB64, "base64url").toString("utf8"));
    expect(header.alg).toBe("HS256");
  });
});
