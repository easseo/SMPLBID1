import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useParams, Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { Gavel, ShieldCheck, Zap, ExternalLink, Share2, Check } from "lucide-react";
import { api, centsToDisplay, ApiError } from "../lib/api";
import { getSocket } from "../lib/socket";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { useCountdown } from "../hooks/useCountdown";
import { copyToClipboard } from "../lib/clipboard";
import type { BidEntry, SampleSummary } from "../lib/types";
import { AudioPlayer } from "../components/AudioPlayer";
import { CountdownBadge } from "../components/CountdownBadge";
import { VerifiedBadge } from "../components/VerifiedBadge";
import { Avatar } from "../components/Avatar";

const QUICK_INCREMENTS_CENTS = [100, 500, 1000];

export function SampleDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { push } = useToast();
  const [sample, setSample] = useState<SampleSummary | null>(null);
  const [bids, setBids] = useState<BidEntry[]>([]);
  const [bidAmount, setBidAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [justExtended, setJustExtended] = useState(false);
  const [ended, setEnded] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);

  useEffect(() => {
    if (!id) return;
    api
      .get<{ sample: SampleSummary; bids: BidEntry[] }>(`/samples/${id}`)
      .then((res) => {
        setSample(res.sample);
        setBids(res.bids);
        setEnded(res.sample.status === "ended");
      })
      .catch(() => setNotFound(true));

    const socket = getSocket();
    socket.emit("join:sample", id);

    const onBid = (payload: { sampleId: string; bid: BidEntry; currentPriceCents: number; endTime: string; extended: boolean }) => {
      if (payload.sampleId !== id) return;
      setBids((prev) => [payload.bid, ...prev]);
      setSample((prev) => (prev ? { ...prev, currentPriceCents: payload.currentPriceCents, endTime: payload.endTime } : prev));
      if (payload.extended) {
        setJustExtended(true);
        setTimeout(() => setJustExtended(false), 3000);
      }
    };
    const onEnded = (payload: { sampleId: string }) => {
      if (payload.sampleId !== id) return;
      setEnded(true);
      api.get<{ sample: SampleSummary; bids: BidEntry[] }>(`/samples/${id}`).then((res) => setSample(res.sample));
    };

    socket.on("bid:new", onBid);
    socket.on("auction:ended", onEnded);
    return () => {
      socket.emit("leave:sample", id);
      socket.off("bid:new", onBid);
      socket.off("auction:ended", onEnded);
    };
  }, [id]);

  const minNextBid = useMemo(() => {
    if (!sample) return 0;
    return bids.length > 0 ? sample.currentPriceCents + sample.minIncrementCents : sample.startingPriceCents;
  }, [sample, bids]);

  const isHighestBidder = Boolean(user && bids[0]?.user.id === user.id);
  const isSeller = sample?.seller?.id === user?.id;
  const countdown = useCountdown(sample?.endTime ?? new Date());

  async function placeBid(amountCents: number) {
    if (!sample) return;
    setError(null);
    setSubmitting(true);
    try {
      await api.post(`/samples/${sample.id}/bids`, { amountCents });
      setBidAmount("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to place bid");
    } finally {
      setSubmitting(false);
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const cents = Math.round(parseFloat(bidAmount) * 100);
    if (!cents || Number.isNaN(cents)) {
      setError("Enter a valid amount");
      return;
    }
    placeBid(cents);
  }

  function applyQuickIncrement(incrementCents: number) {
    if (!sample) return;
    const typedCents = Math.round(parseFloat(bidAmount) * 100);
    const baseCents = bidAmount && !Number.isNaN(typedCents) ? typedCents : sample.currentPriceCents;
    const amount = Math.max(minNextBid, baseCents + incrementCents);
    setBidAmount((amount / 100).toFixed(2));
  }

  async function handleShare() {
    const ok = await copyToClipboard(window.location.href);
    if (ok) {
      setShareCopied(true);
      push({ title: "Link copied", tone: "success" });
      setTimeout(() => setShareCopied(false), 2000);
    } else {
      push({ title: "Couldn't copy automatically", description: window.location.href, tone: "warning" });
    }
  }

  const typedBidCents = Math.round(parseFloat(bidAmount) * 100);
  const bidButtonLabel = bidAmount && !Number.isNaN(typedBidCents) ? `Bid ${centsToDisplay(typedBidCents)}` : "Bid";

  if (notFound) {
    return (
      <div className="flex flex-col items-center py-20 text-center">
        <p className="text-sm text-muted">This sample doesn't exist — it may have been removed.</p>
        <Link to="/arena" className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white">
          Back to the Arena
        </Link>
      </div>
    );
  }

  if (!sample) {
    return <p className="py-20 text-center text-sm text-muted">Loading sample…</p>;
  }

  const audioSrc = sample.canDownloadFull ? `/api/samples/${sample.id}/full` : `/api/samples/${sample.id}/preview`;

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">{sample.title}</h1>
          <p className="mt-1 text-sm text-muted">
            {sample.genre} · {sample.bpm} BPM · {sample.key}
          </p>
        </div>
        <CountdownBadge endTime={sample.endTime} ended={ended} />
      </div>

      {justExtended && (
        <div className="mt-4 flex items-center gap-2 rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 text-sm text-accent">
          <Zap size={14} /> A late bid extended this auction — anti-snipe protection kicked in.
        </div>
      )}

      <div className="mt-6">
        <AudioPlayer src={audioSrc} waveform={sample.waveform} watermark={!sample.canDownloadFull} />
      </div>

      <p className="mt-6 text-sm leading-relaxed text-muted">{sample.description}</p>

      <div className="mt-4 flex items-center gap-3 rounded-xl border border-border bg-surface p-3">
        {sample.seller && (
          <>
            <Avatar seed={sample.seller.avatarSeed} username={sample.seller.username} size={36} />
            <div>
              <p className="flex items-center gap-1 text-sm font-semibold">
                {sample.seller.username}
                {sample.seller.verified && <VerifiedBadge />}
              </p>
              <p className="text-xs text-muted">Seller</p>
            </div>
          </>
        )}
      </div>

      <div className="mt-8 grid gap-6 sm:grid-cols-2">
        <div className="rounded-2xl border border-border bg-surface p-5">
          <p className="text-xs uppercase tracking-wide text-muted-2">{ended ? "Final price" : "Current price"}</p>
          <p className="mt-1 text-4xl font-bold">{centsToDisplay(sample.currentPriceCents)}</p>
          <div className="mt-1 flex items-center justify-between text-xs text-muted">
            <span>
              {bids.length} bid{bids.length === 1 ? "" : "s"}
            </span>
            {!ended && <span className="font-mono">{countdown.label}</span>}
          </div>

          {!ended && isHighestBidder && (
            <div className="mt-4 flex items-center justify-center gap-2 rounded-lg border border-success/30 bg-success/10 py-2.5 text-sm font-semibold text-success">
              <span className="h-2 w-2 rounded-full bg-success" />
              You are winning
            </div>
          )}

          {sample.buyNowPriceCents && !ended && !isSeller && (
            <button
              onClick={() => placeBid(sample.buyNowPriceCents!)}
              disabled={submitting}
              className="shimmer-bg mt-4 flex w-full items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold text-white shadow-lg transition hover:scale-[1.01] disabled:opacity-50"
            >
              <Zap size={15} /> Buy Now — {centsToDisplay(sample.buyNowPriceCents)}
            </button>
          )}

          {ended ? (
            sample.winner ? (
              <div className="mt-4 rounded-lg border border-success/30 bg-success/10 px-3 py-3 text-sm">
                <p className="font-semibold text-success">Sold to {sample.winner.username}</p>
                {sample.certificateCode && (
                  <Link to={`/certificate/${sample.certificateCode}`} className="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:underline">
                    View ownership certificate <ExternalLink size={11} />
                  </Link>
                )}
              </div>
            ) : (
              <p className="mt-4 text-sm text-muted">This auction ended with no bids.</p>
            )
          ) : isSeller ? (
            <p className="mt-4 rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs text-muted">
              This is your sample — you can't bid on it.
            </p>
          ) : (
            <>
              {sample.buyNowPriceCents && (
                <p className="mt-4 text-center text-[10px] uppercase tracking-wide text-muted-2">Or bid below</p>
              )}

              <div className={`grid grid-cols-3 gap-2 ${sample.buyNowPriceCents ? "mt-2" : "mt-4"}`}>
                {QUICK_INCREMENTS_CENTS.map((inc) => (
                  <button
                    key={inc}
                    type="button"
                    onClick={() => applyQuickIncrement(inc)}
                    className="rounded-lg border border-border bg-surface-2 py-2 text-sm font-semibold transition hover:border-primary/50"
                  >
                    +{centsToDisplay(inc)}
                  </button>
                ))}
              </div>

              <form onSubmit={handleSubmit} className="mt-2 flex flex-col gap-2">
                <div className="flex gap-2">
                  <input
                    type="number"
                    step="0.5"
                    min={minNextBid / 100}
                    value={bidAmount}
                    onChange={(e) => setBidAmount(e.target.value)}
                    placeholder={`Min ${centsToDisplay(minNextBid)}`}
                    className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-sm outline-none focus:border-primary"
                  />
                  <button
                    type="submit"
                    disabled={submitting || isHighestBidder}
                    className="shimmer-bg shrink-0 rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition hover:scale-[1.02] disabled:opacity-50"
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <Gavel size={14} /> {bidButtonLabel}
                    </span>
                  </button>
                </div>
                {error && <p className="text-xs text-live">{error}</p>}
              </form>
            </>
          )}
        </div>

        <div className="rounded-2xl border border-border bg-surface p-5">
          <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-2">
            <ShieldCheck size={13} /> Bid history
          </p>
          <ul className="scrollbar-thin max-h-72 space-y-2 overflow-y-auto">
            {bids.length === 0 && <li className="text-sm text-muted">No bids yet — be the first.</li>}
            {bids.map((b) => (
              <li key={b.id} className="flex items-center gap-2 text-sm">
                <Avatar seed={b.user.avatarSeed} username={b.user.username} size={22} />
                <span className="flex-1 truncate">{b.user.username}</span>
                <span className="font-semibold">{centsToDisplay(b.amountCents)}</span>
                <span className="w-20 shrink-0 text-right text-xs text-muted-2">
                  {formatDistanceToNow(new Date(b.createdAt), { addSuffix: true })}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <button
        onClick={handleShare}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-border bg-surface px-4 py-3 text-sm font-medium text-muted transition hover:border-primary/40 hover:text-foreground"
      >
        {shareCopied ? <Check size={15} className="text-success" /> : <Share2 size={15} />}
        {shareCopied ? "Link copied" : "Share this drop"}
      </button>
    </div>
  );
}
