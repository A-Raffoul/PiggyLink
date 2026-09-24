import type { FrequencyPreset } from "../core/config";
import {
  createSpectrumSurface,
  SPECTRUM_INTERVAL_MS,
} from "./frequency-spectrum";

export interface SpectrumRenderer {
  stop(): void;
}

export function renderSpectrum(
  canvas: HTMLCanvasElement,
  analyser: AnalyserNode,
  _preset: FrequencyPreset,
): SpectrumRenderer {
  analyser.fftSize = 2_048;
  analyser.smoothingTimeConstant = 0;
  const bins = new Float32Array(analyser.frequencyBinCount);
  const spectrum = createSpectrumSurface(
    canvas,
    analyser.context.sampleRate,
    analyser.fftSize,
  );
  let animationFrame = 0;
  let lastSample: number | undefined;
  let stopped = false;

  const draw = (now: number): void => {
    if (stopped) return;
    const rows =
      lastSample === undefined
        ? 1
        : Math.floor((now - lastSample) / SPECTRUM_INTERVAL_MS);
    if (rows > 0) {
      analyser.getFloatFrequencyData(bins);
      spectrum.push(bins);
      spectrum.redraw();
      lastSample =
        lastSample === undefined
          ? now
          : lastSample + rows * SPECTRUM_INTERVAL_MS;
    }
    animationFrame = requestAnimationFrame(draw);
  };
  animationFrame = requestAnimationFrame(draw);
  return {
    stop() {
      stopped = true;
      cancelAnimationFrame(animationFrame);
      spectrum.stop();
    },
  };
}
