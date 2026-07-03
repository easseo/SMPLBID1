import { useCountdown } from "../hooks/useCountdown";

function pad(n: number) {
  return n.toString().padStart(2, "0");
}

export function CountdownBadge({
  endTime,
  ended,
  size = "sm",
}: {
  endTime: string;
  ended: boolean;
  size?: "sm" | "lg";
}) {
  const { days, hours, minutes, seconds, isUrgent, isEnded } = useCountdown(endTime);
  const done = ended || isEnded;

  const sizeClass =
    size === "lg"
      ? "gap-2 px-5 py-2 text-sm lg:px-6 lg:py-2.5 lg:text-base 2xl:px-7 2xl:py-3 2xl:text-lg"
      : "gap-1.5 px-2.5 py-1 text-[10px] lg:text-xs";
  const dotClass = size === "lg" ? "h-2 w-2" : "h-1.5 w-1.5";

  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full border font-semibold tabular-nums ${sizeClass} ${
        done
          ? "border-border bg-surface-2 text-muted"
          : isUrgent
            ? "border-live/50 bg-live/10 text-live"
            : "border-primary/30 bg-primary/10 text-primary"
      }`}
    >
      {!done && (
        <span className={`relative flex ${dotClass}`}>
          <span
            className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${isUrgent ? "bg-live animate-ping" : "bg-primary"}`}
          />
          <span className={`relative inline-flex ${dotClass} rounded-full ${isUrgent ? "bg-live" : "bg-primary"}`} />
        </span>
      )}
      {done ? "Ended" : `${pad(days)}d ${pad(hours)}h ${pad(minutes)}m ${pad(seconds)}s`}
    </span>
  );
}

const CLOCK_UNITS = [
  { key: "days", label: "Days" },
  { key: "hours", label: "Hrs" },
  { key: "minutes", label: "Min" },
  { key: "seconds", label: "Sec" },
] as const;

/** Larger, boxed digital-clock display for the sample detail price card. */
export function CountdownClock({ endTime, ended }: { endTime: string; ended: boolean }) {
  const countdown = useCountdown(endTime);
  const done = ended || countdown.isEnded;

  if (done) {
    return (
      <div className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-center text-sm font-semibold text-muted">
        Ended
      </div>
    );
  }

  return (
    <div className="grid grid-cols-4 gap-1.5 lg:gap-2.5">
      {CLOCK_UNITS.map(({ key, label }) => (
        <div
          key={key}
          className={`rounded-lg border px-1.5 py-2 text-center lg:rounded-xl lg:py-3.5 ${
            countdown.isUrgent ? "border-live/50 bg-live/10" : "border-primary/30 bg-primary/10"
          }`}
        >
          <p className={`text-lg font-bold tabular-nums lg:text-3xl ${countdown.isUrgent ? "text-live" : "text-primary"}`}>
            {pad(countdown[key])}
          </p>
          <p className="mt-0.5 text-[9px] uppercase tracking-wide text-muted-2 lg:mt-1 lg:text-xs">{label}</p>
        </div>
      ))}
    </div>
  );
}
