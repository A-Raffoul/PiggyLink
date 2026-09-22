import { expect, it } from "vitest";
import { createSteppedSweep, SWEEP_END_HZ, SWEEP_GAP_SECONDS, SWEEP_START_HZ, SWEEP_STEP_HZ, SWEEP_TONE_SECONDS } from "./sweep";

it("creates a stepped probe with silent gaps", () => {
  const rate = 48_000;
  const steps = (SWEEP_END_HZ - SWEEP_START_HZ) / SWEEP_STEP_HZ + 1;
  const samples = createSteppedSweep(rate);
  expect(samples.length).toBe(steps * Math.round(rate * (SWEEP_TONE_SECONDS + SWEEP_GAP_SECONDS)));
  expect(samples.some((sample) => sample !== 0)).toBe(true);
  expect(samples[Math.round(rate * SWEEP_TONE_SECONDS) + 20]).toBe(0);
});
