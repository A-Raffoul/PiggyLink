import { describe, expect, it } from "vitest";
import { frequencyPeaks } from "./frequency-spectrum";

describe("spectrum frequency mapping", () => {
  it("separates speech and a narrow high-frequency carrier without averaging the carrier away", () => {
    const bins = new Float32Array(1024).fill(-Infinity);
    bins[86] = -36; // 2015.625 Hz
    bins[768] = -48; // 18000 Hz
    bins[769] = -100; // A weak neighbor shares the carrier's display column.
    const peaks = frequencyPeaks(bins, 48_000, 2048);
    expect(peaks[43]).toBe(-36);
    expect(peaks[384]).toBe(-48);
    expect([...peaks].filter(Number.isFinite)).toHaveLength(2);
  });

  it("leaves unavailable high frequencies empty for a lower-rate microphone", () => {
    const bins = new Float32Array(1024).fill(-45);
    const peaks = frequencyPeaks(bins, 32_000, 2048);
    expect([...peaks.slice(342)].every((value) => value === -Infinity)).toBe(
      true,
    );
    expect(peaks[200]).toBe(-45);
  });

  it("treats silence and invalid FFT readings as empty instead of bright signals", () => {
    const bins = new Float32Array(1024).fill(-Infinity);
    bins[20] = NaN;
    bins[40] = Infinity;
    expect(
      [...frequencyPeaks(bins, 48_000, 2048)].every(
        (value) => value === -Infinity,
      ),
    ).toBe(true);
  });
});
