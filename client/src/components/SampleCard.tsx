import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Flame, Gavel, Zap } from "lucide-react";
import type { SampleSummary } from "../lib/types";
import { api, centsToDisplay, ApiError } from "../lib/api";
import { Waveform } from "./Waveform";
import { CountdownBadge } from "./CountdownBadge";
import { VerifiedBadge } from "./VerifiedBadge";
import { Avatar } from "./Avatar";
import { avatarGradient } from "../lib/avatar";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";

export function SampleCard({ sample }: { sample: SampleSummary }) {
  const { user } = useAuth();
  const { push } = useToast();
  const navigate = useNavigate();
  const [buying, setBuying] = useState(false);

  const isSeller = Boolean(user && sample.seller?.id === user.id);
  const canBuyNow = Boolean(sample.buyNowPriceCents) && sample.status === "live" && !isSeller;

  async function handleBuyNow(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      navigate("/auth");
      return;
    }
    if (buying) return;
    setBuying(true);
    try {
      await api.post(`/samples/${sample.id}/bids`, { amountCents: sample.buyNowPriceCents });
      push({ title: "You bought it!", description: sample.title, tone: "success" });
      navigate(`/sample/${sample.id}`);
    } catch (err) {
      push({ title: "Couldn't complete purchase", description: err instanceof ApiError ? err.message : "Try again", tone: "warning" });
    } finally {
      setBuying(false);
    }
  }

  return (
    <Link
      to={`/sample/${sample.id}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-surface transition hover:-translate-y-1 hover:border-primary/40 hover:shadow-xl"
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden">
        {sample.imageUrl ? (
          <img
            src={sample.imageUrl}
            alt=""
            className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
            draggable={false}
          />
        ) : (
          <div className="h-full w-full" style={{ background: avatarGradient(sample.id) }} />
        )}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/90 via-black/25 to-black/60" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-transparent" />
        {sample.status === "live" && (
          <div className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-accent/90 px-2 py-1 text-[10px] font-semibold text-background">
            <Flame size={11} />
            {sample.buyNowPriceCents ? "Bid + Buy Now Option" : "Bid Option"}
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="truncate font-semibold leading-tight text-foreground">{sample.title}</h3>
            <p className="mt-1 text-xs text-muted">
              {sample.genre} · {sample.bpm} BPM · {sample.key}
            </p>
          </div>
          <div className="shrink-0">
            <CountdownBadge endTime={sample.endTime} ended={sample.status === "ended"} />
          </div>
        </div>

        <div className="mt-3 h-8">
          <Waveform data={sample.waveform} barClassName="group-hover:bg-primary/70" />
        </div>

        <div className="mt-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-muted">
            {sample.seller && (
              <>
                <Avatar seed={sample.seller.avatarSeed} username={sample.seller.username} size={20} />
                <span className="flex items-center gap-1">
                  {sample.seller.username}
                  {sample.seller.verified && <VerifiedBadge size={12} />}
                </span>
              </>
            )}
          </div>
          <div className="flex items-center gap-1 text-xs text-muted">
            <Gavel size={12} />
            {sample.bidCount ?? 0}
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
          <div>
            <p className="text-[10px] uppercase tracking-wide text-muted-2">
              {sample.status === "ended" ? "Sold for" : "Current bid"}
            </p>
            <p className="text-lg font-bold text-foreground">{centsToDisplay(sample.currentPriceCents)}</p>
          </div>
        </div>

        {canBuyNow && (
          <button
            onClick={handleBuyNow}
            disabled={buying}
            className="shimmer-bg mt-3 flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold shadow-lg transition hover:scale-[1.02] disabled:opacity-50"
          >
            <Zap size={13} /> {buying ? "Buying…" : `Buy It Now — ${centsToDisplay(sample.buyNowPriceCents!)}`}
          </button>
        )}
      </div>
    </Link>
  );
}
