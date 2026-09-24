import { describe, expect, it } from "vitest";
import { ChannelSense } from "./channel";

const FRAME_MS = 21;

function feed(sense: ChannelSense, levels: number[], start = 0): { busy: boolean; end: number } {
  let busy = false;
  let now = start;
  for (const level of levels) {
    now += FRAME_MS;
    busy = sense.update(level, now, false);
  }
  return { busy, end: now };
}

const repeat = (level: number, frames: number): number[] => Array<number>(frames).fill(level);

describe("channel sensing", () => {
  it("stays clear on steady room noise", () => {
    expect(feed(new ChannelSense(), repeat(-120, 200)).busy).toBe(false);
  });

  it("does not learn from warm-up silence", () => {
    const sense = new ChannelSense();
    const warmUp = feed(sense, [...repeat(Number.NEGATIVE_INFINITY, 20), ...repeat(-160, 20)]);
    expect(feed(sense, repeat(-120, 60), warmUp.end).busy).toBe(false);
  });

  it("reports a transmission well above the floor, then clears after it ends", () => {
    const sense = new ChannelSense();
    const quiet = feed(sense, repeat(-120, 100));
    const signal = feed(sense, repeat(-95, 200), quiet.end);
    expect(signal.busy).toBe(true);
    expect(feed(sense, repeat(-120, 40), signal.end).busy).toBe(false);
  });

  it("re-learns the floor when the room gets permanently louder", () => {
    const sense = new ChannelSense();
    const quiet = feed(sense, repeat(-130, 100));
    const louder = feed(sense, repeat(-100, Math.ceil(17_000 / FRAME_MS)), quiet.end);
    expect(louder.busy).toBe(false);
  });

  it("is busy while this device is transmitting", () => {
    const sense = new ChannelSense();
    feed(sense, repeat(-120, 50));
    expect(sense.update(-120, 5_000, true)).toBe(true);
    expect(sense.update(-120, 5_300, false)).toBe(true);
    expect(sense.update(-120, 5_700, false)).toBe(false);
  });
});
