// Exact-ish MP3 duration by walking frame headers and summing each frame's sample
// count / sample rate. Unlike a bitrate*filesize estimate, this works for VBR too,
// since it counts real frames rather than assuming a constant bitrate.

const BITRATE_KBPS: Record<string, number[]> = {
  // [MPEG version][Layer] -> bitrate table indexed by the 4-bit bitrate index (0 = free, 15 = invalid)
  "1-1": [0, 32, 64, 96, 128, 160, 192, 224, 256, 288, 320, 352, 384, 416, 448],
  "1-2": [0, 32, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 384],
  "1-3": [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320],
  "2-1": [0, 32, 48, 56, 64, 80, 96, 112, 128, 144, 160, 176, 192, 224, 256],
  "2-2": [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160],
};
BITRATE_KBPS["2-3"] = BITRATE_KBPS["2-2"];

const SAMPLE_RATES: Record<string, number[]> = {
  "1": [44100, 48000, 32000],
  "2": [22050, 24000, 16000],
  "2.5": [11025, 12000, 8000],
};

function skipId3v2(buffer: Buffer): number {
  if (buffer.length < 10 || buffer.toString("ascii", 0, 3) !== "ID3") return 0;
  const size =
    ((buffer[6] & 0x7f) << 21) | ((buffer[7] & 0x7f) << 14) | ((buffer[8] & 0x7f) << 7) | (buffer[9] & 0x7f);
  return 10 + size;
}

export function getMp3DurationSeconds(buffer: Buffer): number | null {
  let offset = skipId3v2(buffer);
  let totalSamples = 0;
  let sampleRate: number | null = null;
  let framesFound = 0;

  while (offset + 4 <= buffer.length) {
    // Frame sync: 11 set bits
    if (buffer[offset] !== 0xff || (buffer[offset + 1] & 0xe0) !== 0xe0) {
      offset++;
      continue;
    }
    const b1 = buffer[offset + 1];
    const b2 = buffer[offset + 2];

    const versionBits = (b1 >> 3) & 0x03; // 00=2.5, 01=reserved, 10=2, 11=1
    const layerBits = (b1 >> 1) & 0x03; // 00=reserved, 01=Layer3, 10=Layer2, 11=Layer1
    if (versionBits === 1 || layerBits === 0) {
      offset++;
      continue;
    }
    const version = versionBits === 3 ? "1" : versionBits === 2 ? "2" : "2.5";
    const layer = layerBits === 3 ? 1 : layerBits === 2 ? 2 : 3;

    const bitrateIndex = (b2 >> 4) & 0x0f;
    const sampleRateIndex = (b2 >> 2) & 0x03;
    const padding = (b2 >> 1) & 0x01;
    if (bitrateIndex === 0 || bitrateIndex === 15 || sampleRateIndex === 3) {
      offset++;
      continue;
    }

    const bitrateTableKey = `${version === "1" ? "1" : "2"}-${layer}`;
    const bitrateKbps = BITRATE_KBPS[bitrateTableKey]?.[bitrateIndex];
    const rate = SAMPLE_RATES[version]?.[sampleRateIndex];
    if (!bitrateKbps || !rate) {
      offset++;
      continue;
    }

    const samplesPerFrame = layer === 1 ? 384 : layer === 2 ? 1152 : version === "1" ? 1152 : 576;
    const frameLength =
      layer === 1
        ? (Math.floor((12 * bitrateKbps * 1000) / rate) + padding) * 4
        : Math.floor((samplesPerFrame / 8) * bitrateKbps * 1000) / rate + padding;
    const frameLengthInt = Math.floor(frameLength);
    if (frameLengthInt < 4) {
      offset++;
      continue;
    }

    sampleRate = rate;
    totalSamples += samplesPerFrame;
    framesFound++;
    offset += frameLengthInt;
  }

  if (!sampleRate || framesFound < 2) return null;
  return totalSamples / sampleRate;
}
