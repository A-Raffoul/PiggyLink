function asciiAt(bytes: Uint8Array, offset: number, value: string): boolean {
  return [...value].every((character, index) => bytes[offset + index] === character.charCodeAt(0));
}

export function isWavFile(bytes: ArrayBufferLike): boolean {
  if (bytes.byteLength < 12) return false;
  const view = new Uint8Array(bytes, 0, 12);
  return asciiAt(view, 0, "RIFF") && asciiAt(view, 8, "WAVE");
}

export function encodeWav(channels: readonly Float32Array[], sampleRate: number): Uint8Array {
  const first = channels[0];
  if (!first || channels.length === 0 || channels.some((channel) => channel.length !== first.length)) {
    throw new Error("WAV channels must be present and equal in length.");
  }
  const bytesPerSample = 2;
  const dataLength = first.length * channels.length * bytesPerSample;
  const bytes = new Uint8Array(44 + dataLength);
  const view = new DataView(bytes.buffer);
  const writeText = (offset: number, value: string): void => {
    [...value].forEach((character, index) => view.setUint8(offset + index, character.charCodeAt(0)));
  };
  writeText(0, "RIFF");
  view.setUint32(4, 36 + dataLength, true);
  writeText(8, "WAVE");
  writeText(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels.length, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * channels.length * bytesPerSample, true);
  view.setUint16(32, channels.length * bytesPerSample, true);
  view.setUint16(34, 16, true);
  writeText(36, "data");
  view.setUint32(40, dataLength, true);
  let offset = 44;
  for (let sample = 0; sample < first.length; sample += 1) {
    for (const channel of channels) {
      const value = Math.max(-1, Math.min(1, channel[sample] ?? 0));
      view.setInt16(offset, Math.round(value * (value < 0 ? 32_768 : 32_767)), true);
      offset += bytesPerSample;
    }
  }
  return bytes;
}
