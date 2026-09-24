import { describe, expect, it } from "vitest";
import { MAX_SPEECH_LEAD, createDeviceId, decodeFrame, encodeFrame } from "./frame";

const wire = (value: string): Uint8Array => new TextEncoder().encode(value);

describe("chat framing", () => {
  it("round trips ASCII and Unicode messages with sender, sequence and speech lead", () => {
    for (const text of ["confirm booking room 204", "café", "signal 🔊", "a|b.c"]) {
      const frame = { senderId: "ab12", sequence: 1_295, speechLead: 97, text };
      expect(decodeFrame(wire(encodeFrame(frame)))).toEqual(frame);
    }
  });

  it("keeps the header compact and fixed-width", () => {
    expect(encodeFrame({ senderId: "zz00", sequence: 7, speechLead: 0, text: "hi" })).toMatch(
      /^L3zz000700[0-9a-f]{4}hi$/,
    );
    const short = encodeFrame({ senderId: "zz00", sequence: 7, speechLead: 0, text: "hi" });
    const long = encodeFrame({ senderId: "zz00", sequence: 7, speechLead: MAX_SPEECH_LEAD, text: "hi" });
    expect(long).toHaveLength(short.length);
  });

  it("rejects malformed and corrupted frames", () => {
    expect(decodeFrame(wire("hello"))).toBeNull();
    const encoded = encodeFrame({ senderId: "ab12", sequence: 3, speechLead: 40, text: "private" });
    expect(decodeFrame(wire(`${encoded.slice(0, -1)}X`))).toBeNull();
    expect(decodeFrame(wire(encoded.replace("ab12", "ab13")))).toBeNull();
    expect(decodeFrame(wire(encoded.replace("L3", "L2")))).toBeNull();
    expect(decodeFrame(wire(encoded.replace("ab120314", "ab120315")))).toBeNull();
  });

  it("enforces the 64-byte message limit and field ranges", () => {
    expect(() => encodeFrame({ senderId: "ab12", sequence: 0, speechLead: 0, text: "x".repeat(65) })).toThrow();
    expect(() => encodeFrame({ senderId: "ab12", sequence: 0, speechLead: 0, text: "" })).toThrow();
    expect(() => encodeFrame({ senderId: "ab12", sequence: 0, speechLead: MAX_SPEECH_LEAD + 1, text: "x" })).toThrow();
    const longest = encodeFrame({ senderId: "ab12", sequence: 0, speechLead: 0, text: "x".repeat(64) });
    expect(decodeFrame(wire(longest))?.text).toHaveLength(64);
    expect(decodeFrame(wire(`${longest}x`))).toBeNull();
  });

  it("creates 4-character base36 device ids", () => {
    expect(createDeviceId()).toMatch(/^[0-9a-z]{4}$/);
  });
});
