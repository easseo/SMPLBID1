import { Link, NavLink, useNavigate } from "react-router-dom";
import { useRef, useState } from "react";
import { Bell, Flame, Trophy, Upload, Menu, X } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useNotifications } from "../context/NotificationContext";
import { useClickOutside } from "../hooks/useClickOutside";
import { Avatar } from "./Avatar";
import { formatDistanceToNow } from "date-fns";

export function Header() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { notifications, unreadCount, markAllRead } = useNotifications();

  const menuRef = useRef<HTMLDivElement | null>(null);
  const bellRef = useRef<HTMLDivElement | null>(null);
  useClickOutside(menuRef, () => setMenuOpen(false), menuOpen);
  useClickOutside(bellRef, () => setBellOpen(false), bellOpen);

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `rounded-md px-3 py-2 text-sm transition ${
      isActive ? "bg-surface-2 text-foreground" : "text-muted hover:bg-surface-2 hover:text-foreground"
    }`;

  const mobileNavLinkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-2 rounded-md px-3 py-2.5 text-sm ${
      isActive ? "bg-surface-2 text-foreground" : "text-muted hover:bg-surface-2 hover:text-foreground"
    }`;

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setMobileOpen((v) => !v)}
            className="mr-1 flex h-9 w-9 items-center justify-center rounded-md text-muted hover:bg-surface-2 hover:text-foreground md:hidden"
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
          >
            {mobileOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
          <Link to="/" className="font-bold tracking-tight" onClick={() => setMobileOpen(false)}>
            <span className="text-lg">
              SMPL<span className="text-primary">bid</span>
            </span>
          </Link>
        </div>

        <nav className="hidden items-center gap-1 md:flex">
          <NavLink to="/arena" className={navLinkClass}>
            <span className="inline-flex items-center gap-1.5">
              <Flame size={14} /> Arena
            </span>
          </NavLink>
          <NavLink to="/leaderboard" className={navLinkClass}>
            <span className="inline-flex items-center gap-1.5">
              <Trophy size={14} /> Leaderboard
            </span>
          </NavLink>
        </nav>

        <div className="flex items-center gap-2">
          {user ? (
            <>
              {user.accountType !== "buyer" && (
                <Link
                  to="/sample/new"
                  className="hidden items-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm font-medium transition hover:border-primary/50 sm:inline-flex"
                >
                  <Upload size={14} /> Sell
                </Link>
              )}

              <div className="relative" ref={bellRef}>
                <button
                  onClick={() => setBellOpen((v) => !v)}
                  className="relative flex h-9 w-9 items-center justify-center rounded-md text-muted transition hover:bg-surface-2 hover:text-foreground"
                  aria-label="Notifications"
                >
                  <Bell size={17} />
                  {unreadCount > 0 && (
                    <span className="absolute right-1 top-1 flex h-2 w-2 rounded-full bg-live" />
                  )}
                </button>
                {bellOpen && (
                  <div className="fixed inset-x-4 top-16 mt-2 rounded-xl border border-border bg-surface shadow-2xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-auto sm:w-80">
                    <div className="flex items-center justify-between border-b border-border px-4 py-3">
                      <span className="text-sm font-semibold">Notifications</span>
                      {unreadCount > 0 && (
                        <button onClick={() => markAllRead()} className="text-xs text-primary hover:underline">
                          Mark all read
                        </button>
                      )}
                    </div>
                    <div className="scrollbar-thin max-h-80 overflow-y-auto">
                      {notifications.length === 0 && (
                        <p className="px-4 py-6 text-center text-sm text-muted">No notifications yet.</p>
                      )}
                      {notifications.map((n) => (
                        <div key={n.id} className={`border-b border-border px-4 py-3 text-sm ${!n.read ? "bg-primary/5" : ""}`}>
                          <p className="text-foreground">{n.message}</p>
                          <p className="mt-0.5 text-xs text-muted-2">{formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="relative" ref={menuRef}>
                <button onClick={() => setMenuOpen((v) => !v)} className="flex items-center gap-2 rounded-md p-1 hover:bg-surface-2">
                  <Avatar seed={user.avatarSeed} username={user.username} size={32} />
                </button>
                {menuOpen && (
                  <div className="absolute right-0 mt-2 w-48 rounded-xl border border-border bg-surface py-1 shadow-2xl">
                    <p className="truncate px-3 py-2 text-sm font-semibold">{user.username}</p>
                    <Link to={`/u/${user.username}`} onClick={() => setMenuOpen(false)} className="block px-3 py-2 text-sm text-muted hover:bg-surface-2 hover:text-foreground">
                      My profile
                    </Link>
                    <button
                      onClick={async () => {
                        setMenuOpen(false);
                        await logout();
                        navigate("/");
                      }}
                      className="block w-full px-3 py-2 text-left text-sm text-muted hover:bg-surface-2 hover:text-foreground"
                    >
                      Log out
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <Link to="/auth" className="rounded-md px-4 py-2 text-sm font-medium text-muted hover:text-foreground">
                Log in
              </Link>
              <Link
                to="/auth?mode=register"
                className="shimmer-bg rounded-md px-4 py-2 text-sm font-semibold text-white shadow-lg transition hover:scale-[1.03]"
              >
                Get started
              </Link>
            </>
          )}
        </div>
      </div>

      {mobileOpen && (
        <nav className="flex flex-col gap-0.5 border-t border-border px-4 py-3 md:hidden">
          <NavLink to="/arena" className={mobileNavLinkClass} onClick={() => setMobileOpen(false)}>
            <Flame size={15} /> Arena
          </NavLink>
          <NavLink to="/leaderboard" className={mobileNavLinkClass} onClick={() => setMobileOpen(false)}>
            <Trophy size={15} /> Leaderboard
          </NavLink>
          {user && user.accountType !== "buyer" && (
            <NavLink to="/sample/new" className={mobileNavLinkClass} onClick={() => setMobileOpen(false)}>
              <Upload size={15} /> Sell a sample
            </NavLink>
          )}
        </nav>
      )}
    </header>
  );
}
