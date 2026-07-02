import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { signToken, COOKIE_NAME, requireAuth } from "../lib/auth.js";

const router = Router();

const registerSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3)
    .max(24)
    .regex(/^[a-zA-Z0-9_]+$/, "Username can only contain letters, numbers, underscores"),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8).max(72),
  accountType: z.enum(["buyer", "seller", "both"]).default("both"),
});

const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

function publicUser(user: {
  id: string;
  username: string;
  email: string;
  bio: string | null;
  avatarSeed: string;
  verified: boolean;
  accountType: string;
  createdAt: Date;
}) {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    bio: user.bio,
    avatarSeed: user.avatarSeed,
    verified: user.verified,
    accountType: user.accountType,
    createdAt: user.createdAt,
  };
}

const USERNAME_REGEX = /^[a-zA-Z0-9_]+$/;

router.get("/username-available", async (req, res) => {
  const username = typeof req.query.u === "string" ? req.query.u.trim() : "";
  if (username.length < 3 || username.length > 24 || !USERNAME_REGEX.test(username)) {
    return res.json({ available: false, reason: "invalid" });
  }
  const existing = await prisma.user.findUnique({ where: { username }, select: { id: true } });
  res.json({ available: !existing, reason: existing ? "taken" : null });
});

router.post("/register", async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
  }
  const { username, email, password, accountType } = parsed.data;

  const existing = await prisma.user.findFirst({
    where: { OR: [{ email }, { username }] },
  });
  if (existing) {
    return res.status(409).json({ error: "Username or email already in use" });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: { username, email, passwordHash, accountType },
  });

  const token = signToken({ userId: user.id });
  res.cookie(COOKIE_NAME, token, COOKIE_OPTS);
  res.status(201).json({ user: publicUser(user) });
});

const loginSchema = z.object({
  identifier: z.string().trim().min(1),
  password: z.string().min(1),
});

router.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid input" });
  }
  const { identifier, password } = parsed.data;

  const user = await prisma.user.findFirst({
    where: { OR: [{ email: identifier.toLowerCase() }, { username: identifier }] },
  });
  if (!user) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const token = signToken({ userId: user.id });
  res.cookie(COOKIE_NAME, token, COOKIE_OPTS);
  res.json({ user: publicUser(user) });
});

router.post("/logout", (_req, res) => {
  res.clearCookie(COOKIE_NAME, COOKIE_OPTS);
  res.json({ ok: true });
});

router.get("/me", requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json({ user: publicUser(user) });
});

export default router;
