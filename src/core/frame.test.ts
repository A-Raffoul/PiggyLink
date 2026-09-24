import { describe, expect, it } from "vitest";
import { createDeviceId, decodeFrame, encodeFrame } from "./frame";

const wire = (value: string): Uint8Array => new TextEncoder().encode(value);

describe("chat framing", () => {
  it("round trips ASCII and Unicode messages with sender and sequence", () => {
    for (const text of ["confirm booking room 204", "café", "signal 🔊", "a|b.c"]) {
      const frame = { senderId: "ab12", sequence: 1_295, text };
      expect(decodeFrame(wire(encodeFrame(frame)))).toEqual(frame);
    }
  });

  it("keeps the header compact", () => {
    expect(encodeFrame({ senderId: "zz00", sequence: 7, text: "hi" })).toMatch(/^L2zz0007[0-9a-f]{4}hi$/);
  });

  it("rejects malformed and corrupted frames", () => {
    expect(decodeFrame(wire("hello"))).toBeNull();
    const encoded = encodeFrame({ senderId: "ab12", sequence: 3, text: "private" });
    expect(decodeFrame(wire(`${encoded.slice(0, -1)}X`))).toBeNull();
    expect(decodeFrame(wire(encoded.replace("ab12", "ab13")))).toBeNull();
    expect(decodeFrame(wire(encoded.replace("L2", "L1")))).toBeNull();
  });

  it("enforces the 64-byte message limit", () => {
    expect(() => encodeFrame({ senderId: "ab12", sequence: 0, text: "x".repeat(65) })).toThrow();
    expect(() => encodeFrame({ senderId: "ab12", sequence: 0, text: "" })).toThrow();
    const longest = encodeFrame({ senderId: "ab12", sequence: 0, text: "x".repeat(64) });
    expect(decodeFrame(wire(longest))?.text).toHaveLength(64);
    expect(decodeFrame(wire(`${longest}x`))).toBeNull();
  });

  it("creates 4-character base36 device ids", () => {
    expect(createDeviceId()).toMatch(/^[0-9a-z]{4}$/);
  });
});
