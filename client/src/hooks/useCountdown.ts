import { useEffect, useState } from "react";

export function useCountdown(endTime: string | Date) {
  const target = new Date(endTime).getTime();
  const [remainingMs, setRemainingMs] = useState(() => Math.max(0, target - Date.now()));

  useEffect(() => {
    const tick = () => setRemainingMs(Math.max(0, target - Date.now()));
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [target]);

  const totalSeconds = Math.floor(remainingMs / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  let label: string;
  if (remainingMs <= 0) label = "Ended";
  else if (days > 0) label = `${days}d ${hours}h`;
  else if (hours > 0) label = `${hours}h ${minutes}m`;
  else if (minutes > 0) label = `${minutes}m ${seconds}s`;
  else label = `${seconds}s`;

  return { remainingMs, label, isEnded: remainingMs <= 0, isUrgent: remainingMs > 0 && remainingMs <= 60_000 };
}
