import { describe, expect, it } from "vitest";
import { encodeWav, isWavFile } from "./wav";

function header(riff = "RIFF", wave = "WAVE"): ArrayBuffer {
  const bytes = new Uint8Array(12);
  [...riff].forEach((character, index) => (bytes[index] = character.charCodeAt(0)));
  [...wave].forEach((character, index) => (bytes[index + 8] = character.charCodeAt(0)));
  return bytes.buffer;
}

describe("WAV validation", () => {
  it("accepts RIFF/WAVE headers", () => {
    expect(isWavFile(header())).toBe(true);
  });

  it("rejects short and non-WAV files", () => {
    expect(isWavFile(new ArrayBuffer(4))).toBe(false);
    expect(isWavFile(header("FORM", "AIFF"))).toBe(false);
  });
});

it("encodes interleaved PCM WAV data", () => {
  const bytes = encodeWav([new Float32Array([0, 1]), new Float32Array([0, -1])], 48_000);
  const view = new DataView(bytes.buffer);
  expect(isWavFile(bytes.buffer)).toBe(true);
  expect(view.getUint16(22, true)).toBe(2);
  expect(view.getUint32(24, true)).toBe(48_000);
  expect(view.getInt16(48, true)).toBe(32_767);
  expect(view.getInt16(50, true)).toBe(-32_768);
});
