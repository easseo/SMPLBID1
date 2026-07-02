import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ShieldCheck, Copy, Check } from "lucide-react";
import { format } from "date-fns";
import { api, centsToDisplay } from "../lib/api";
import { VerifiedBadge } from "../components/VerifiedBadge";
import { copyToClipboard } from "../lib/clipboard";
import { useToast } from "../context/ToastContext";

interface CertificateData {
  code: string;
  issuedAt: string;
  contentHash: string;
  sample: {
    id: string;
    title: string;
    genre: string;
    bpm: number;
    key: string;
    finalPriceCents: number;
    seller: { username: string; verified: boolean };
    winner: { username: string } | null;
  };
}

export function CertificatePage() {
  const { code } = useParams<{ code: string }>();
  const { push } = useToast();
  const [cert, setCert] = useState<CertificateData | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!code) return;
    api
      .get<{ certificate: CertificateData }>(`/certificates/${code}`)
      .then((res) => setCert(res.certificate))
      .catch(() => setNotFound(true));
  }, [code]);

  async function copyLink() {
    const ok = await copyToClipboard(window.location.href);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } else {
      push({ title: "Couldn't copy automatically", description: window.location.href, tone: "warning" });
    }
  }

  if (notFound) {
    return <p className="py-20 text-center text-sm text-muted">Certificate not found.</p>;
  }
  if (!cert) {
    return <p className="py-20 text-center text-sm text-muted">Loading certificate…</p>;
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-14">
      <div className="rounded-2xl border border-primary/30 bg-surface p-8 shadow-2xl">
        <div className="flex items-center gap-2 text-primary">
          <ShieldCheck size={20} />
          <span className="text-xs font-semibold uppercase tracking-widest">Certificate of ownership</span>
        </div>

        <h1 className="mt-4 text-3xl font-bold">{cert.sample.title}</h1>
        <p className="mt-1 text-sm text-muted">
          {cert.sample.genre} · {cert.sample.bpm} BPM · {cert.sample.key}
        </p>

        <div className="mt-6 grid grid-cols-2 gap-4 border-t border-border pt-6 text-sm">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-2">Owner</p>
            <p className="mt-1 font-semibold">{cert.sample.winner?.username ?? "Unclaimed"}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-2">Original creator</p>
            <p className="mt-1 flex items-center gap-1 font-semibold">
              {cert.sample.seller.username}
              {cert.sample.seller.verified && <VerifiedBadge size={13} />}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-2">Final sale price</p>
            <p className="mt-1 font-semibold">{centsToDisplay(cert.sample.finalPriceCents)}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-2">Issued</p>
            <p className="mt-1 font-semibold">{format(new Date(cert.issuedAt), "MMM d, yyyy")}</p>
          </div>
        </div>

        <div className="mt-6 rounded-lg border border-border bg-surface-2 p-3">
          <p className="text-xs uppercase tracking-wide text-muted-2">Certificate code</p>
          <p className="mt-1 font-mono text-sm text-primary">{cert.code}</p>
          <p className="mt-2 text-xs uppercase tracking-wide text-muted-2">Content hash</p>
          <p className="mt-1 break-all font-mono text-xs text-muted">{cert.contentHash}</p>
        </div>

        <p className="mt-6 text-xs text-muted-2">
          This sample was removed from the SMPLbid marketplace permanently upon sale. This certificate is the
          verifiable record of its one-and-only ownership transfer.
        </p>

        <div className="mt-6 flex gap-2">
          <button
            onClick={copyLink}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium transition hover:border-primary/50"
          >
            {copied ? <Check size={13} /> : <Copy size={13} />}
            {copied ? "Copied!" : "Copy share link"}
          </button>
          <Link to={`/sample/${cert.sample.id}`} className="inline-flex items-center rounded-lg border border-border px-3 py-2 text-xs font-medium transition hover:border-primary/50">
            View sample
          </Link>
        </div>
      </div>
    </div>
  );
}
