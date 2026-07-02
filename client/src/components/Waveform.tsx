export function Waveform({
  data,
  progress = 0,
  className = "",
  barClassName = "",
}: {
  data: number[];
  progress?: number;
  className?: string;
  barClassName?: string;
}) {
  return (
    <div className={`flex h-full items-center gap-[2px] ${className}`}>
      {data.map((v, i) => {
        const played = i / data.length <= progress;
        return (
          <div
            key={i}
            className={`w-full rounded-full transition-colors ${played ? "bg-primary" : "bg-border"} ${barClassName}`}
            style={{ height: `${Math.max(6, v * 100)}%` }}
          />
        );
      })}
    </div>
  );
}
