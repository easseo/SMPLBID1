// Exact duration for M4A/MP4 containers by walking box headers down to moov/mvhd,
// which stores duration and timescale directly — no audio decoding needed.
export function getM4aDurationSeconds(buffer: Buffer): number | null {
  const moov = findBox(buffer, "moov", 0, buffer.length);
  if (!moov) return null;
  const mvhd = findBox(buffer, "mvhd", moov.dataStart, moov.dataStart + moov.dataSize);
  if (!mvhd) return null;

  const version = buffer[mvhd.dataStart];
  if (version === 1) {
    const timescale = buffer.readUInt32BE(mvhd.dataStart + 20);
    const duration = Number(buffer.readBigUInt64BE(mvhd.dataStart + 24));
    if (!timescale) return null;
    return duration / timescale;
  }
  const timescale = buffer.readUInt32BE(mvhd.dataStart + 12);
  const duration = buffer.readUInt32BE(mvhd.dataStart + 16);
  if (!timescale) return null;
  return duration / timescale;
}

function findBox(
  buffer: Buffer,
  targetType: string,
  start: number,
  end: number
): { dataStart: number; dataSize: number } | null {
  let offset = start;
  while (offset + 8 <= end) {
    let size = buffer.readUInt32BE(offset);
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    let headerSize = 8;
    if (size === 1) {
      size = Number(buffer.readBigUInt64BE(offset + 8));
      headerSize = 16;
    }
    if (size < headerSize) return null;
    if (type === targetType) {
      return { dataStart: offset + headerSize, dataSize: size - headerSize };
    }
    offset += size;
  }
  return null;
}
