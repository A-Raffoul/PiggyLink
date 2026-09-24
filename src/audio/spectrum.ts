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

    analyser.getFloatFrequencyData(bins);

    // Energy in the active ggwave band drives a pulse, so a transmission visibly lights the band up.
    let bandPeak = -140;
    for (let index = 0; index < bins.length; index += 1) {
      const frequency = (index * analyser.context.sampleRate) / analyser.fftSize;
      if (frequency >= preset.actualHz && frequency <= preset.endHz) bandPeak = Math.max(bandPeak, bins[index] ?? -140);
    }
    const bandHeat = Math.max(0, Math.min(1, (bandPeak + 95) / 45));

    const highlightStart = Math.max(0, toX(preset.actualHz));
    const highlightEnd = Math.min(width, toX(preset.endHz));
    const bandWidth = Math.max(0, highlightEnd - highlightStart);
    context.fillStyle = `rgba(124, 255, 193, ${0.06 + bandHeat * 0.28})`;
    context.fillRect(highlightStart, 0, bandWidth, height);
    context.strokeStyle = `rgba(124, 255, 193, ${0.25 + bandHeat * 0.6})`;
    context.lineWidth = 1;
    context.strokeRect(highlightStart, 0.5, bandWidth, height - 1);

    context.strokeStyle = "rgba(255, 255, 255, 0.07)";
    context.lineWidth = 1;
    for (let frequency = 12_000; frequency <= maximumHz; frequency += 2_000) {
      const x = toX(frequency);
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x, height);
      context.stroke();
    }

    const points: [number, number][] = [];
    for (let index = 0; index < bins.length; index += 1) {
      const frequency = (index * analyser.context.sampleRate) / analyser.fftSize;
      if (frequency < MIN_HZ || frequency > maximumHz) continue;
      const decibels = Math.max(-140, Math.min(-20, bins[index] ?? -140));
      points.push([toX(frequency), height - ((decibels + 140) / 120) * height]);
    }

    if (points.length > 1) {
      const first = points[0]!;
      const last = points[points.length - 1]!;
      const fill = context.createLinearGradient(0, 0, 0, height);
      fill.addColorStop(0, "rgba(121, 242, 178, 0.35)");
      fill.addColorStop(1, "rgba(121, 242, 178, 0.02)");
      context.beginPath();
      context.moveTo(first[0], height);
      for (const [x, y] of points) context.lineTo(x, y);
      context.lineTo(last[0], height);
      context.closePath();
      context.fillStyle = fill;
      context.fill();

      context.beginPath();
      context.moveTo(first[0], first[1]);
      for (const [x, y] of points) context.lineTo(x, y);
      context.shadowColor = "rgba(121, 242, 178, 0.9)";
      context.shadowBlur = 6 + bandHeat * 14;
      context.lineWidth = 2 + bandHeat * 1.5;
      context.strokeStyle = "#8dffc4";
      context.stroke();
      context.shadowBlur = 0;
    }
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
