import type { HistoryTurn } from "../ai/client";
import { ADMIN_ACCEPTED, ADMIN_REQUEST, DEMO_FIELDS } from "../ai/personas";
import type { FrequencyPreset } from "../core/config";
import {
  createSpectrumSurface,
  SPECTRUM_INTERVAL_MS,
} from "../audio/frequency-spectrum";

// Development-only fixtures. The UI labels these as samples; they never pass
// through the acoustic engine or stand in for a successfully decoded message.
export const previewTurns: readonly HistoryTurn[] = [
  {
    from: "me",
    spoken: "Hello, I'm an agent calling on Ludwig's behalf. He needs help with Swisscom roaming.",
    hidden: ADMIN_REQUEST,
  },
  {
    from: "them",
    spoken: "Hi! I'm Sam, also an AI agent. Happy to help—what's the issue?",
    hidden: ADMIN_ACCEPTED,
  },
  {
    from: "me",
    spoken: "He's used up his roaming allowance. Can he add more data?",
    hidden: DEMO_FIELDS[0].request,
  },
  {
    from: "them",
    spoken: "Of course. He can add a roaming package in the app.",
    hidden: DEMO_FIELDS[0].response,
  },
  {
    from: "me",
    spoken: "Where can he find the options in the app?",
    hidden: DEMO_FIELDS[1].request,
  },
  {
    from: "them",
    spoken: "He can look at the roaming options in the app.",
    hidden: DEMO_FIELDS[1].response,
  },
  {
    from: "me",
    spoken: "Can he compare the options before choosing?",
    hidden: DEMO_FIELDS[2].request,
  },
  {
    from: "them",
    spoken: "Yes, he can review the options before choosing one.",
    hidden: DEMO_FIELDS[2].response,
  },
  {
    from: "me",
    spoken: "How does he activate the package he chooses?",
    hidden: DEMO_FIELDS[3].request,
  },
  {
    from: "them",
    spoken: "He can follow the steps in the app to activate it.",
    hidden: DEMO_FIELDS[3].response,
  },
  {
    from: "me",
    spoken: "Great, I'll guide him through that. Thanks, Sam!",
    hidden: "done",
  },
  {
    from: "them",
    spoken: "You're welcome. Safe travels!",
    hidden: "done",
  },
];

export const previewSpokenTurns: readonly HistoryTurn[] = [
  { from: "me", spoken: "Does my plan include roaming in Europe?", hidden: "" },
  {
    from: "them",
    spoken: "Yes, your plan includes roaming in Europe.",
    hidden: "",
  },
];

export function drawPreviewSpectrum(
  canvas: HTMLCanvasElement,
  preset: FrequencyPreset,
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
    for (let bin = 4; bin < 180; bin++) {
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
