import "dotenv/config";
import "express-async-errors";
import express from "express";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import cors from "cors";
import cookieParser from "cookie-parser";
import { parseCookie } from "cookie";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { Server } from "socket.io";

import { attachUser, COOKIE_NAME, verifyToken } from "./lib/auth.js";
import { setIo, sampleRoom, userRoom } from "./lib/io.js";
import { sweepExpiredAuctions } from "./lib/auctionEngine.js";

import authRoutes from "./routes/auth.js";
import sampleRoutes from "./routes/samples.js";
import bidRoutes from "./routes/bids.js";
import leaderboardRoutes from "./routes/leaderboard.js";
import notificationRoutes from "./routes/notifications.js";
import certificateRoutes from "./routes/certificates.js";
import userRoutes from "./routes/users.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT ?? 4000);
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN ?? "http://localhost:5173";

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: CLIENT_ORIGIN, credentials: true },
});
setIo(io);

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);
app.use(cors({ origin: CLIENT_ORIGIN, credentials: true }));
app.use(express.json());
app.use(cookieParser());
app.use(attachUser);
app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));

// Brute-force guard on auth endpoints — generous enough for normal use/demo
// flows but bounds credential-stuffing and registration-spam attempts.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts. Try again in a few minutes." },
});
app.use("/api/auth/login", authLimiter);
app.use("/api/auth/register", authLimiter);

// General API-wide backstop against bid-flooding / upload-spam / scripted
// abuse — high enough to never bother a real user clicking around.
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please slow down." },
});
app.use("/api", apiLimiter);

app.use("/api/auth", authRoutes);
app.use("/api/samples", sampleRoutes);
app.use("/api", bidRoutes);
app.use("/api/leaderboard", leaderboardRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/certificates", certificateRoutes);
app.use("/api/users", userRoutes);

app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.use("/api", (_req, res) => {
  res.status(404).json({ error: "Not found" });
});

// Safety net: express-async-errors forwards thrown/rejected errors from async
// route handlers here instead of hanging the request or crashing the process.
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("Unhandled request error:", err);
  if (res.headersSent) return;
  res.status(500).json({ error: "Something went wrong. Please try again." });
});

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled promise rejection:", reason);
});
process.on("uncaughtException", (err) => {
  console.error("Uncaught exception:", err);
});

// A socket's own identity is derived from its auth cookie (sent automatically
// on the WebSocket handshake), never from a client-supplied argument —
// otherwise any connected client could join `join:user` with an arbitrary
// id and receive another user's private notifications (outbid alerts, win/
// loss results, sale confirmations).
function verifiedUserIdFor(socket: import("socket.io").Socket): string | null {
  const cookieHeader = socket.handshake.headers.cookie;
  if (!cookieHeader) return null;
  const token = parseCookie(cookieHeader)[COOKIE_NAME];
  if (!token) return null;
  return verifyToken(token)?.userId ?? null;
}

io.on("connection", (socket) => {
  socket.on("join:sample", (sampleId: string) => {
    if (typeof sampleId === "string") socket.join(sampleRoom(sampleId));
  });
  socket.on("leave:sample", (sampleId: string) => {
    if (typeof sampleId === "string") socket.leave(sampleRoom(sampleId));
  });
  socket.on("join:user", () => {
    const verifiedUserId = verifiedUserIdFor(socket);
    if (verifiedUserId) socket.join(userRoom(verifiedUserId));
  });
});

setInterval(() => {
  sweepExpiredAuctions().catch((err) => console.error("sweep error", err));
}, 5000);

server.listen(PORT, () => {
  console.log(`SMPLbid server listening on http://localhost:${PORT}`);
});
