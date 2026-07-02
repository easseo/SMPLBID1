import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { ShoppingBag, Sparkles, Layers, Check, X, Loader2 } from "lucide-react";
import { useAuth, ApiError } from "../context/AuthContext";
import { api } from "../lib/api";
import type { AccountType } from "../lib/types";

type UsernameStatus = "idle" | "checking" | "available" | "taken" | "invalid";

const ACCOUNT_TYPES: { value: AccountType; label: string; description: string; icon: React.ReactNode }[] = [
  { value: "buyer", label: "Buyer", description: "Bid & collect", icon: <ShoppingBag size={16} /> },
  { value: "both", label: "Both", description: "Buy & sell", icon: <Layers size={16} /> },
  { value: "seller", label: "Creator", description: "Sell samples", icon: <Sparkles size={16} /> },
];

export function AuthPage() {
  const [params, setParams] = useSearchParams();
  // Mode is derived straight from the URL (not local state) so that navigating
  // between "Log in" and "Get started" while already on this page — which
  // React Router handles as a search-param update rather than a remount —
  // actually switches the form instead of silently staying stuck.
  const mode: "login" | "register" = params.get("mode") === "register" ? "register" : "login";
  const setMode = (next: "login" | "register") =>
    setParams(next === "register" ? { mode: "register" } : {}, { replace: true });
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [accountType, setAccountType] = useState<AccountType>("both");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>("idle");
  const { login, register } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (mode !== "register" || username.length === 0) {
      setUsernameStatus("idle");
      return;
    }
    if (username.length < 3 || username.length > 24 || !/^[a-zA-Z0-9_]+$/.test(username)) {
      setUsernameStatus("invalid");
      return;
    }
    setUsernameStatus("checking");
    const id = setTimeout(() => {
      api
        .get<{ available: boolean }>(`/auth/username-available?u=${encodeURIComponent(username)}`)
        .then((res) => setUsernameStatus(res.available ? "available" : "taken"))
        .catch(() => setUsernameStatus("idle"));
    }, 400);
    return () => clearTimeout(id);
  }, [username, mode]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (mode === "login") {
        await login(identifier, password);
      } else {
        await register(username, email, password, accountType);
      }
      navigate("/arena");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-md flex-col px-4 py-16">
      <h1 className="text-3xl font-bold">{mode === "login" ? "Welcome back" : "Create your account"}</h1>
      <p className="mt-2 text-sm text-muted">
        {mode === "login"
          ? "Log in to bid, sell, and track your wins."
          : "Create your account to bid, sell, and track your wins."}
      </p>

      <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4">
        {mode === "register" && (
          <div>
            <label className="text-xs font-medium uppercase tracking-wide text-muted">I'm here to</label>
            <div className="mt-1.5 grid grid-cols-3 gap-2">
              {ACCOUNT_TYPES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setAccountType(t.value)}
                  className={`flex flex-col items-center gap-1.5 rounded-xl border px-2 py-3 text-center transition ${
                    accountType === t.value
                      ? "border-primary/60 bg-primary/10 text-foreground shadow-[0_0_0_1px_var(--color-primary)]"
                      : "border-border bg-surface-2 text-muted hover:border-primary/30 hover:text-foreground"
                  }`}
                >
                  <span className={accountType === t.value ? "text-primary" : ""}>{t.icon}</span>
                  <span className="text-xs font-semibold">{t.label}</span>
                  <span className="text-[10px] text-muted-2">{t.description}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {mode === "register" && (
          <div>
            <label className="text-xs font-medium uppercase tracking-wide text-muted">Username</label>
            <div className="relative mt-1">
              <input
                required
                value={username}
                onChange={(e) => setUsername(e.target.value.replace(/\s/g, ""))}
                className={`w-full rounded-lg border bg-surface-2 px-3 py-2.5 text-sm outline-none focus:border-primary ${
                  usernameStatus === "taken" || usernameStatus === "invalid" ? "border-error/50" : "border-border"
                }`}
                placeholder="beatmakerxyz"
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
                {usernameStatus === "checking" && <Loader2 size={14} className="animate-spin text-muted" />}
                {usernameStatus === "available" && <Check size={14} className="text-success" />}
                {(usernameStatus === "taken" || usernameStatus === "invalid") && <X size={14} className="text-error" />}
              </span>
            </div>
            <p className="mt-1 text-xs">
              {usernameStatus === "taken" && <span className="text-error">That username is already taken.</span>}
              {usernameStatus === "available" && <span className="text-success">Username is available.</span>}
              {usernameStatus === "invalid" && username.length > 0 && (
                <span className="text-error">English letters, numbers, and underscores only — 3 to 24 characters.</span>
              )}
              {usernameStatus === "idle" && (
                <span className="text-muted-2">English letters, numbers, and underscores only — must be unique.</span>
              )}
            </p>
          </div>
        )}
        {mode === "register" ? (
          <div>
            <label className="text-xs font-medium uppercase tracking-wide text-muted">Email</label>
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-sm outline-none focus:border-primary"
              placeholder="you@example.com"
            />
          </div>
        ) : (
          <div>
            <label className="text-xs font-medium uppercase tracking-wide text-muted">Username or email</label>
            <input
              required
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-sm outline-none focus:border-primary"
              placeholder="beatmakerxyz"
            />
          </div>
        )}
        <div>
          <label className="text-xs font-medium uppercase tracking-wide text-muted">Password</label>
          <input
            required
            type="password"
            minLength={mode === "register" ? 8 : undefined}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-sm outline-none focus:border-primary"
            placeholder="••••••••"
          />
        </div>

        {error && <p className="rounded-lg border border-error/30 bg-error/10 px-3 py-2 text-sm text-error">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="shimmer-bg mt-2 rounded-lg py-2.5 font-semibold text-white shadow-lg transition hover:scale-[1.01] disabled:opacity-60"
        >
          {submitting ? "Please wait…" : mode === "login" ? "Log in" : "Create account"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        {mode === "login" ? "New here?" : "Already have an account?"}{" "}
        <button className="font-semibold text-primary hover:underline" onClick={() => setMode(mode === "login" ? "register" : "login")}>
          {mode === "login" ? "Create an account" : "Log in"}
        </button>
      </p>
      <p className="mt-2 text-center text-xs text-muted-2">
        Demo tip: try username <code className="text-muted">kaidenmakes</code> / <code className="text-muted">luna_waves</code> with password{" "}
        <code className="text-muted">password123</code>.
      </p>
      <Link to="/" className="mt-8 text-center text-xs text-muted-2 hover:text-muted">
        ← Back to home
      </Link>
    </div>
  );
}
