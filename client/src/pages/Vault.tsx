import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Vault as VaultIcon, Download, ShieldCheck } from "lucide-react";
import { api, centsToDisplay } from "../lib/api";
import { VerifiedBadge } from "../components/VerifiedBadge";

interface VaultSample {
  id: string;
  title: string;
  genre: string;
  bpm: number;
  key: string;
  imageUrl: string | null;
  finalPriceCents: number;
  endTime: string;
  seller: { username: string; verified: boolean };
  hasStems: boolean;
  hasMidi: boolean;
  certificateCode: string | null;
}

export function Vault() {
  const [samples, setSamples] = useState<VaultSample[] | null>(null);

  useEffect(() => {
    api.get<{ samples: VaultSample[] }>("/vault").then((res) => setSamples(res.samples));
  }, []);

  return (
    <div className="mx-auto max-w-[1800px] px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="flex items-center gap-2 text-3xl font-bold">
        <VaultIcon className="text-accent" /> Vault
      </h1>
      <p className="mt-1 text-sm text-muted">Every sample you've won — yours to download, forever.</p>

      {samples === null ? (
        <p className="mt-10 text-center text-sm text-muted">Loading your vault…</p>
      ) : samples.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed border-border p-12 text-center">
          <p className="text-muted">Nothing here yet — win an auction and it'll show up in your vault.</p>
          <Link to="/arena" className="mt-4 inline-block rounded-lg bg-primary px-4 py-2 text-sm font-medium text-background">
            Enter the Arena
          </Link>
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {samples.map((s) => (
            <div key={s.id} className="flex flex-col overflow-hidden rounded-2xl border border-border bg-surface">
              <div className="relative aspect-[4/3] w-full overflow-hidden">
                {s.imageUrl && <img src={s.imageUrl} alt="" className="h-full w-full object-cover" />}
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
                <div className="absolute bottom-2 left-3 right-3">
                  <p className="truncate font-semibold text-white">{s.title}</p>
                  <p className="text-xs text-white/70">
                    {s.genre} · {s.bpm} BPM · {s.key}
                  </p>
                </div>
              </div>

              <div className="flex flex-1 flex-col gap-3 p-4">
                <div className="flex items-center justify-between text-xs text-muted">
                  <span className="flex items-center gap-1">
                    from {s.seller.username}
                    {s.seller.verified && <VerifiedBadge size={12} />}
                  </span>
                  <span className="font-semibold text-foreground">{centsToDisplay(s.finalPriceCents)}</span>
                </div>

                <a
                  href={`/api/samples/${s.id}/full`}
                  download
                  className="shimmer-bg flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold shadow-lg transition hover:scale-[1.02]"
                >
                  <Download size={15} /> Download full-quality file
                </a>

                {(s.hasStems || s.hasMidi) && (
                  <div className="grid grid-cols-2 gap-2">
                    {s.hasStems && (
                      <a
                        href={`/api/samples/${s.id}/stems`}
                        download
                        className={`flex items-center justify-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-xs font-semibold text-primary transition hover:bg-primary/20 ${
                          s.hasMidi ? "" : "col-span-2"
                        }`}
                      >
                        <Download size={13} /> Stems
                      </a>
                    )}
                    {s.hasMidi && (
                      <a
                        href={`/api/samples/${s.id}/midi`}
                        download
                        className={`flex items-center justify-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-xs font-semibold text-primary transition hover:bg-primary/20 ${
                          s.hasStems ? "" : "col-span-2"
                        }`}
                      >
                        <Download size={13} /> MIDI
                      </a>
                    )}
                  </div>
                )}

                {s.certificateCode && (
                  <Link
                    to={`/certificate/${s.certificateCode}`}
                    className="flex items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium text-muted transition hover:border-primary/40 hover:text-foreground"
                  >
                    <ShieldCheck size={13} /> View ownership certificate
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
