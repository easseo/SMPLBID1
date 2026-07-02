// Exact duration from a WAV file's header — reliable because WAV is uncompressed
// PCM with a fixed byte rate, unlike MP3 where duration requires decoding frames.
export function getWavDurationSeconds(buffer: Buffer): number | null {
  if (buffer.length < 44) return null;
  if (buffer.toString("ascii", 0, 4) !== "RIFF" || buffer.toString("ascii", 8, 12) !== "WAVE") {
    return null;
  }

  let offset = 12;
  let byteRate: number | null = null;
  let dataSize: number | null = null;

  while (offset + 8 <= buffer.length) {
    const chunkId = buffer.toString("ascii", offset, offset + 4);
    const chunkSize = buffer.readUInt32LE(offset + 4);
    const chunkDataStart = offset + 8;
    if (chunkId === "fmt ") {
      // fmt chunk layout: audioFormat(2) numChannels(2) sampleRate(4) byteRate(4) ...
      byteRate = buffer.readUInt32LE(chunkDataStart + 8);
    } else if (chunkId === "data") {
      dataSize = chunkSize;
    }
    offset = chunkDataStart + chunkSize + (chunkSize % 2);
  }

  if (!byteRate || !dataSize) return null;
  return dataSize / byteRate;
}
