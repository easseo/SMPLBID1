import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { LayoutGrid, Upload, Vault as VaultIcon, Gavel, DollarSign, Trophy, Package } from "lucide-react";
import { api, centsToDisplay } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { CountdownBadge } from "../components/CountdownBadge";

interface DashboardStats {
  activeListingsCount: number;
  activeBidsCount: number;
  wonCount: number;
  totalSpentCents: number;
  soldCount: number;
  totalEarnedCents: number;
}

interface DashboardSample {
  id: string;
  title: string;
  imageUrl: string | null;
  currentPriceCents: number;
  endTime: string;
  bidCount: number;
}

export function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [activeListings, setActiveListings] = useState<DashboardSample[]>([]);
  const [activeBids, setActiveBids] = useState<DashboardSample[]>([]);

  useEffect(() => {
    api
      .get<{ stats: DashboardStats; activeListings: DashboardSample[]; activeBids: DashboardSample[] }>("/dashboard")
      .then((res) => {
        setStats(res.stats);
        setActiveListings(res.activeListings);
        setActiveBids(res.activeBids);
      });
  }, []);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="flex items-center gap-2 text-3xl font-bold">
        <LayoutGrid className="text-accent" /> Dashboard
      </h1>
      <p className="mt-1 text-sm text-muted">Welcome back, {user?.username}.</p>

      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard icon={<Package size={16} />} label="Active listings" value={stats?.activeListingsCount ?? 0} />
        <StatCard icon={<Gavel size={16} />} label="Active bids" value={stats?.activeBidsCount ?? 0} />
        <StatCard icon={<Trophy size={16} />} label="Samples won" value={stats?.wonCount ?? 0} />
        <StatCard icon={<DollarSign size={16} />} label="Total spent" value={centsToDisplay(stats?.totalSpentCents ?? 0)} />
        <StatCard icon={<Trophy size={16} />} label="Samples sold" value={stats?.soldCount ?? 0} />
        <StatCard icon={<DollarSign size={16} />} label="Total earned" value={centsToDisplay(stats?.totalEarnedCents ?? 0)} />
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link to="/sample/new" className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium transition hover:border-primary/50">
          <Upload size={14} /> Sell a sample
        </Link>
        <Link to="/vault" className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium transition hover:border-primary/50">
          <VaultIcon size={14} /> Open your Vault
        </Link>
        <Link to={`/u/${user?.username}`} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium transition hover:border-primary/50">
          View public profile
        </Link>
      </div>

      <Section title="Your active listings" samples={activeListings} emptyText="You don't have any live auctions right now." />
      <Section title="Your active bids" samples={activeBids} emptyText="You haven't placed any bids on live auctions yet." />
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-3">
      <div className="flex items-center gap-1.5 text-muted-2">
        {icon}
        <span className="text-[10px] uppercase tracking-wide">{label}</span>
      </div>
      <p className="mt-1.5 text-xl font-bold">{value}</p>
    </div>
  );
}

function Section({ title, samples, emptyText }: { title: string; samples: DashboardSample[]; emptyText: string }) {
  return (
    <div className="mt-10">
      <h2 className="text-lg font-bold">{title}</h2>
      {samples.length === 0 ? (
        <p className="mt-3 rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted">{emptyText}</p>
      ) : (
        <div className="mt-3 divide-y divide-border rounded-2xl border border-border bg-surface">
          {samples.map((s) => (
            <Link key={s.id} to={`/sample/${s.id}`} className="flex items-center gap-3 px-4 py-3 transition hover:bg-surface-2">
              <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-surface-2">
                {s.imageUrl && <img src={s.imageUrl} alt="" className="h-full w-full object-cover" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{s.title}</p>
                <p className="text-xs text-muted">
                  {s.bidCount} bid{s.bidCount === 1 ? "" : "s"}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <p className="font-bold">{centsToDisplay(s.currentPriceCents)}</p>
                <CountdownBadge endTime={s.endTime} ended={false} />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
