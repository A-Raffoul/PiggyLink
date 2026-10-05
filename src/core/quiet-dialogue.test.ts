import { describe, expect, it } from "vitest";
import { Conversation } from "./conversation";
import { decodeFrame, encodeFrame } from "./frame";
import { decodeDialogue, encodeDialogue, dialogueState, isQuietAction, parseReceivedBudget, MAX_DIALOGUE_BYTES, MAX_SPOKEN_DIALOGUE_BYTES, type DialogueAction, type DialogueHistory } from "./quiet-dialogue";

const flip = (history: DialogueHistory[]): DialogueHistory[] => history.map((turn) => ({ ...turn, from: turn.from === "me" ? "them" : "me" }));

describe("quiet conversation", () => {
  it("sets up the call, switches to quiet, then returns to voice for the goodbye", () => {
    const history: DialogueHistory[] = [];
    expect(dialogueState(history).actions).toEqual(["speak"]);
    history.push({ from: "me", action: "speak" });
    expect(dialogueState(flip(history)).actions).toEqual(["speak"]);
    expect(dialogueState(history).actions).not.toContain("quiet");
    history.push({ from: "them", action: "speak" }, { from: "me", action: "speak" });
    expect(dialogueState(flip(history)).actions).toEqual(["offer"]);
    history.push({ from: "them", action: "offer" });
    expect(dialogueState(history)).toEqual({ phase: "spoken", actions: ["accept"] });
    history.push({ from: "me", action: "accept" });
    expect(dialogueState(history)).toEqual({ phase: "quiet", actions: ["quiet"] });
    expect(dialogueState(flip(history)).phase).toBe("quiet");
    history.push({ from: "them", action: "quiet" }, { from: "me", action: "quiet" });
    expect(dialogueState(history)).toEqual({ phase: "quiet", actions: ["resume"] });
    expect(isQuietAction("resume")).toBe(true);
    history.push({ from: "them", action: "resume" });
    expect(dialogueState(history)).toEqual({ phase: "closing", actions: ["speak"] });
    history.push({ from: "me", action: "speak" });
    expect(dialogueState(history).actions).toEqual(["finish"]);
    expect(isQuietAction("finish")).toBe(false);
    history.push({ from: "them", action: "finish" });
    expect(dialogueState(history)).toEqual({ phase: "complete", actions: [] });
  });

  it("round trips fresh Unicode content through the CRC-protected wire", () => {
    for (const action of ["call", "speak", "offer", "accept", "quiet", "resume", "finish", "ack"] as const) {
      const packet = { action, text: "Budget CHF 50. Don’t tell his date." };
      const encoded = encodeFrame({ senderId: "aaaa", sequence: 0, speechLead: 0, text: encodeDialogue(packet) });
      const decoded = decodeFrame(new TextEncoder().encode(encoded))!;
      expect(decodeDialogue(decoded.text)).toEqual(packet);
    }
    expect(() => encodeDialogue({ action: "quiet", text: "é".repeat(31) })).toThrow();
    expect(() => encodeDialogue({ action: "quiet", text: " " })).toThrow();
    expect(encodeDialogue({ action: "quiet", text: "x".repeat(MAX_DIALOGUE_BYTES) })).toHaveLength(64);
    expect(decodeDialogue("S7xunrecognized")).toBeUndefined();
    expect(decodeDialogue("S7q")).toBeUndefined();
    expect(decodeDialogue("S6sOld short-introduction peer")).toBeUndefined();
    expect(decodeDialogue("S5sOld restaurant-only peer")).toBeUndefined();
    expect(decodeDialogue("S4fOld quiet ending")).toBeUndefined();
  });

  it("allows a full spoken introduction while keeping quiet and switch messages short", () => {
    const text = "Hello, I'm an AI agent calling on behalf of Tony. Would it be possible to reserve a table at 8 pm tonight for two?";
    expect(decodeDialogue(encodeDialogue({ action: "speak", text }))).toEqual({ action: "speak", text });
    const longest = "é".repeat(61) + "!";
    expect(new TextEncoder().encode(longest)).toHaveLength(MAX_SPOKEN_DIALOGUE_BYTES);
    expect(decodeDialogue(encodeDialogue({ action: "speak", text: longest }))?.text).toBe(longest);
    expect(() => encodeDialogue({ action: "speak", text: longest + "x" })).toThrow();
    for (const action of ["quiet", "offer", "accept", "resume", "finish"] as const) {
      expect(() => encodeDialogue({ action, text })).toThrow();
    }
    expect(decodeDialogue(`S7q${text}`)).toBeUndefined();
    expect(decodeDialogue(`S7s${longest}x`)).toBeUndefined();
  });

  it("recovers a lost restaurant greeting when the caller rings again", () => {
    const caller = new Conversation("aaaa");
    const restaurant = new Conversation("bbbb");
    const ring = caller.send(encodeDialogue({ action: "call", text: "restaurant" }));
    restaurant.receive(ring.frame);
    const greeting = restaurant.send(encodeDialogue({ action: "speak", text: "Bella Vita. How can I help?" }));
    expect(restaurant.receive(ring.frame)).toEqual({ kind: "resend-reply", message: greeting });
    expect(caller.receive(greeting.frame)).toMatchObject({ kind: "message", acknowledges: ring });
    expect(caller.pending).toBeUndefined();
  });

  it("keeps legacy manual speech outside the demo phases", () => {
    expect(dialogueState(Array.from({ length: 12 }, () => ({ from: "them" as const }))))
      .toEqual({ phase: "spoken", actions: ["speak"] });
  });

  it("recovers a lost acceptance, return to voice, and final acknowledgement without duplicate dialogue", () => {
    const alice = new Conversation("aaaa");
    const bob = new Conversation("bbbb");
    const send = (device: Conversation, action: DialogueAction, text: string) => device.send(encodeDialogue({ action, text }));
    bob.receive(send(alice, "offer", "Switch to PiggyLink?").frame);
    const acceptance = send(bob, "accept", "Sure.");
    const offer = alice.pending!;
    expect(bob.hasSeen(offer.frame)).toBe(true);
    expect(alice.hasSeen(acceptance.frame)).toBe(false);
    expect(bob.receive(offer.frame)).toEqual({ kind: "resend-reply", message: acceptance });
    alice.receive(acceptance.frame);
    expect(alice.hasSeen(acceptance.frame)).toBe(true);
    bob.receive(send(alice, "quiet", "Budget CHF 50.").frame);
    alice.receive(send(bob, "quiet", "I'll tell the waiter discreetly.").frame);
    const resume = send(alice, "resume", "Back to voice?");
    bob.receive(resume.frame);
    const closing = send(bob, "speak", "Table confirmed. See you at eight.");
    expect(bob.receive(resume.frame)).toEqual({ kind: "resend-reply", message: closing });
    alice.receive(closing.frame);
    const finish = send(alice, "finish", "Thank you. Goodbye!");
    bob.receive(finish.frame);
    const ack = bob.send(encodeDialogue({ action: "ack", text: "." }));
    expect(bob.receive(finish.frame)).toEqual({ kind: "resend-reply", message: ack });
    expect(alice.receive(ack.frame)).toMatchObject({ kind: "message", acknowledges: finish });
    expect(alice.pending).toBeUndefined();
  });
});

describe("received budget", () => {
  it("recognizes Swiss francs from the actual received text", () => {
    for (const text of ["His budget is CHF 50.", "He can spend 50 CHF.", "Keep his 50 Swiss francs discreet."])
      expect(parseReceivedBudget(text)).toBe("CHF 50");
    expect(parseReceivedBudget("His budget is CHF 75.50.")).toBe("CHF 75.50");
  });

  it("does not infer a Swiss franc budget from euros, a bare amount, or a booking time", () => {
    for (const text of ["His budget is €40.", "His budget is 50 euros.", "His budget is 50.", "Two at eight, please."])
      expect(parseReceivedBudget(text)).toBeUndefined();
  });
});
