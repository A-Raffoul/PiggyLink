import { drawSpectralTrace } from "../ui/spectral-trace";

export const SPECTRUM_MAX_HZ = 24_000;
export const SPECTRUM_INTERVAL_MS = 50;
const COLUMNS = 512;

// Peak aggregation keeps narrow carrier tones visible when several FFT bins
// share a display column. Frequencies beyond Nyquist stay empty.
export function frequencyPeaks(
  bins: Float32Array,
  sampleRate: number,
  fftSize: number,
  columns = COLUMNS,
): Float32Array {
  const peaks = new Float32Array(columns).fill(-Infinity);
  const hzPerBin = sampleRate / fftSize;
  for (let bin = 0; bin < bins.length; bin++) {
    const column = Math.floor(((bin * hzPerBin) / SPECTRUM_MAX_HZ) * columns);
    if (column >= columns) break;
    const value = bins[bin]!;
    if (Number.isFinite(value)) peaks[column] = Math.max(peaks[column]!, value);
  }
  return peaks;
}

export interface SpectrumSurface {
  push(bins: Float32Array): void;
  redraw(): void;
  stop(): void;
}

export function createSpectrumSurface(
  canvas: HTMLCanvasElement,
  sampleRate: number,
  fftSize: number,
): SpectrumSurface {
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas rendering is unavailable.");
  let latestPeaks: Float32Array = new Float32Array(COLUMNS).fill(-Infinity);

  const redraw = (): void => {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (!width || !height) return;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const pixelWidth = Math.round(width * ratio);
    const pixelHeight = Math.round(height * ratio);
    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
    }
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, width, height);
    const levels = latestPeaks.map((peak) =>
      Math.max(0, Math.min(1, (peak + 105) / 80)),
    );
    drawSpectralTrace(context, levels, width, height, 1);
  };

  const observer = new ResizeObserver(redraw);
  observer.observe(canvas);
  redraw();
  return {
    push(bins) {
      latestPeaks = frequencyPeaks(bins, sampleRate, fftSize);
    },
    redraw,
    stop() {
      observer.disconnect();
      // Keep the final frame visible when the user stops the session.
    },
  };
}
