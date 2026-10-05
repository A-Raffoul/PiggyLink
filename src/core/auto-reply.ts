// A received turn can be noticed by both the decoder and playback completion.
// Reserve it before awaiting anything so immediate replies cannot start twice.
export class AutoReplyGate {
  private readonly pending = new WeakSet<object>();

  async run(turn: object, reply: () => Promise<void>): Promise<void> {
    if (this.pending.has(turn)) return;
    this.pending.add(turn);
    try { await reply(); }
    finally { this.pending.delete(turn); }
  }
}
