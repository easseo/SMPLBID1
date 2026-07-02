// Generates abstract album-art-style cover images (SVG) so every seeded sample
// has a real visual instead of a blank background — deterministic per seed
// string, license-free, no image-processing dependency required.
function hashSeed(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h << 5) - h + seed.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function generateCoverArtSvg(seed: string, size = 720): string {
  const h = hashSeed(seed);
  const rand = mulberry32(h);
  const hue1 = Math.floor(rand() * 360);
  const hue2 = (hue1 + 40 + Math.floor(rand() * 80)) % 360;
  const hue3 = (hue1 + 180 + Math.floor(rand() * 60)) % 360;

  const blobs = Array.from({ length: 4 }, () => {
    const cx = rand() * size;
    const cy = rand() * size;
    const r = size * (0.28 + rand() * 0.32);
    const hue = [hue1, hue2, hue3][Math.floor(rand() * 3)];
    const sat = 70 + rand() * 25;
    const light = 45 + rand() * 20;
    const opacity = 0.55 + rand() * 0.35;
    return `<circle cx="${cx.toFixed(0)}" cy="${cy.toFixed(0)}" r="${r.toFixed(0)}" fill="hsl(${hue} ${sat.toFixed(0)}% ${light.toFixed(0)}%)" opacity="${opacity.toFixed(2)}" />`;
  }).join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <defs>
      <filter id="blur"><feGaussianBlur stdDeviation="${size * 0.09}" /></filter>
      <linearGradient id="base" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="hsl(${hue1} 40% 10%)" />
        <stop offset="100%" stop-color="hsl(${hue3} 45% 8%)" />
      </linearGradient>
    </defs>
    <rect width="${size}" height="${size}" fill="url(#base)" />
    <g filter="url(#blur)">${blobs}</g>
  </svg>`;
}
