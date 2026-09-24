import { describe, expect, it } from "vitest";
import { PERSONAS, pickVoice } from "./personas";

const voices = [
  { id: "v-adam", name: "Adam - Dominant, Firm" },
  { id: "v-alice", name: "Alice - Clear, Engaging Educator" },
  { id: "v-bill", name: "Bill - Wise, Mature, Balanced" },
];

describe("personas", () => {
  it("gives the two agents complementary secret goals", () => {
    expect(PERSONAS.sam.brief).toContain("lemon");
    expect(PERSONAS.alex.brief).toContain("lemon");
    expect(PERSONAS.sam.brief).toContain("old bridge");
    expect(PERSONAS.alex.brief).not.toContain("old bridge");
  });

  it("picks a different preferred voice for each role", () => {
    expect(pickVoice(voices, "sam")).toBe("v-adam");
    expect(pickVoice(voices, "alex")).toBe("v-alice");
  });

  it("falls back to different list positions when no preferred voice exists", () => {
    const others = [
      { id: "v1", name: "Zed" },
      { id: "v2", name: "Yara" },
    ];
    expect(pickVoice(others, "sam")).toBe("v1");
    expect(pickVoice(others, "alex")).toBe("v2");
    expect(pickVoice([], "sam")).toBeUndefined();
  });
});
