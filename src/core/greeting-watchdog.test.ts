import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Conversation } from "./conversation";
import { GreetingWatchdog } from "./greeting-watchdog";
import { encodeDialogue } from "./quiet-dialogue";

describe("spoken greeting watchdog", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("lets a late caller join through the replay, then stops on its reply", async () => {
    const restaurant = new Conversation("bbbb");
    const greeting = restaurant.send(encodeDialogue({ action: "speak", text: "Bella Vita. How can I help?" }));
    const caller = new Conversation("aaaa"); // Started after the original greeting.
    const watchdog = new GreetingWatchdog();
    const exhausted = vi.fn();
    const replay = vi.fn(async () => {
      expect(caller.receive(greeting.frame)).toMatchObject({ kind: "message" });
      const reply = caller.send(encodeDialogue({ action: "speak", text: "Hello, I'm Tony's AI agent. Table for two tonight?" }));
      restaurant.receive(reply.frame);
      watchdog.cancel();
    });
    watchdog.start({ isPending: () => restaurant.pending === greeting, replay, onExhausted: exhausted });
    await vi.advanceTimersByTimeAsync(1_999);
    expect(replay).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(replay).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(replay).toHaveBeenCalledOnce();
    expect(restaurant.upcomingSequence).toBe(1);
    expect(exhausted).not.toHaveBeenCalled();
  });

  it("cancels before the timer when the run ends", async () => {
    const watchdog = new GreetingWatchdog();
    const replay = vi.fn(async () => {});
    watchdog.start({ isPending: () => true, replay, onExhausted: vi.fn() });
    await vi.advanceTimersByTimeAsync(1_000);
    watchdog.cancel();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(replay).not.toHaveBeenCalled();
  });

  it("invalidates a replay waiting for a clear channel when a reply arrives", async () => {
    const watchdog = new GreetingWatchdog();
    let release!: () => void;
    const channel = new Promise<void>((resolve) => { release = resolve; });
    const play = vi.fn();
    const replay = vi.fn(async (isPending: () => boolean) => {
      await channel;
      if (isPending()) play();
    });
    watchdog.start({ isPending: () => true, replay, onExhausted: vi.fn() });
    await vi.advanceTimersByTimeAsync(2_000);
    expect(replay).toHaveBeenCalledOnce();
    watchdog.cancel();
    release();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(play).not.toHaveBeenCalled();
    expect(replay).toHaveBeenCalledOnce();
  });

  it("waits for replay playback to finish before starting the next two-second window", async () => {
    const watchdog = new GreetingWatchdog();
    const replay = vi.fn(() => new Promise<void>((resolve) => setTimeout(resolve, 4_000)));
    const exhausted = vi.fn();
    watchdog.start({ isPending: () => true, replay, onExhausted: exhausted });
    await vi.advanceTimersByTimeAsync(2_000);
    expect(replay).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(5_999);
    expect(replay).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(1);
    expect(replay).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(6_000);
    expect(replay).toHaveBeenCalledTimes(3);
    await vi.advanceTimersByTimeAsync(5_999);
    expect(exhausted).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(exhausted).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(replay).toHaveBeenCalledTimes(3);
  });

  it("does not replay a greeting that is no longer pending", async () => {
    const watchdog = new GreetingWatchdog();
    let pending = true;
    const replay = vi.fn(async () => {});
    watchdog.start({ isPending: () => pending, replay, onExhausted: vi.fn() });
    pending = false;
    await vi.advanceTimersByTimeAsync(60_000);
    expect(replay).not.toHaveBeenCalled();
  });

  it("abandons an older run and stops retries after a playback failure", async () => {
    const watchdog = new GreetingWatchdog();
    const oldReplay = vi.fn(async () => {});
    const exhausted = vi.fn();
    watchdog.start({ isPending: () => true, replay: oldReplay, onExhausted: exhausted });
    const newReplay = vi.fn(async () => { throw new Error("Audio stopped"); });
    watchdog.start({ isPending: () => true, replay: newReplay, onExhausted: exhausted });
    await vi.advanceTimersByTimeAsync(60_000);
    expect(oldReplay).not.toHaveBeenCalled();
    expect(newReplay).toHaveBeenCalledOnce();
    expect(exhausted).toHaveBeenCalledOnce();
  });
});
