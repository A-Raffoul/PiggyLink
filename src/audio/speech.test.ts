import { describe, expect, it } from "vitest";
import { SpeechDetector } from "./speech";

function harness() {
  const detector = new SpeechDetector();
  let now = 0;
  const windows: number[] = [];
  const feed = (db: number, milliseconds: number, blocked = false): void => {
    for (let elapsed = 0; elapsed < milliseconds; elapsed += 20) {
      now += 20;
      const seconds = detector.update(db, now, blocked);
      if (seconds !== undefined) windows.push(seconds);
    }
  };
  return { detector, windows, feed };
}

describe("ordinary speech detection", () => {
  it("emits one utterance after a pause without requiring a modem packet", () => {
    const { detector, windows, feed } = harness();
    feed(-85, 600);
    feed(-38, 1_200);
    expect(detector.active).toBe(true);
    feed(-85, 600);
    expect(windows).toEqual([]);
    feed(-85, 600);
    expect(windows).toHaveLength(1);
    expect(windows[0]).toBeCloseTo(2.28, 1);
    expect(detector.active).toBe(false);
    feed(-85, 2_000);
    expect(windows).toHaveLength(1);
  });

  it("ignores startup silence, steady room noise and short clicks", () => {
    const { windows, feed } = harness();
    feed(-Infinity, 500);
    feed(-70, 1_000);
    feed(-25, 100);
    feed(-70, 2_000);
    expect(windows).toEqual([]);
  });

  it("does not split a sentence at a short pause", () => {
    const { windows, feed } = harness();
    feed(-80, 400);
    feed(-35, 400);
    feed(-80, 350);
    feed(-35, 500);
    feed(-80, 1_100);
    expect(windows).toHaveLength(1);
    expect(windows[0]).toBeGreaterThan(2);
  });

  it("discards speech paired with a carrier and suppresses the playback tail", () => {
    const { windows, feed } = harness();
    feed(-85, 400);
    feed(-35, 600);
    feed(-35, 1_000, true);
    feed(-35, 500);
    feed(-85, 1_200);
    expect(windows).toEqual([]);
    feed(-35, 800);
    feed(-85, 1_100);
    expect(windows).toHaveLength(1);
  });

  it("bounds long recordings instead of allocating indefinitely", () => {
    const { windows, feed } = harness();
    feed(-85, 400);
    feed(-35, 21_000);
    expect(windows).toHaveLength(1);
    expect(windows[0]).toBeLessThanOrEqual(20.2);
  });
});
