import { useCountdown } from "../hooks/useCountdown";

export function CountdownBadge({ endTime, ended }: { endTime: string; ended: boolean }) {
  const { label, isUrgent, isEnded } = useCountdown(endTime);
  const done = ended || isEnded;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold tabular-nums ${
        done
          ? "border-border bg-surface-2 text-muted"
          : isUrgent
            ? "border-live/50 bg-live/10 text-live"
            : "border-primary/30 bg-primary/10 text-primary"
      }`}
    >
      {!done && (
        <span className="relative flex h-1.5 w-1.5">
          <span
            className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${isUrgent ? "bg-live animate-ping" : "bg-primary"}`}
          />
          <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${isUrgent ? "bg-live" : "bg-primary"}`} />
        </span>
      )}
      {done ? "Ended" : label}
    </span>
  );
}
