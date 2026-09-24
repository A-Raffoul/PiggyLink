import { describe, expect, it } from "vitest";
import { decibelsToGain, extendCover, findAudioEnd, findAudioOnset, mixCarrierIntoCover, trimWithFade } from "./mix";

describe("audio onset detection", () => {
  it("locates the first non-silent 20 ms frame", () => {
    const samples = new Float32Array(4_800);
    samples.fill(0.4, 1_920);
    expect(findAudioOnset([samples], 48_000)).toBe(1_920);
  });

  it("locates the end of the last non-silent 20 ms frame", () => {
    const samples = new Float32Array(4_800);
    samples.fill(0.4, 0, 1_920);
    expect(findAudioEnd([samples], 48_000)).toBe(1_920);
  });
});

describe("trimming", () => {
  it("cuts to the requested length and fades the tail to silence", () => {
    const channel = new Float32Array(1_000).fill(0.5);
    const [trimmed] = trimWithFade([channel], 600, 1_000, 0.1);
    expect(trimmed).toHaveLength(600);
    expect(trimmed?.[400]).toBe(0.5);
    expect(trimmed?.[550]).toBeCloseTo(0.245);
    expect(trimmed?.[599]).toBe(0);
    expect(channel[599]).toBe(0.5);
  });
});

describe("cover extension", () => {
  it("returns the cover unchanged when it is already long enough", () => {
    const cover = new Float32Array(100).fill(0.5);
    expect(extendCover([cover], 100, 1_000)[0]).toBe(cover);
  });

  it("loops the spoken part, skipping leading and trailing silence", () => {
    const sampleRate = 1_000;
    const cover = new Float32Array(1_000);
    cover.fill(0.5, 100, 600);
    const [extended] = extendCover([cover], 2_000, sampleRate);

    expect(extended?.length).toBeGreaterThanOrEqual(2_000);
    expect(extended?.subarray(0, 600)).toEqual(cover.subarray(0, 600));
    // No long silence where the original trailing silence would have been.
    expect(Math.min(...(extended?.subarray(600, 2_000) ?? []))).toBeGreaterThan(0.2);
  });
});

describe("audio mixing", () => {
  it("converts decibels to linear gain", () => {
    expect(decibelsToGain(-20)).toBeCloseTo(0.1);
    expect(decibelsToGain(0)).toBe(1);
  });

  it("places the carrier after the requested delay on every channel", () => {
    const cover = [new Float32Array([0.5, 0.5, 0.5, 0.5]), new Float32Array([0.5, 0.5, 0.5, 0.5])];
    const carrier = new Float32Array([1, -1]);
    const mixed = mixCarrierIntoCover(cover, carrier, 1, -20, 10);

    expect(mixed.carrierScale).toBeCloseTo(0.05);
    expect([...mixed.channels[0] ?? []]).toEqual([0.5, 0.550000011920929, 0.44999998807907104, 0.5]);
    expect(mixed.channels[1]).toEqual(mixed.channels[0]);
    expect([...cover[0] ?? []]).toEqual([0.5, 0.5, 0.5, 0.5]);
  });

  it("applies headroom when the mix would clip", () => {
    const mixed = mixCarrierIntoCover([new Float32Array([0.95, 0.95])], new Float32Array([1]), 0, 0, 10);
    expect(mixed.outputScale).toBeLessThan(1);
    expect(mixed.peak).toBe(0.98);
    expect(mixed.channels[0]?.[0]).toBeCloseTo(0.98);
  });

  it("derives relative gain from the actual overlay interval", () => {
    const cover = new Float32Array([1, 0.1, 0.1]);
    const mixed = mixCarrierIntoCover([cover], new Float32Array([1, -1]), 1, -20, 10);
    expect(mixed.carrierScale).toBeCloseTo(0.01);
  });

  it("rejects a sustained quiet gap inside the overlay interval", () => {
    const cover = new Float32Array([0.5, 0.5, 0, 0, 0, 0.5]);
    expect(() =>
      mixCarrierIntoCover([cover], new Float32Array([1, 1, 1, 1, 1]), 1, -20, 10),
    ).toThrow("sustained quiet gap");
  });

  it("rejects a 250 ms quiet gap that is not aligned to analysis frames", () => {
    const cover = new Float32Array(400).fill(0.5);
    cover.fill(0, 25, 275);
    const carrier = new Float32Array(400).fill(1);
    expect(() => mixCarrierIntoCover([cover], carrier, 0, -20, 1_000)).toThrow(
      "sustained quiet gap",
    );
  });

  it("rejects short or silent cover audio", () => {
    expect(() => mixCarrierIntoCover([new Float32Array(1)], new Float32Array(2), 0, -20, 10)).toThrow(
      "too short",
    );
    expect(() => mixCarrierIntoCover([new Float32Array(2)], new Float32Array([1]), 0, -20, 10)).toThrow(
      "silent",
    );
  });
});
