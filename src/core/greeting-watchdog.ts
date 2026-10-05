const RETRY_DELAY_MS = 2_000;
const MAX_RETRIES = 3;

interface GreetingRetry {
  readonly isPending: () => boolean;
  readonly replay: (isPending: () => boolean) => Promise<void>;
  readonly onExhausted: () => void;
  readonly delayMs?: number;
}

// Start after the greeting finishes playing. Replays reuse its original audio;
// only an actual peer response advances the conversation.
export class GreetingWatchdog {
  private version = 0;
  private timer: ReturnType<typeof setTimeout> | undefined;

  cancel(): void {
    this.version += 1;
    clearTimeout(this.timer);
    this.timer = undefined;
  }

  start({ isPending, replay, onExhausted, delayMs = RETRY_DELAY_MS }: GreetingRetry): void {
    this.cancel();
    const version = this.version;
    let retries = 0;
    const pending = (): boolean => this.version === version && isPending();
    const schedule = (): void => {
      if (!pending()) return;
      this.timer = setTimeout(() => { void retry(); }, delayMs);
    };
    const retry = async (): Promise<void> => {
      this.timer = undefined;
      if (!pending()) return;
      // Leave a response window after the last replay before reporting failure.
      if (retries === MAX_RETRIES) {
        onExhausted();
        return;
      }
      retries += 1;
      try { await replay(pending); }
      catch {
        if (pending()) onExhausted();
        return;
      }
      schedule();
    };
    schedule();
  }
}
