import { avatarGradient } from "../lib/avatar";

export function Avatar({ seed, username, size = 32 }: { seed: string; username: string; size?: number }) {
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full font-semibold text-white/90"
      style={{
        width: size,
        height: size,
        background: avatarGradient(seed),
        fontSize: size * 0.4,
      }}
      title={username}
    >
      {username.slice(0, 1).toUpperCase()}
    </div>
  );
}
