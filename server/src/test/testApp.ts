/**
 * Minimal Express app for integration tests.
 *
 * Mirrors the setup from src/index.ts but without:
 * - Rate limiting (it interferes with rapid test requests)
 * - Socket.IO server (we use the stub in setup.ts)
 * - setInterval sweeper
 * - Static file serving
 *
 * The Socket.IO stub is installed in setup.ts before this module is imported.
 */
import "express-async-errors";
import express from "express";
import cookieParser from "cookie-parser";
import { attachUser } from "../lib/auth.js";
import bidRoutes from "../routes/bids.js";

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use(attachUser);
app.use("/api", bidRoutes);

// Error handler (mirrors index.ts)
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("Test app error:", err);
  if (res.headersSent) return;
  res.status(500).json({ error: "Something went wrong." });
});

export default app;
