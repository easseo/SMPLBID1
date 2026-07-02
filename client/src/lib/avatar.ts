function hashSeed(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h << 5) - h + seed.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

export function avatarGradient(seed: string): string {
  const h = hashSeed(seed);
  const hue1 = h % 360;
  const hue2 = (hue1 + 55 + (h % 40)) % 360;
  return `linear-gradient(135deg, hsl(${hue1} 80% 60%), hsl(${hue2} 85% 55%))`;
}
