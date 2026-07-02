import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Trophy, Gavel } from "lucide-react";
import { api, centsToDisplay } from "../lib/api";
import type { LeaderboardEntry, ContestedSample } from "../lib/types";
import { Avatar } from "../components/Avatar";
import { VerifiedBadge } from "../components/VerifiedBadge";

export function Leaderboard() {
  const [topCreators, setTopCreators] = useState<LeaderboardEntry[]>([]);
  const [mostContested, setMostContested] = useState<ContestedSample[]>([]);

  useEffect(() => {
    api
      .get<{ topCreators: LeaderboardEntry[]; mostContested: ContestedSample[] }>("/leaderboard")
      .then((res) => {
        setTopCreators(res.topCreators);
        setMostContested(res.mostContested);
      });
  }, []);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <h1 className="flex items-center gap-2 text-3xl font-bold lg:text-5xl">
        <Trophy className="text-accent lg:size-10" /> Leaderboard
      </h1>
      <p className="mt-1 text-sm text-muted lg:mt-3 lg:text-lg">Who's winning the week.</p>

      <div className="mt-8 grid gap-6 lg:mt-10 lg:grid-cols-2 lg:gap-7">
        <div className="rounded-2xl border border-border bg-surface lg:rounded-2xl">
          <div className="border-b border-border px-5 py-4 lg:px-7 lg:py-5">
            <h2 className="font-semibold lg:text-xl">Top Creators This Week</h2>
            <p className="text-xs text-muted lg:mt-1 lg:text-sm">Sellers ranked by revenue from auctions that ended in the last 7 days.</p>
          </div>
          <div className="divide-y divide-border">
            {topCreators.length === 0 && <p className="px-5 py-8 text-center text-sm text-muted lg:py-12 lg:text-base">No sales this week yet.</p>}
            {topCreators.map((entry, i) => (
              <div key={entry.user.id} className="flex items-center gap-4 px-5 py-4 lg:gap-5 lg:px-7 lg:py-4">
                <span className={`w-6 text-center text-sm font-bold lg:w-8 lg:text-lg ${i < 3 ? "text-accent" : "text-muted-2"}`}>#{i + 1}</span>
                <span className="lg:hidden">
                  <Avatar seed={entry.user.avatarSeed} username={entry.user.username} size={36} />
                </span>
                <span className="hidden lg:block">
                  <Avatar seed={entry.user.avatarSeed} username={entry.user.username} size={46} />
                </span>
                <Link to={`/u/${entry.user.username}`} className="flex-1 min-w-0">
                  <p className="flex items-center gap-1 truncate font-semibold hover:underline lg:text-lg">
                    {entry.user.username}
                    {entry.user.verified && <VerifiedBadge size={13} />}
                  </p>
                  <p className="text-xs text-muted lg:text-sm">
                    {entry.sales} sale{entry.sales === 1 ? "" : "s"}
                  </p>
                </Link>
                <p className="font-bold lg:text-xl">{centsToDisplay(entry.earnedCents ?? 0)}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-surface lg:rounded-2xl">
          <div className="border-b border-border px-5 py-4 lg:px-7 lg:py-5">
            <h2 className="font-semibold lg:text-xl">Most Contested Samples</h2>
            <p className="text-xs text-muted lg:mt-1 lg:text-sm">Live auctions ranked by number of bids.</p>
          </div>
          <div className="divide-y divide-border">
            {mostContested.length === 0 && <p className="px-5 py-8 text-center text-sm text-muted lg:py-12 lg:text-base">No active bidding wars yet.</p>}
            {mostContested.map((sample, i) => (
              <Link
                key={sample.id}
                to={`/sample/${sample.id}`}
                className="flex items-center gap-4 px-5 py-4 transition hover:bg-surface-2 lg:gap-5 lg:px-7 lg:py-4"
              >
                <span className={`w-6 text-center text-sm font-bold lg:w-8 lg:text-lg ${i < 3 ? "text-accent" : "text-muted-2"}`}>#{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold lg:text-lg">{sample.title}</p>
                  <p className="flex items-center gap-1 text-xs text-muted lg:text-sm">
                    <Gavel size={11} className="lg:hidden" />
                    <Gavel size={14} className="hidden lg:block" /> {sample.bidCount} bid{sample.bidCount === 1 ? "" : "s"}
                  </p>
                </div>
                <p className="font-bold lg:text-xl">{centsToDisplay(sample.currentPriceCents)}</p>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
