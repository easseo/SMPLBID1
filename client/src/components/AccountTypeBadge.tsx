import { ShoppingBag, Sparkles, Layers } from "lucide-react";
import type { AccountType } from "../lib/types";

const CONFIG: Record<AccountType, { label: string; icon: React.ReactNode; className: string }> = {
  buyer: {
    label: "Buyer",
    icon: <ShoppingBag size={12} />,
    className: "border-verified/30 bg-verified/10 text-verified",
  },
  seller: {
    label: "Creator",
    icon: <Sparkles size={12} />,
    className: "border-accent/30 bg-accent/10 text-accent",
  },
  both: {
    label: "Buyer & Creator",
    icon: <Layers size={12} />,
    // Sits visually "between" the buyer and creator badges — a gradient blending both colors.
    className: "border-primary/30 bg-gradient-to-r from-verified/15 to-accent/15 text-primary",
  },
};

export function AccountTypeBadge({ type, size = "sm" }: { type: AccountType; size?: "sm" | "md" }) {
  const cfg = CONFIG[type];
  const padding = size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border font-semibold ${padding} ${cfg.className}`}>
      {cfg.icon}
      {cfg.label}
    </span>
  );
}
