import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api, ApiError } from "../lib/api";
import type { AccountType, PublicUser } from "../lib/types";
import { getSocket } from "../lib/socket";

interface AuthContextValue {
  user: PublicUser | null;
  loading: boolean;
  login: (identifier: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string, accountType: AccountType) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<{ user: PublicUser }>("/auth/me")
      .then((res) => setUser(res.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    // The server derives the room to join from the socket's own auth cookie,
    // not from any argument here — it never trusts a client-supplied user id
    // for this (that would let anyone read anyone else's notifications).
    if (user) {
      getSocket().emit("join:user");
    }
  }, [user]);

  const login = useCallback(async (identifier: string, password: string) => {
    const res = await api.post<{ user: PublicUser }>("/auth/login", { identifier, password });
    setUser(res.user);
  }, []);

  const register = useCallback(async (username: string, email: string, password: string, accountType: AccountType) => {
    const res = await api.post<{ user: PublicUser }>("/auth/register", { username, email, password, accountType });
    setUser(res.user);
  }, []);

  const logout = useCallback(async () => {
    await api.post("/auth/logout");
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export { ApiError };
