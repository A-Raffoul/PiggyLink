import { describe, expect, it } from "vitest";
import { isWavFile } from "./wav";

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
