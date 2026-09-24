import { SEQUENCE_MODULO, encodeFrame, type ChatFrame } from "./frame";

export type Turn = "mine" | "theirs";

export interface OutgoingMessage {
  readonly frame: ChatFrame;
  readonly wire: string;
  readonly inReplyTo: string | undefined;
}

export type ReceiveOutcome =
  | { readonly kind: "own" }
  | { readonly kind: "message"; readonly frame: ChatFrame; readonly acknowledges: OutgoingMessage | undefined }
  | { readonly kind: "duplicate" }
  | { readonly kind: "resend-reply"; readonly message: OutgoingMessage };

const keyOf = (frame: ChatFrame): string => `${frame.senderId}:${frame.sequence}`;

// Strict turn-taking: sending passes the turn, and a new message from the peer hands it back.
export class Conversation {
  private turnState: Turn = "mine";
  private nextSequence = 0;
  private lastSent: OutgoingMessage | undefined;
  private lastAcceptedKey: string | undefined;
  private readonly seen = new Set<string>();

  constructor(readonly deviceId: string) {}

  get turn(): Turn {
    return this.turnState;
  }

  get pending(): OutgoingMessage | undefined {
    return this.turnState === "theirs" ? this.lastSent : undefined;
  }

  get upcomingSequence(): number {
    return this.nextSequence;
  }

  send(text: string, speechLead = 0): OutgoingMessage {
    if (this.turnState !== "mine") throw new Error("Wait for a reply before sending again.");
    const frame = { senderId: this.deviceId, sequence: this.nextSequence, speechLead, text };
    const message = { frame, wire: encodeFrame(frame), inReplyTo: this.lastAcceptedKey };
    this.nextSequence = (this.nextSequence + 1) % SEQUENCE_MODULO;
    this.lastSent = message;
    this.turnState = "theirs";
    return message;
  }

  receive(frame: ChatFrame): ReceiveOutcome {
    if (frame.senderId === this.deviceId) return { kind: "own" };

    const key = keyOf(frame);
    if (this.seen.has(key)) {
      // The peer re-sent a message we already answered, so our answer never reached them.
      if (this.lastSent && this.lastSent.inReplyTo === key) return { kind: "resend-reply", message: this.lastSent };
      return { kind: "duplicate" };
    }

    this.seen.add(key);
    this.lastAcceptedKey = key;
    const acknowledges = this.turnState === "theirs" ? this.lastSent : undefined;
    this.turnState = "mine";
    return { kind: "message", frame, acknowledges };
  }
}
