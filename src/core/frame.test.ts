import { describe, expect, it } from "vitest";
import { decodePrivateFrame, encodePrivateFrame } from "./frame";

describe("private message framing", () => {
  it("round trips ASCII and Unicode messages", () => {
    for (const message of ["confirm booking room 204", "café", "signal 🔊"]) {
      expect(decodePrivateFrame(encodePrivateFrame(message))).toBe(message);
    }
  });

  it("rejects malformed and corrupted frames", () => {
    expect(decodePrivateFrame("hello")).toBeNull();
    const frame = encodePrivateFrame("private");
    expect(decodePrivateFrame(`${frame.slice(0, -1)}0`)).toBeNull();
    expect(decodePrivateFrame(frame.replace("SL1", "SL2"))).toBeNull();
  });

  it("rejects otherwise valid payloads above the receiver limit", () => {
    expect(decodePrivateFrame(encodePrivateFrame("x".repeat(33)))).toBeNull();
  });
});
