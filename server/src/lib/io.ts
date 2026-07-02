import type { Server } from "socket.io";

let ioInstance: Server | null = null;

export function setIo(io: Server) {
  ioInstance = io;
}

export function getIo(): Server {
  if (!ioInstance) throw new Error("Socket.IO not initialized");
  return ioInstance;
}

export function sampleRoom(sampleId: string) {
  return `sample:${sampleId}`;
}

export function userRoom(userId: string) {
  return `user:${userId}`;
}
