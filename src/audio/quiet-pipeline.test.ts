import { describe, expect, it } from "vitest";
import { getFrequencyPreset } from "../core/config";
import { decodeDialogue, encodeDialogue } from "../core/quiet-dialogue";
import { decodeFrame, encodeFrame } from "../core/frame";
import { createUltrasoundDecoder, encodeUltrasound } from "../modem/ggwave";
import { carrierOnly } from "./mix";

describe("quiet acoustic transport", () => {
  it.each([[48_000, "18000"], [48_000, "15000"], [48_000, "16000"], [48_000, "17000"]] as const)("decodes a private Unicode message without speech at %i Hz on channel %s", async (sampleRate, channel) => {
    const preset = getFrequencyPreset(channel);
    const text = "His budget is €40. Don't tell his date.";
    const wire = encodeFrame({ senderId: "aaaa", sequence: 2, speechLead: 0, text: encodeDialogue({ action: "quiet", text }) });
    const raw = await encodeUltrasound(wire, preset, sampleRate);
    const carrier = carrierOnly(raw, -18);
    let peak = 0;
    for (const sample of carrier) peak = Math.max(peak, Math.abs(sample));
    expect(peak).toBeCloseTo(10 ** (-18 / 20));
    const input = new Float32Array(carrier.length + 2 * sampleRate);
    input.set(carrier, sampleRate);
    const decoder = await createUltrasoundDecoder(preset, sampleRate);
    const messages: string[] = [];
    try {
      for (let offset = 0; offset + 1024 <= input.length; offset += 1024) {
        const decoded = decoder.decode(input.slice(offset, offset + 1024));
        if (decoded) {
          const frame = decodeFrame(decoded);
          if (frame) messages.push(decodeDialogue(frame.text)!.text);
        }
      }
    } finally { decoder.close(); }
    expect(messages).toEqual([text]);
  });

  it("rejects invalid volume and empty waveforms", () => {
    expect(() => carrierOnly(new Float32Array(100), -18)).toThrow();
    expect(() => carrierOnly(new Float32Array([1]), 0)).toThrow();
    expect(() => carrierOnly(new Float32Array([1]), NaN)).toThrow();
  });

  it("rejects unsupported browser sample rates instead of silently losing messages", async () => {
    await expect(createUltrasoundDecoder(getFrequencyPreset("18000"), 44_100)).rejects.toThrow("48 kHz browser audio");
  });
});
