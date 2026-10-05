import { describe, expect, it, vi } from "vitest";
import { AutoReplyGate } from "./auto-reply";

describe("immediate automatic replies", () => {
  it("starts immediately and reserves the turn across the first asynchronous boundary", async () => {
    const gate = new AutoReplyGate();
    const turn = {};
    let finish!: () => void;
    const pending = new Promise<void>((resolve) => { finish = resolve; });
    const reply = vi.fn(async () => { await pending; });
    const first = gate.run(turn, reply);
    const duplicate = gate.run(turn, reply);
    expect(reply).toHaveBeenCalledTimes(1);
    finish();
    await Promise.all([first, duplicate]);
    await gate.run({}, reply);
    expect(reply).toHaveBeenCalledTimes(2);
  });

  it("allows a retry if preparing the reply failed", async () => {
    const gate = new AutoReplyGate();
    const turn = {};
    await expect(gate.run(turn, async () => { throw new Error("Try again"); })).rejects.toThrow("Try again");
    const reply = vi.fn(async () => {});
    await gate.run(turn, reply);
    expect(reply).toHaveBeenCalledOnce();
  });
});
