/**
 * Vitest per-file setup — runs before each test file.
 *
 * 1. Installs a no-op Socket.IO stub so getIo() doesn't throw.
 * 2. Resets all tables before each test so tests are isolated.
 */
import { beforeEach } from "vitest";
import { setIo } from "../lib/io.js";
import { prisma } from "../lib/prisma.js";
import type { Server } from "socket.io";

// ---------------------------------------------------------------------------
// Socket.IO stub
// The stub must support both:
//   getIo().to(room).emit(event, data)   — targeted room broadcasts
//   getIo().emit(event, data)            — global broadcasts
// ---------------------------------------------------------------------------
const mockEmit = () => mockIo;
const mockIo = {
  to: () => ({ emit: mockEmit }),
  emit: mockEmit,
} as unknown as Server;

setIo(mockIo);

// ---------------------------------------------------------------------------
// Database reset between tests
// ---------------------------------------------------------------------------
beforeEach(async () => {
  await prisma.$transaction([
    prisma.certificate.deleteMany(),
    prisma.notification.deleteMany(),
    prisma.bid.deleteMany(),
    prisma.sample.deleteMany(),
    prisma.user.deleteMany(),
  ]);
});
