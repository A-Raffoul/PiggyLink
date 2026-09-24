import type { FrequencyPreset } from "../core/config";

const MIN_HZ = 10_000;

export interface SpectrumRenderer {
  stop(): void;
}

export function renderSpectrum(
  canvas: HTMLCanvasElement,
  analyser: AnalyserNode,
  preset: FrequencyPreset,
): SpectrumRenderer {
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas rendering is unavailable.");

  analyser.fftSize = 2_048;
  analyser.smoothingTimeConstant = 0.72;
  const bins = new Float32Array(analyser.frequencyBinCount);
  let animationFrame = 0;
  let stopped = false;

  const draw = (): void => {
    if (stopped) return;
    const ratio = window.devicePixelRatio || 1;
    const width = Math.max(1, canvas.clientWidth);
    const height = Math.max(1, canvas.clientHeight);
    if (canvas.width !== width * ratio || canvas.height !== height * ratio) {
      canvas.width = width * ratio;
      canvas.height = height * ratio;
    }
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, width, height);

    const maximumHz = Math.min(24_000, analyser.context.sampleRate / 2);
    const toX = (frequency: number): number =>
      ((frequency - MIN_HZ) / (maximumHz - MIN_HZ)) * width;

    context.fillStyle = "rgba(124, 255, 193, 0.07)";
    const highlightStart = Math.max(0, toX(preset.actualHz));
    const highlightEnd = Math.min(width, toX(preset.endHz));
    context.fillRect(highlightStart, 0, Math.max(0, highlightEnd - highlightStart), height);

    context.strokeStyle = "rgba(255, 255, 255, 0.09)";
    context.lineWidth = 1;
    for (let frequency = 10_000; frequency <= maximumHz; frequency += 2_000) {
      const x = toX(frequency);
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x, height);
      context.stroke();
    }

    analyser.getFloatFrequencyData(bins);
    context.beginPath();
    context.lineWidth = 2;
    context.strokeStyle = "#79f2b2";
    let drawing = false;
    for (let index = 0; index < bins.length; index += 1) {
      const frequency = (index * analyser.context.sampleRate) / analyser.fftSize;
      if (frequency < MIN_HZ || frequency > maximumHz) continue;
      const decibels = Math.max(-140, Math.min(-20, bins[index] ?? -140));
      const x = toX(frequency);
      const y = height - ((decibels + 140) / 120) * height;
      if (!drawing) {
        context.moveTo(x, y);
        drawing = true;
      } else context.lineTo(x, y);
    }
    context.stroke();
    animationFrame = requestAnimationFrame(draw);
  };

  draw();
  return {
    stop() {
      stopped = true;
      cancelAnimationFrame(animationFrame);
      context.clearRect(0, 0, canvas.width, canvas.height);
    },
  };
}
