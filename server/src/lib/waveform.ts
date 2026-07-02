const BAR_COUNT = 64;

// Lightweight loudness-envelope approximation for UI visualization purposes.
// Computes RMS energy per chunk from the high byte of 16-bit-aligned samples,
// which stays a reasonable proxy for perceived loudness without fully decoding
// the audio codec (exact for our 16-bit PCM uploads, approximate for others).
export function buildWaveform(buffer: Buffer): number[] {
  if (buffer.length === 0) return new Array(BAR_COUNT).fill(0.1);
  const bars: number[] = [];
  const chunkSize = Math.max(2, Math.floor(buffer.length / BAR_COUNT));
  let peak = 0;
  const raw: number[] = [];
  for (let i = 0; i < BAR_COUNT; i++) {
    const start = i * chunkSize;
    const end = Math.min(buffer.length, start + chunkSize);
    let sumSq = 0;
    let count = 0;
    for (let j = start + 1; j < end; j += 2) {
      const centered = buffer[j] - 128;
      sumSq += centered * centered;
      count++;
    }
    const rms = count > 0 ? Math.sqrt(sumSq / count) / 128 : 0;
    raw.push(rms);
    if (rms > peak) peak = rms;
  }
  const scale = peak > 0 ? 1 / peak : 1;
  for (const rms of raw) {
    bars.push(Math.min(1, Math.max(0.06, rms * scale)));
  }
  return bars;
}
