import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Lock, Zap, Trophy, ShieldCheck, ArrowRight } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { api, centsToDisplay } from "../lib/api";
import { getSocket } from "../lib/socket";
import type { PaginatedSamples, SampleSummary } from "../lib/types";
import { SampleCard } from "../components/SampleCard";
import { Avatar } from "../components/Avatar";

interface ActivityEvent {
  id: string;
  type: "bid" | "sold";
  sampleId: string;
  sampleTitle: string;
  username: string;
  avatarSeed: string;
  amountCents: number;
  createdAt: string;
}

export function Home() {
  const [samples, setSamples] = useState<SampleSummary[]>([]);
  const [activity, setActivity] = useState<ActivityEvent[]>([]);

  useEffect(() => {
    api.get<PaginatedSamples>("/samples?status=live&limit=6").then((res) => setSamples(res.samples));

    const socket = getSocket();
    const handler = (event: ActivityEvent) => {
      setActivity((prev) => [event, ...prev].slice(0, 12));
    };
    socket.on("activity", handler);
    return () => {
      socket.off("activity", handler);
    };
  }, []);

  const endingSoon = [...samples].sort((a, b) => new Date(a.endTime).getTime() - new Date(b.endTime).getTime());

  return (
    <div>
      <section className="relative overflow-hidden border-b border-border">
        <div className="relative mx-auto grid max-w-[1800px] gap-12 px-4 py-14 sm:px-6 lg:grid-cols-[1.2fr_1fr] lg:px-8 lg:py-20">
          <div className="animate-rise">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
              </span>
              Live arena open now · {samples.length} active auctions
            </span>

            <h1 className="mt-5 text-5xl font-bold tracking-tight md:text-7xl">
              Bid. Win. <span className="gradient-text">Own forever.</span>
            </h1>

            <div className="animate-glow-pulse mt-6 max-w-xl rounded-2xl border border-white/15 bg-white/5 px-5 py-4 backdrop-blur-md">
              <p className="text-3xl font-bold leading-tight tracking-tight text-foreground md:text-4xl">
                <span className="gradient-text">Exclusive</span>, one-of-one audio samples.
              </p>
            </div>

            <p className="mt-5 max-w-xl text-lg text-muted">
              Each auction has a single winner. The buyer automatically receives exclusive ownership, copyright, and
              future royalty rights, while the sample is permanently removed from the marketplace.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/arena"
                className="shimmer-bg glow-shadow inline-flex items-center gap-2 rounded-xl px-6 py-3 font-semibold text-white transition hover:scale-[1.03]"
              >
                Enter the Arena <ArrowRight size={16} />
              </Link>
              <Link
                to="/sample/new"
                className="rounded-xl border border-border bg-surface px-6 py-3 font-semibold transition hover:-translate-y-0.5 hover:border-primary/50"
              >
                Start selling
              </Link>
            </div>

            <div className="mt-10 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <Feature icon={<Lock size={16} />} label="One owner ever" />
              <Feature icon={<Zap size={16} />} label="Anti-snipe bidding" />
              <Feature icon={<ShieldCheck size={16} />} label="Watermarked previews" />
              <Feature icon={<Trophy size={16} />} label="Ownership certificates" />
            </div>
          </div>

          <div className="animate-rise hidden lg:block">
            <div className="rounded-2xl border border-border bg-surface/60 backdrop-blur">
              <div className="flex items-center gap-2 border-b border-border px-4 py-3">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-live opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-live" />
                </span>
                <span className="text-sm font-semibold uppercase tracking-wider">Live activity</span>
              </div>
              <ul className="scrollbar-thin max-h-[28rem] space-y-1 overflow-y-auto p-2">
                {activity.length === 0 && (
                  <li className="px-3 py-10 text-center text-sm text-muted">Waiting for the next bid…</li>
                )}
                {activity.map((a) => (
                  <li key={a.id + a.createdAt}>
                    <Link
                      to={`/sample/${a.sampleId}`}
                      className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition hover:bg-surface-2"
                    >
                      <Avatar seed={a.avatarSeed} username={a.username} size={24} />
                      <span className="flex-1 truncate">
                        <span className="font-medium">{a.username}</span>{" "}
                        <span className="text-muted">{a.type === "sold" ? "won" : "bid"}</span>{" "}
                        <span className="font-semibold text-primary">{centsToDisplay(a.amountCents)}</span>{" "}
                        <span className="text-muted">on {a.sampleTitle}</span>
                      </span>
                      <span className="shrink-0 text-xs text-muted-2">
                        {formatDistanceToNow(new Date(a.createdAt), { addSuffix: true })}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1800px] px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-xl font-bold">Ending soon</h2>
          <Link
            to="/arena"
            className="inline-flex items-center gap-2 rounded-lg border border-primary/40 bg-primary/10 px-5 py-2.5 text-base font-semibold text-primary transition hover:scale-[1.03] hover:bg-primary/20"
          >
            View all →
          </Link>
        </div>
        {endingSoon.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-12 text-center">
            <p className="text-muted">The arena is quiet. Be the first to drop a sample.</p>
            <Link to="/sample/new" className="mt-4 inline-block rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white">
              Upload a sample
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {endingSoon.map((s) => (
              <SampleCard key={s.id} sample={s} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Feature({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-surface/60 px-3 py-2">
      <span className="text-primary">{icon}</span>
      <span className="text-muted">{label}</span>
    </div>
  );
}
