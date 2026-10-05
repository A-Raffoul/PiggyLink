import { describe, expect, it } from "vitest";
import { Conversation } from "./conversation";
import { decodeFrame, encodeFrame } from "./frame";
import { decodeDialogue, encodeDialogue, dialogueState, MAX_DIALOGUE_BYTES, type DialogueAction, type DialogueHistory } from "./quiet-dialogue";

const flip = (history: DialogueHistory[]): DialogueHistory[] => history.map((turn) => ({ ...turn, from: turn.from === "me" ? "them" : "me" }));

describe("quiet conversation", () => {
  it("requires an offer and acceptance before quiet replies and finishes in bounded turns", () => {
    const history: DialogueHistory[] = [];
    expect(dialogueState(history).actions).toEqual(["speak"]);
    history.push({ from: "me", action: "speak" });
    expect(dialogueState(flip(history)).actions).toContain("offer");
    expect(dialogueState(history).actions).not.toContain("quiet");
    history.push({ from: "them", action: "offer" });
    expect(dialogueState(history)).toEqual({ phase: "spoken", actions: ["accept"] });
    history.push({ from: "me", action: "accept" });
    expect(dialogueState(history)).toEqual({ phase: "quiet", actions: ["quiet"] });
    expect(dialogueState(flip(history)).phase).toBe("quiet");
    history.push({ from: "them", action: "quiet" }, { from: "me", action: "quiet" });
    expect(dialogueState(history).actions).toEqual(["finish"]);
    history.push({ from: "them", action: "finish" });
    expect(dialogueState(history)).toEqual({ phase: "complete", actions: [] });
  });

  it("round trips fresh Unicode content through the CRC-protected wire", () => {
    for (const action of ["speak", "offer", "accept", "quiet", "finish", "ack"] as const) {
      const packet = { action, text: "Budget €40. Keep it discreet." };
      const encoded = encodeFrame({ senderId: "aaaa", sequence: 0, speechLead: 0, text: encodeDialogue(packet) });
      const decoded = decodeFrame(new TextEncoder().encode(encoded))!;
      expect(decodeDialogue(decoded.text)).toEqual(packet);
    }
    expect(() => encodeDialogue({ action: "quiet", text: "é".repeat(31) })).toThrow();
    expect(() => encodeDialogue({ action: "quiet", text: " " })).toThrow();
    expect(encodeDialogue({ action: "quiet", text: "x".repeat(MAX_DIALOGUE_BYTES) })).toHaveLength(64);
    expect(decodeDialogue("S4xunrecognized")).toBeUndefined();
    expect(decodeDialogue("S4q")).toBeUndefined();
  });

  it("recovers a lost acceptance and final acknowledgement without adding duplicate dialogue", () => {
    const alice = new Conversation("aaaa");
    const bob = new Conversation("bbbb");
    const send = (device: Conversation, action: DialogueAction, text: string) => device.send(encodeDialogue({ action, text }));
    bob.receive(send(alice, "offer", "Switch to Sotto?").frame);
    const acceptance = send(bob, "accept", "Sure.");
    const offer = alice.pending!;
    expect(bob.hasSeen(offer.frame)).toBe(true);
    expect(alice.hasSeen(acceptance.frame)).toBe(false);
    expect(bob.receive(offer.frame)).toEqual({ kind: "resend-reply", message: acceptance });
    alice.receive(acceptance.frame);
    expect(alice.hasSeen(acceptance.frame)).toBe(true);
    bob.receive(send(alice, "quiet", "Budget €40.").frame);
    const finish = send(bob, "finish", "Table confirmed.");
    alice.receive(finish.frame);
    const ack = alice.send(encodeDialogue({ action: "ack", text: "." }));
    expect(alice.receive(finish.frame)).toEqual({ kind: "resend-reply", message: ack });
    expect(bob.receive(ack.frame)).toMatchObject({ kind: "message", acknowledges: finish });
    expect(bob.pending).toBeUndefined();
  });
});
