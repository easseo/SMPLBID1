import { BadgeCheck } from "lucide-react";

export function VerifiedBadge({ size = 14 }: { size?: number }) {
  return <BadgeCheck size={size} className="shrink-0 text-verified" aria-label="Verified seller" />;
}
