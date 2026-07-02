import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Award, Gavel } from "lucide-react";
import { api, centsToDisplay } from "../lib/api";
import { Avatar } from "../components/Avatar";
import { VerifiedBadge } from "../components/VerifiedBadge";
import { AccountTypeBadge } from "../components/AccountTypeBadge";
import type { AccountType } from "../lib/types";

interface ListedSample {
  id: string;
  title: string;
  status: string;
  currentPriceCents: number;
  endTime: string;
  bidCount: number;
  winner: { username: string } | null;
}
interface WonSample {
  id: string;
  title: string;
  currentPriceCents: number;
  seller: { username: string };
  certificateCode?: string;
}
interface ProfileData {
  user: {
    id: string;
    username: string;
    bio: string | null;
    avatarSeed: string;
    verified: boolean;
    accountType: AccountType;
    createdAt: string;
  };
  listed: ListedSample[];
  won: WonSample[];
}

export function Profile() {
  const { username } = useParams<{ username: string }>();
  const [data, setData] = useState<ProfileData | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [tab, setTab] = useState<"listed" | "won">("listed");

  useEffect(() => {
    if (!username) return;
    setData(null);
    setNotFound(false);
    api
      .get<ProfileData>(`/users/${username}`)
      .then(setData)
      .catch(() => setNotFound(true));
  }, [username]);

  if (notFound) return <p className="py-20 text-center text-sm text-muted">User not found.</p>;
  if (!data) return <p className="py-20 text-center text-sm text-muted">Loading profile…</p>;

  const list = tab === "listed" ? data.listed : data.won;

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex items-center gap-4">
        <Avatar seed={data.user.avatarSeed} username={data.user.username} size={64} />
        <div>
          <h1 className="flex items-center gap-1.5 text-2xl font-bold">
            {data.user.username}
            {data.user.verified && <VerifiedBadge size={18} />}
          </h1>
          <div className="mt-1.5">
            <AccountTypeBadge type={data.user.accountType} />
          </div>
          {data.user.bio && <p className="mt-1.5 text-sm text-muted">{data.user.bio}</p>}
        </div>
      </div>

      <div className="mt-8 flex gap-4">
        <Stat icon={<Gavel size={14} />} label="Listed" value={data.listed.length} />
        <Stat icon={<Award size={14} />} label="Won" value={data.won.length} />
      </div>

      <div className="mt-8 inline-flex rounded-lg border border-border bg-surface-2 p-1">
        {(["listed", "won"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-md px-4 py-1.5 text-sm font-medium capitalize transition ${
              tab === t ? "bg-primary text-white" : "text-muted hover:text-foreground"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="mt-4 divide-y divide-border rounded-2xl border border-border bg-surface">
        {list.length === 0 && <p className="px-5 py-8 text-center text-sm text-muted">Nothing here yet.</p>}
        {tab === "listed"
          ? data.listed.map((s) => (
              <Link key={s.id} to={`/sample/${s.id}`} className="flex items-center justify-between px-5 py-4 transition hover:bg-surface-2">
                <div>
                  <p className="font-medium">{s.title}</p>
                  <p className="text-xs text-muted">
                    {s.status === "ended" ? (s.winner ? `Sold to ${s.winner.username}` : "Ended, unsold") : `${s.bidCount} bids`}
                  </p>
                </div>
                <p className="font-semibold">{centsToDisplay(s.currentPriceCents)}</p>
              </Link>
            ))
          : data.won.map((s) => (
              <Link key={s.id} to={s.certificateCode ? `/certificate/${s.certificateCode}` : `/sample/${s.id}`} className="flex items-center justify-between px-5 py-4 transition hover:bg-surface-2">
                <div>
                  <p className="font-medium">{s.title}</p>
                  <p className="text-xs text-muted">from {s.seller.username}</p>
                </div>
                <p className="font-semibold">{centsToDisplay(s.currentPriceCents)}</p>
              </Link>
            ))}
      </div>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm">
      <span className="text-primary">{icon}</span>
      <span className="font-semibold">{value}</span>
      <span className="text-muted">{label}</span>
    </div>
  );
}
