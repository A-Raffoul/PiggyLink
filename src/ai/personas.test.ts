/// <reference types="node" />

import { describe, expect, it } from "vitest";
import { pickVoice } from "./personas";

const voices = [
  { id: "v-adam", name: "Adam - Dominant, Firm" },
  { id: "v-alice", name: "Alice - Clear, Engaging Educator" },
  { id: "v-bill", name: "Bill - Wise, Mature, Balanced" },
  { id: "v-chris", name: "Chris - Charming, Down-to-Earth" },
  { id: "v-sarah", name: "Sarah - Mature, Reassuring, Confident" },
];

describe("personas", () => {
  it("picks the preferred voice for each persona", () => {
    expect(pickVoice(voices, "probe")).toBe("v-chris");
    expect(pickVoice(voices, "target")).toBe("v-sarah");
    expect(pickVoice(voices, "custom")).toBe("v-bill");
  });

  it("falls back to different list positions when no preferred voice exists", () => {
    const others = [
      { id: "v1", name: "Zed" },
      { id: "v2", name: "Yara" },
    ];
    expect(pickVoice(others, "probe")).toBe("v1");
    expect(pickVoice(others, "target")).toBe("v2");
    expect(pickVoice(others, "custom")).toBe("v1");
    expect(pickVoice([], "probe")).toBeUndefined();
    expect(pickVoice([], "custom")).toBeUndefined();
  });

  it("avoids Adam for a custom bot when another voice is available", () => {
    expect(pickVoice(voices.slice(0, 2), "custom")).toBe("v-alice");
  });
});
