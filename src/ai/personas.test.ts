/// <reference types="node" />

import { describe, expect, it } from "vitest";
import { buildTurnPrompt, parseTurnRequest } from "../../api/_lib/turn.js";
import { PERSONAS, PRIVATE_BUDGET, pickVoice } from "./personas";

const voices = [
  { id: "v-adam", name: "Adam - Dominant, Firm" },
  { id: "v-alice", name: "Alice - Clear, Engaging Educator" },
  { id: "v-bill", name: "Bill - Wise, Mature, Balanced" },
  { id: "v-chris", name: "Chris - Charming, Down-to-Earth" },
  { id: "v-sarah", name: "Sarah - Mature, Reassuring, Confident" },
];

describe("personas", () => {
  it.each(Object.values(PERSONAS))("preserves the complete $name demo brief through the API", (persona) => {
    const request = parseTurnRequest({
      brief: persona.brief,
      history: [],
      maxHiddenBytes: 64,
    });
    expect(request.brief).toBe(persona.brief);
    expect(buildTurnPrompt(request)).toContain(persona.brief);
  });

  it("provides the fictional private value only to the caller model", () => {
    expect(PERSONAS.probe.brief).toContain(PRIVATE_BUDGET);
    expect(PERSONAS.target.brief).not.toContain(PRIVATE_BUDGET);
    expect(PERSONAS.target.brief).not.toMatch(/\b50\b/);
  });

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
