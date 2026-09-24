import { describe, expect, it } from "vitest";
import { buildTurnPrompt, parseTurn, parseTurnRequest, truncateUtf8 } from "./turn";

describe("turn requests", () => {
  it("validates and normalises the request", () => {
    const request = parseTurnRequest({
      writer: "something-else",
      brief: "  Be Sam.  ",
      history: [{ from: "me", spoken: "Hi", hidden: "x" }, { from: "?", hidden: "y" }],
      maxHiddenBytes: 64,
    });
    expect(request.writer).toBe("elevenlabs");
    expect(request.brief).toBe("Be Sam.");
    expect(request.history[1]).toEqual({ from: "them", spoken: "", hidden: "y" });
  });

  it("rejects an empty brief and bad limits", () => {
    expect(() => parseTurnRequest({ brief: " ", history: [], maxHiddenBytes: 64 })).toThrow("brief");
    expect(() => parseTurnRequest({ brief: "x", history: [], maxHiddenBytes: 2 })).toThrow("maxHiddenBytes");
  });

  it("puts the brief and the history into the prompt", () => {
    const prompt = buildTurnPrompt({
      writer: "elevenlabs",
      brief: "You are Sam.",
      history: [{ from: "them", spoken: "Hello!", hidden: "meet at 9" }],
      maxHiddenBytes: 64,
    });
    expect(prompt).toContain("You are Sam.");
    expect(prompt).toContain('They said out loud: "Hello!"; hidden message: "meet at 9"');
    expect(prompt).toContain("at most 60 characters");
  });
});

describe("turn parsing", () => {
  it("extracts JSON even when wrapped in extra text", () => {
    const turn = parseTurn('Sure!\n```json\n{"spoken": "Hi there.", "hidden": "bridge 9pm"}\n```', 64);
    expect(turn).toEqual({ spoken: "Hi there.", hidden: "bridge 9pm" });
  });

  it("caps the hidden message at the byte limit without splitting characters", () => {
    const turn = parseTurn(JSON.stringify({ spoken: "Hi.", hidden: "é".repeat(40) }), 64);
    expect(new TextEncoder().encode(turn.hidden).length).toBe(64);
    expect(truncateUtf8("aé", 2)).toBe("a");
  });

  it("rejects replies that are not a usable turn", () => {
    expect(() => parseTurn("no json here", 64)).toThrow();
    expect(() => parseTurn('{"spoken": "Hi"}', 64)).toThrow();
    expect(() => parseTurn('{"spoken": "", "hidden": "x"}', 64)).toThrow();
  });
});
