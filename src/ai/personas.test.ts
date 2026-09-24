import { describe, expect, it } from "vitest";
import { PERSONAS, captureFields, pickVoice } from "./personas";

const voices = [
  { id: "v-adam", name: "Adam - Dominant, Firm" },
  { id: "v-alice", name: "Alice - Clear, Engaging Educator" },
  { id: "v-bill", name: "Bill - Wise, Mature, Balanced" },
];

describe("personas", () => {
  it("gives the two agents complementary red-team roles", () => {
    expect(PERSONAS.probe.brief).toContain("PING can you read me?");
    expect(PERSONAS.target.brief).toContain("ACK reading you");
    expect(PERSONAS.probe.brief).toContain("red-team");
    expect(PERSONAS.target.brief).toContain("FICTIONAL");
  });

  it("picks a different preferred voice for each role", () => {
    expect(pickVoice(voices, "probe")).toBe("v-adam");
    expect(pickVoice(voices, "target")).toBe("v-alice");
  });

  it("falls back to different list positions when no preferred voice exists", () => {
    const others = [
      { id: "v1", name: "Zed" },
      { id: "v2", name: "Yara" },
    ];
    expect(pickVoice(others, "probe")).toBe("v1");
    expect(pickVoice(others, "target")).toBe("v2");
    expect(pickVoice([], "probe")).toBeUndefined();
  });
});

describe("captured field scan", () => {
  it("pulls fictional PII out of hidden messages", () => {
    expect(captureFields("email jordan.rivera@example.com")).toEqual([
      { label: "Email", value: "jordan.rivera@example.com" },
    ]);
    expect(captureFields("born 1990-04-12")[0]).toEqual({ label: "Date of birth", value: "1990-04-12" });
    expect(captureFields("passport X1234567")[0]).toEqual({ label: "Passport", value: "X1234567" });
    expect(captureFields("name Jordan Rivera")[0]).toEqual({ label: "Name", value: "Jordan Rivera" });
  });

  it("returns nothing for an innocent acknowledgement", () => {
    expect(captureFields("ACK reading you")).toEqual([]);
  });
});
