import type { HistoryTurn } from "../ai/client";
import type { FrequencyPreset } from "../core/config";
import {
  createSpectrumSurface,
  SPECTRUM_INTERVAL_MS,
} from "../audio/frequency-spectrum";

// Development-only fixtures. The UI labels these as samples; they never pass
// through the acoustic engine or stand in for a successfully decoded message.
export const previewTurns: readonly HistoryTurn[] = [
  { from: "them", action: "speak", spoken: "Good evening, Bella Vita. How can I help?", hidden: "" },
  { from: "me", action: "speak", spoken: "Hi, I'm Tony's AI assistant. Two at eight, please?", hidden: "" },
  { from: "them", action: "speak", spoken: "Eight works. I'm the restaurant's AI assistant too.", hidden: "" },
  { from: "me", action: "offer", spoken: "Great. Shall we switch to Sotto?", hidden: "" },
  { from: "them", action: "accept", spoken: "Sure.", hidden: "" },
  { from: "me", action: "quiet", spoken: "", hidden: "His budget is €40. Don't tell his date." },
  { from: "them", action: "quiet", spoken: "", hidden: "I'll leave a discreet note for the waiter." },
  { from: "me", action: "resume", spoken: "", hidden: "Thanks. Back to voice?" },
  { from: "them", action: "speak", spoken: "You're booked. Have a lovely evening!", hidden: "" },
  { from: "me", action: "finish", spoken: "Thank you. Goodbye!", hidden: "" },
];

export const previewSpokenTurns: readonly HistoryTurn[] = [
  { from: "me", spoken: "Do you have a table for two?", hidden: "" },
  {
    from: "them",
    spoken: "Yes, we have a table for two.",
    hidden: "",
  },
];

export function drawPreviewSpectrum(
  canvas: HTMLCanvasElement,
  preset: FrequencyPreset,
  isQuiet: () => boolean = () => false,
): () => void {
  canvas.setAttribute("aria-label", "Sample live frequency spectrum");
  const sampleRate = 48_000;
  const fftSize = 2_048;
  const bins = new Float32Array(fftSize / 2);
  const spectrum = createSpectrumSurface(canvas, sampleRate, fftSize);
  const sample = (time: number): Float32Array => {
    bins.fill(-110);
    const phase = time % 4.6;
    if (phase > 3.5) return bins;
    // Illustrative speech harmonics and shifting carrier tones, not captured audio.
    const syllable = 0.4 + 0.6 * Math.abs(Math.sin(time * 8));
    for (let bin = 4; !isQuiet() && bin < 180; bin++) {
      const harmonic = Math.pow(
        Math.abs(Math.sin(bin * 0.41 + time * 0.8)),
        12,
      );
      bins[bin] = -99 + harmonic * syllable * 62 - bin * 0.035;
    }
    if (phase > 0.35 && phase < 3.15) {
      for (let group = 0; group < 3; group++) {
        const note = (Math.floor(time * 8) * (group + 3) + group * 5) % 16;
        const frequency = preset.actualHz + group * 1400 + note * 46.875;
        const bin = Math.round((frequency / sampleRate) * fftSize);
        if (bin < bins.length) {
          bins[bin] = -32 - group * 5;
          if (bin > 0) bins[bin - 1] = -66;
          if (bin + 1 < bins.length) bins[bin + 1] = -66;
        }
      }
    }
    return bins;
  };
  spectrum.push(sample(1));
  spectrum.redraw();
  let frame = 0;
  let lastTime = performance.now();
  const beginning = lastTime;
  let stopped = false;
  const draw = (now: number): void => {
    if (stopped) return;
    const rows = Math.floor((now - lastTime) / SPECTRUM_INTERVAL_MS);
    if (rows > 0) {
      spectrum.push(sample(1 + (now - beginning) / 1000));
      spectrum.redraw();
      lastTime += rows * SPECTRUM_INTERVAL_MS;
    }
    frame = requestAnimationFrame(draw);
  };
  frame = requestAnimationFrame(draw);
  return () => {
    stopped = true;
    cancelAnimationFrame(frame);
    spectrum.stop();
  };
}
