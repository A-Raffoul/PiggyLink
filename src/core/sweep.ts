export const SWEEP_START_HZ = 15_000;
export const SWEEP_END_HZ = 22_000;
export const SWEEP_STEP_HZ = 250;
export const SWEEP_TONE_SECONDS = 0.3;
export const SWEEP_GAP_SECONDS = 0.1;

export function createSteppedSweep(sampleRate: number): Float32Array {
  const frequencies: number[] = [];
  for (let frequency = SWEEP_START_HZ; frequency <= SWEEP_END_HZ; frequency += SWEEP_STEP_HZ) frequencies.push(frequency);
  const toneLength = Math.round(sampleRate * SWEEP_TONE_SECONDS);
  const gapLength = Math.round(sampleRate * SWEEP_GAP_SECONDS);
  const samples = new Float32Array(frequencies.length * (toneLength + gapLength));
  frequencies.forEach((frequency, step) => {
    const start = step * (toneLength + gapLength);
    for (let index = 0; index < toneLength; index += 1) {
      const fade = Math.min(1, index / 240, (toneLength - 1 - index) / 240);
      samples[start + index] = 0.35 * fade * Math.sin((2 * Math.PI * frequency * index) / sampleRate);
    }
  });
  return samples;
}
