import { describe, expect, it } from "vitest";
import { FREQUENCY_PRESETS, getFrequencyPreset, utf8ByteLength } from "./config";

describe("frequency presets", () => {
  it("quantizes requested frequencies to ggwave FFT bins", () => {
    expect(FREQUENCY_PRESETS.map((preset) => preset.startBin)).toEqual([235, 256, 320, 341, 363, 384]);
    expect(getFrequencyPreset("12000").endHz).toBe(16_453.125);
    expect(getFrequencyPreset("18000").actualHz).toBe(18_000);
    expect(getFrequencyPreset("18000").endHz).toBe(22_453.125);
  });

  it("rejects unknown presets", () => {
    expect(() => getFrequencyPreset("19000")).toThrow("Unknown frequency preset");
  });
});

describe("UTF-8 byte length", () => {
  it("counts bytes instead of JavaScript characters", () => {
    expect(utf8ByteLength("hello")).toBe(5);
    expect(utf8ByteLength("é")).toBe(2);
    expect(utf8ByteLength("🔊")).toBe(4);
  });
});
