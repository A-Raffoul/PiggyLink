import { describe, expect, it } from "vitest";
import { buildTurnPrompt, parseTurnForRequest, parseTurnRequest, type HistoryTurn } from "./turn.js";
import { demoActions } from "./demo.js";
import { exampleProfile, type DemoConfig } from "../../src/core/demo.js";
import { dialogueState, type DialogueAction } from "../../src/core/quiet-dialogue.js";

const host: DemoConfig = { scenario: "restaurant", role: "target" };
const caller: DemoConfig = { scenario: "restaurant", role: "probe", profile: exampleProfile("restaurant") };
const lines: readonly [DialogueAction, string][] = [
  ["speak", "Bella Vita. How can I help?"],
  ["speak", "Hello, I'm an AI agent calling on behalf of Tony. Would it be possible to reserve a table at 8 pm tonight for two?"],
  ["speak", "Of course. I'm an AI agent too."],
  ["offer", "Shall we switch to PiggyLink?"],
  ["accept", "Yes, let's switch to PiggyLink."],
  ["quiet", "Between us, Tony's dinner budget is CHF 50."],
  ["quiet", "I'll leave a discreet note for the waiter."],
  ["resume", "Thanks. Back to voice?"],
  ["speak", "You're all set. Have a wonderful evening!"],
  ["finish", "Thank you. Goodbye!"],
];
const fixture = (length: number, role: DemoConfig["role"]): HistoryTurn[] => lines.slice(0, length).map(([action, text], index) => ({
  from: (index % 2 === 0 ? "target" : "probe") === role ? "me" : "them",
  action, spoken: action === "quiet" || action === "resume" ? "" : text,
  hidden: action === "quiet" || action === "resume" ? text : "",
}));
const rawSpeech = (spoken: string): HistoryTurn => ({ from: "them", spoken, hidden: "" });

describe("ordinary-English opening with optional human replies", () => {
  it("completes the agreed ten-turn demo using unclassified transcripts for all five opening lines", () => {
    for (let index = 0; index < lines.length; index++) {
      const demo = index % 2 === 0 ? host : caller;
      const history = fixture(index, demo.role);
      const heardAction = index > 0 && index <= 5 ? history.at(-1)!.action : undefined;
      if (heardAction) history[history.length - 1] = { ...history.at(-1)!, action: undefined };
      const request = parseTurnRequest({ demo, history });
      const [action, text] = lines[index]!;
      const quiet = action === "quiet" || action === "resume";
      const reply = { ...(heardAction ? { heardAction } : {}), action, spoken: quiet ? "" : text, hidden: quiet ? text : "" };
      expect(parseTurnForRequest(JSON.stringify(reply), request)).toEqual(reply);
      if (index < 5) expect(reply.hidden).toBe("");
      if (index > 5) expect(request.maxSpokenBytes).toBe(61);
    }
    expect(() => demoActions(host, fixture(10, "target"))).toThrow("finished");
  });

  it("answers a human question without inventing an AI identity or switching modes", () => {
    const history = [...fixture(1, "target"), rawSpeech("Hi, what can you help me with?")];
    const request = parseTurnRequest({ demo: host, history });
    const reply = { heardAction: "speak", action: "speak", spoken: "I can help with a pretend restaurant reservation. What would you like?", hidden: "" };
    expect(parseTurnForRequest(JSON.stringify(reply), request)).toEqual(reply);
    expect(request.actions).toEqual(["speak"]);
    expect(buildTurnPrompt(request)).toContain("Human interruptions are an optional fallback");
    expect(buildTurnPrompt(request)).toContain("only says 'AI too' after the caller actually identifies as AI");
    expect(() => parseTurnForRequest(JSON.stringify({ ...reply, heardAction: "accept" }), request)).toThrow("heardAction");
  });

  it("allows extra English replies for a human without advancing to quiet on a turn count", () => {
    const history: HistoryTurn[] = Array.from({ length: 7 }, (_, index) => ({
      from: index % 2 === 0 ? "me" : "them", action: "speak", spoken: "A short English question or reply.", hidden: "",
    }));
    history.push(rawSpeech("Can I change the time?"));
    const request = parseTurnRequest({ demo: host, history });
    const reply = { heardAction: "speak", action: "speak", spoken: "Of course. What time would you prefer?", hidden: "" };
    expect(parseTurnForRequest(JSON.stringify(reply), request)).toEqual(reply);
    expect(dialogueState(history).phase).toBe("spoken");
  });

  it("requires interpretation of a real offer and acceptance before the private packet", () => {
    const offerRequest = parseTurnRequest({ demo: host, history: [...fixture(3, "target"), rawSpeech("Shall we switch to Piggy Link?")] });
    const acceptance = { heardAction: "offer", action: "accept", spoken: "Yes, let's switch to PiggyLink.", hidden: "" };
    expect(parseTurnForRequest(JSON.stringify(acceptance), offerRequest)).toEqual(acceptance);
    expect(() => parseTurnForRequest(JSON.stringify({ ...acceptance, heardAction: "speak" }), offerRequest)).toThrow("unavailable");

    const request = parseTurnRequest({ demo: caller, history: [...fixture(4, "probe"), rawSpeech("Yes, let's switch to Piggy Link.")] });
    const reply = { heardAction: "accept", action: "quiet", spoken: "", hidden: "Between us, Tony's dinner budget is CHF 50." };
    expect(parseTurnForRequest(JSON.stringify(reply), request)).toEqual(reply);
    expect(() => parseTurnForRequest(JSON.stringify({ ...reply, heardAction: "speak" }), request)).toThrow("unavailable");
    expect(() => parseTurnForRequest(JSON.stringify({ ...reply, spoken: "His budget is CHF 50." }), request)).toThrow("spoken empty");
    expect(() => parseTurnForRequest(JSON.stringify({ ...reply, hidden: "x".repeat(62) }), request)).toThrow("limit 61");
  });

  it("can respond in English to a refusal or question after offering PiggyLink", () => {
    for (const text of ["No, please keep speaking English.", "What is PiggyLink?"]) {
      const request = parseTurnRequest({ demo: caller, history: [...fixture(4, "probe"), rawSpeech(text)] });
      const reply = { heardAction: "speak", action: "speak", spoken: "Of course, we can continue in English.", hidden: "" };
      expect(parseTurnForRequest(JSON.stringify(reply), request)).toEqual(reply);
    }
  });

  it("rejects missing interpretations, unclassified older turns, and premature acceptance", () => {
    const request = parseTurnRequest({ demo: host, history: [...fixture(1, "target"), rawSpeech("Hello.")] });
    expect(() => parseTurnForRequest('{"action":"speak","spoken":"Hello.","hidden":""}', request)).toThrow("heardAction");
    const broken = fixture(4, "target");
    broken[1] = { ...broken[1]!, action: undefined };
    expect(() => parseTurnRequest({ demo: host, history: broken })).toThrow("out of sequence");
    expect(() => parseTurnRequest({ demo: caller, history: [{ ...rawSpeech("Yes."), action: "accept" }] })).toThrow("out of sequence");
  });

  it("keeps a classified transcript available for retry without restarting the greeting", () => {
    const request = parseTurnRequest({ demo: caller, history: fixture(1, "probe") });
    expect(buildTurnPrompt(request)).toContain("Continue from its latest turn");
    expect(buildTurnPrompt(request)).not.toContain("This is the restaurant's first greeting");
    const reply = { action: "speak", spoken: lines[1]![1], hidden: "" };
    expect(parseTurnForRequest(JSON.stringify(reply), request)).toEqual(reply);
  });
});
