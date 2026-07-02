import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "../lib/api";
import { getSocket } from "../lib/socket";
import { useAuth } from "./AuthContext";
import { useToast } from "./ToastContext";
import type { NotificationEntry } from "../lib/types";

interface NotificationContextValue {
  notifications: NotificationEntry[];
  unreadCount: number;
  markAllRead: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

const TOAST_TONE: Record<NotificationEntry["type"], "info" | "success" | "warning"> = {
  outbid: "warning",
  won: "success",
  lost: "info",
  sold: "success",
  unsold: "info",
};

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { push } = useToast();
  const [notifications, setNotifications] = useState<NotificationEntry[]>([]);

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      return;
    }
    api
      .get<{ notifications: NotificationEntry[] }>("/notifications")
      .then((res) => setNotifications(res.notifications))
      .catch(() => {});

    const socket = getSocket();
    const handler = (n: NotificationEntry) => {
      setNotifications((prev) => [n, ...prev]);
      push({ title: n.message, tone: TOAST_TONE[n.type] ?? "info" });
    };
    socket.on("notification", handler);
    return () => {
      socket.off("notification", handler);
    };
  }, [user, push]);

  const markAllRead = async () => {
    await api.post("/notifications/read-all");
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <NotificationContext.Provider value={{ notifications, unreadCount, markAllRead }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error("useNotifications must be used within NotificationProvider");
  return ctx;
}
