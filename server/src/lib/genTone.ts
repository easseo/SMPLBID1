// Generates a small synthetic WAV file (sine-based tone with harmonics + envelope)
// so the demo has playable, license-free audio without any external assets.
export function generateToneWav(opts: {
  durationSeconds: number;
  baseFreq: number;
  sampleRate?: number;
}): Buffer {
  const sampleRate = opts.sampleRate ?? 22050;
  const numSamples = Math.floor(opts.durationSeconds * sampleRate);
  const data = Buffer.alloc(numSamples * 2);

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const envelope = Math.min(1, t * 8) * Math.min(1, (opts.durationSeconds - t) * 4 + 0.05);
    const fundamental = Math.sin(2 * Math.PI * opts.baseFreq * t);
    const harmonic2 = 0.4 * Math.sin(2 * Math.PI * opts.baseFreq * 2 * t);
    const harmonic3 = 0.2 * Math.sin(2 * Math.PI * opts.baseFreq * 3 * t);
    const vibrato = Math.sin(2 * Math.PI * 5 * t) * 0.03;
    const sample = (fundamental + harmonic2 + harmonic3) * (0.45 + vibrato) * Math.max(0, envelope);
    const clamped = Math.max(-1, Math.min(1, sample));
    data.writeInt16LE(Math.round(clamped * 32767), i * 2);
  }

  const header = Buffer.alloc(44);
  const byteRate = sampleRate * 2;
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(data.length, 40);

  return Buffer.concat([header, data]);
}
