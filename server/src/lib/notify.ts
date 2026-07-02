import { prisma } from "./prisma.js";
import { getIo, userRoom } from "./io.js";

export async function notify(userId: string, type: string, message: string, sampleId?: string) {
  const notification = await prisma.notification.create({
    data: { userId, type, message, sampleId },
  });
  getIo().to(userRoom(userId)).emit("notification", notification);
  return notification;
}
