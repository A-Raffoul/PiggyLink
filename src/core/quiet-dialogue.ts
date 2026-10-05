import { MAX_MESSAGE_BYTES, utf8ByteLength } from "./config.js";

export const DIALOGUE_ACTIONS = ["speak", "offer", "accept", "quiet", "resume", "finish"] as const;
export type DialogueAction = (typeof DIALOGUE_ACTIONS)[number];
export type PacketAction = DialogueAction | "call" | "ack";
export interface DialogueMessage {
  readonly action: PacketAction;
  readonly text: string;
}
export interface DialogueHistory {
  readonly from: "me" | "them";
  readonly action?: DialogueAction;
}

// The existing CRC-protected frame carries this compact envelope. Opening packets
// carry the spoken transcript; quiet packets carry only the generated message.
// S5 makes the return to voice explicit; an S4 peer interpreted finish as quiet.
const PREFIX = "S5";
const CODES: Record<PacketAction, string> = {
  speak: "s", offer: "o", accept: "a", quiet: "q", resume: "r", finish: "f", call: "c", ack: "k",
};
export const MAX_DIALOGUE_BYTES = MAX_MESSAGE_BYTES - 3;

export function encodeDialogue(message: DialogueMessage): string {
  if (!message.text.trim() || utf8ByteLength(message.text) > MAX_DIALOGUE_BYTES)
    throw new Error(`Keep each line within ${MAX_DIALOGUE_BYTES} UTF-8 bytes.`);
  return `${PREFIX}${CODES[message.action]}${message.text}`;
}

export function decodeDialogue(text: string): DialogueMessage | undefined {
  if (!text.startsWith(PREFIX) || text.length <= 3 || utf8ByteLength(text) > MAX_MESSAGE_BYTES)
    return undefined;
  const action = (Object.keys(CODES) as PacketAction[]).find((key) => CODES[key] === text[2]);
  return action && text.slice(3).trim() ? { action, text: text.slice(3) } : undefined;
}

export function isQuietAction(action: PacketAction | undefined): boolean {
  return action === "quiet" || action === "resume" || action === "call" || action === "ack";
}

export function parseReceivedBudget(text: string): string | undefined {
  const match = /\bCHF\s*(\d+(?:[.,]\d{1,2})?)\b|\b(\d+(?:[.,]\d{1,2})?)\s*(?:CHF|Swiss francs?)\b/i.exec(text);
  return match ? `CHF ${match[1] ?? match[2]}` : undefined;
}

export function dialogueState(history: readonly DialogueHistory[]): {
  readonly phase: "spoken" | "quiet" | "closing" | "complete";
  readonly actions: readonly DialogueAction[];
} {
  if (history.some((turn) => turn.action === "finish"))
    return { phase: "complete", actions: [] };
  const resumed = history.findIndex((turn) => turn.action === "resume");
  if (resumed >= 0)
    return { phase: "closing", actions: history.slice(resumed + 1).some((turn) => turn.action === "speak") ? ["finish"] : ["speak"] };
  if (history.some((turn) => turn.action === "accept")) {
    const count = history.filter((turn) => turn.action === "quiet").length;
    return {
      phase: "quiet",
      actions: count >= 2 ? ["resume"] : ["quiet"],
    };
  }
  const last = history.at(-1);
  if (last?.from === "them" && last.action === "offer")
    return { phase: "spoken", actions: ["accept"] };
  // Restaurant greeting, caller's request, then the restaurant's response.
  // Their wording is fresh; the invitation follows this brief setup.
  const openingLines = history.filter((turn) => turn.action === "speak").length;
  return { phase: "spoken", actions: openingLines < 3 ? ["speak"] : ["offer"] };
}
