export const OPERATING_SAMPLE_RATE = 48_000;
export const FFT_SIZE = 1_024;
export const TONE_SPAN_BINS = 95;
export const OVERLAY_DELAY_SECONDS = 0.25;
export const MAX_MESSAGE_BYTES = 32;

export interface FrequencyPreset {
  readonly id: string;
  readonly label: string;
  readonly requestedHz: number;
  readonly startBin: number;
  readonly actualHz: number;
  readonly endHz: number;
}

function makePreset(requestedHz: number): FrequencyPreset {
  const hzPerBin = OPERATING_SAMPLE_RATE / FFT_SIZE;
  const startBin = Math.round(requestedHz / hzPerBin);
  const actualHz = startBin * hzPerBin;

  return {
    id: String(requestedHz),
    label: `${requestedHz / 1_000} kHz`,
    requestedHz,
    startBin,
    actualHz,
    endHz: (startBin + TONE_SPAN_BINS) * hzPerBin,
  };
}

// 11/12 kHz are calibration probes for asymmetric hardware paths; they may be audible.
export const FREQUENCY_PRESETS = [11_000, 12_000, 15_000, 16_000, 17_000, 18_000].map(makePreset);

export function getFrequencyPreset(id: string): FrequencyPreset {
  const preset = FREQUENCY_PRESETS.find((candidate) => candidate.id === id);
  if (!preset) {
    throw new Error(`Unknown frequency preset: ${id}`);
  }
  return preset;
}

export function utf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

export function formatKhz(hz: number): string {
  return `${(hz / 1_000).toFixed(2)} kHz`;
}
