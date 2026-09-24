import { describe, expect, it } from "vitest";
import { AudioRing, downsample, encodeWav, int16ToFloat32 } from "./pcm";

describe("PCM helpers", () => {
  it("converts little-endian 16-bit PCM to floats", () => {
    const bytes = new Int16Array([0, 16_384, -32_768]).buffer;
    expect([...int16ToFloat32(bytes)]).toEqual([0, 0.5, -1]);
  });

  it("downsamples by averaging groups", () => {
    expect([...downsample(new Float32Array([1, 2, 3, 4, 5, 6, 7]), 3)]).toEqual([2, 5]);
  });

  it("encodes a 16-bit mono WAV", () => {
    const wav = encodeWav(new Float32Array([0, 1, -1]), 16_000);
    const view = new DataView(wav);
    expect(String.fromCharCode(...new Uint8Array(wav, 0, 4))).toBe("RIFF");
    expect(view.getUint32(24, true)).toBe(16_000);
    expect(view.getUint32(40, true)).toBe(6);
    expect(view.getInt16(46, true)).toBe(32_767);
    expect(view.getInt16(48, true)).toBe(-32_767);
  });
});

describe("audio ring buffer", () => {
  it("returns the most recent samples in order across wrap-around", () => {
    const ring = new AudioRing(4);
    ring.push(new Float32Array([1, 2, 3]));
    ring.push(new Float32Array([4, 5, 6]));
    expect([...ring.latest(3)]).toEqual([4, 5, 6]);
    expect([...ring.latest(10)]).toEqual([3, 4, 5, 6]);
  });

  it("returns only what has been written", () => {
    const ring = new AudioRing(10);
    ring.push(new Float32Array([7, 8]));
    expect([...ring.latest(5)]).toEqual([7, 8]);
  });
});
