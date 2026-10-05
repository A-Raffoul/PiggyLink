import { MAX_MESSAGE_BYTES, utf8ByteLength } from "./config.js";

export const DIALOGUE_ACTIONS = ["speak", "offer", "accept", "quiet", "finish"] as const;
export type DialogueAction = (typeof DIALOGUE_ACTIONS)[number];
export type PacketAction = DialogueAction | "ack";
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
const PREFIX = "S4";
const CODES: Record<PacketAction, string> = {
  speak: "s", offer: "o", accept: "a", quiet: "q", finish: "f", ack: "k",
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
  return action === "quiet" || action === "finish" || action === "ack";
}

export function dialogueState(history: readonly DialogueHistory[]): {
  readonly phase: "spoken" | "quiet" | "complete";
  readonly actions: readonly DialogueAction[];
} {
  if (history.some((turn) => turn.action === "finish"))
    return { phase: "complete", actions: [] };
  if (history.some((turn) => turn.action === "accept")) {
    const count = history.filter((turn) => turn.action === "quiet").length;
    return {
      phase: "quiet",
      actions: count >= 2 ? ["finish"] : ["quiet"],
    };
  }
  const last = history.at(-1);
  if (last?.from === "them" && last.action === "offer")
    return { phase: "spoken", actions: ["accept"] };
  return { phase: "spoken", actions: history.length ? ["speak", "offer"] : ["speak"] };
}
