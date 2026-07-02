import { useEffect, useState } from "react";
import { Trophy } from "lucide-react";
import { api, centsToDisplay } from "../lib/api";
import type { LeaderboardEntry } from "../lib/types";
import { Avatar } from "../components/Avatar";
import { VerifiedBadge } from "../components/VerifiedBadge";

export function Leaderboard() {
  const [topBuyers, setTopBuyers] = useState<LeaderboardEntry[]>([]);
  const [topSellers, setTopSellers] = useState<LeaderboardEntry[]>([]);
  const [tab, setTab] = useState<"buyers" | "sellers">("buyers");

  useEffect(() => {
    api
      .get<{ topBuyers: LeaderboardEntry[]; topSellers: LeaderboardEntry[] }>("/leaderboard")
      .then((res) => {
        setTopBuyers(res.topBuyers);
        setTopSellers(res.topSellers);
      });
  }, []);

  const list = tab === "buyers" ? topBuyers : topSellers;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="flex items-center gap-2 text-3xl font-bold">
        <Trophy className="text-accent" /> Leaderboard
      </h1>
      <p className="mt-1 text-sm text-muted">Top collectors and sellers by all-time value.</p>

      <div className="mt-6 inline-flex rounded-lg border border-border bg-surface-2 p-1">
        {(["buyers", "sellers"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-md px-4 py-1.5 text-sm font-medium capitalize transition ${
              tab === t ? "bg-primary text-white" : "text-muted hover:text-foreground"
            }`}
          >
            Top {t}
          </button>
        ))}
      </div>

      <div className="mt-6 divide-y divide-border rounded-2xl border border-border bg-surface">
        {list.length === 0 && <p className="px-5 py-8 text-center text-sm text-muted">No completed sales yet.</p>}
        {list.map((entry, i) => (
          <div key={entry.user.id} className="flex items-center gap-4 px-5 py-4">
            <span className={`w-6 text-center text-sm font-bold ${i < 3 ? "text-accent" : "text-muted-2"}`}>{i + 1}</span>
            <Avatar seed={entry.user.avatarSeed} username={entry.user.username} size={36} />
            <div className="flex-1">
              <p className="flex items-center gap-1 font-semibold">
                {entry.user.username}
                {entry.user.verified && <VerifiedBadge size={13} />}
              </p>
              <p className="text-xs text-muted">
                {tab === "buyers" ? `${entry.wins} win${entry.wins === 1 ? "" : "s"}` : `${entry.sales} sale${entry.sales === 1 ? "" : "s"}`}
              </p>
            </div>
            <p className="font-bold">
              {centsToDisplay(tab === "buyers" ? entry.spentCents! : entry.earnedCents!)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
