import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getFrequencyPreset } from "../core/config";
import { startAcousticEngine } from "./engine";

vi.mock("../modem/ggwave", () => ({
  createUltrasoundDecoder: async () => ({ decode: () => undefined, close: () => {} }),
}));
vi.mock("./spectrum", () => ({ renderSpectrum: () => ({ stop: () => {} }) }));

// Replace browser audio I/O while exercising the real speech detector and
// engine's listen-before-talk loop. No microphone audio is transcribed here.
function audioHarness() {
  let speechLevel = -85;
  const node = { connect() {}, disconnect() {} };
  const processor: typeof node & {
    onaudioprocess?: ((event: { inputBuffer: { getChannelData: () => Float32Array } }) => void) | null;
  } = { ...node };
  class AudioContext {
    readonly sampleRate = 48_000;
    readonly destination = {};
    async resume() {}
    async close() {}
    createMediaStreamSource() { return node; }
    createAnalyser() {
      return {
        ...node,
        fftSize: 1_024,
        frequencyBinCount: 512,
        smoothingTimeConstant: 0,
        getFloatFrequencyData(bins: Float32Array) {
          bins.fill(-100);
          // 150–4,000 Hz; leave the ultrasound channel clear throughout.
          bins.fill(speechLevel, 3, 87);
        },
      };
    }
    createScriptProcessor() { return processor; }
    createGain() { return { ...node, gain: { value: 0 } }; }
  }
  vi.stubGlobal("AudioContext", AudioContext);
  vi.stubGlobal("navigator", { mediaDevices: {
    getUserMedia: async () => ({ getTracks: () => [{ stop() {} }] }),
  } });
  return async (level: number, milliseconds: number): Promise<void> => {
    speechLevel = level;
    for (let elapsed = 0; elapsed < milliseconds; elapsed += 20) {
      await vi.advanceTimersByTimeAsync(20);
      processor.onaudioprocess?.({ inputBuffer: { getChannelData: () => new Float32Array(1_024) } });
    }
  };
}

describe("speech-aware channel wait", () => {
  beforeEach(() => vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "performance"] }));
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("delivers an ordinary English utterance for recognition with no modem packet", async () => {
    const feed = audioHarness();
    const onSpeech = vi.fn();
    const onData = vi.fn();
    const engine = await startAcousticEngine({
      preset: getFrequencyPreset("18000"), canvas: {} as HTMLCanvasElement,
      onData, onBusyChange: vi.fn(), onSpeech, canListenForSpeech: () => true,
    });
    try {
      await feed(-85, 600);
      await feed(-35, 1_200);
      expect(onSpeech).not.toHaveBeenCalled();
      await feed(-85, 1_100);
      expect(onSpeech).toHaveBeenCalledOnce();
      expect(onSpeech.mock.calls[0]![0].length).toBeGreaterThan(48_000);
      expect(onData).not.toHaveBeenCalled();
    } finally { await engine.stop(); }
  });

  it("hands a quieter restaurant greeting to recognition instead of leaving the caller listening", async () => {
    const feed = audioHarness();
    const onSpeech = vi.fn();
    const engine = await startAcousticEngine({
      preset: getFrequencyPreset("18000"), canvas: {} as HTMLCanvasElement,
      onData: vi.fn(), onBusyChange: vi.fn(), onSpeech, canListenForSpeech: () => true,
    });
    try {
      await feed(-100, 1_000);
      // A nearby speaker can be quiet at the microphone while still standing
      // 28 dB above the measured room floor. No encoded opening is present.
      await feed(-72, 1_200);
      await feed(-100, 1_100);
      expect(onSpeech, "The personal assistant must begin transcribing the greeting").toHaveBeenCalledOnce();
    } finally { await engine.stop(); }
  });

  it("waits through a spoken reply before its carrier without enabling transcription", async () => {
    const feed = audioHarness();
    const onSpeech = vi.fn();
    const onBusyChange = vi.fn();
    const engine = await startAcousticEngine({
      preset: getFrequencyPreset("18000"), canvas: {} as HTMLCanvasElement,
      onData: vi.fn(), onBusyChange, onSpeech, canListenForSpeech: () => false,
    });
    try {
      await feed(-85, 600);
      await feed(-35, 700);
      expect(onBusyChange).toHaveBeenLastCalledWith(true);
      let clear = false;
      const waiting = engine.waitForClearChannel(() => false).then(() => { clear = true; });
      await feed(-35, 1_000);
      expect(clear).toBe(false);
      await feed(-85, 1_400);
      await waiting;
      expect(clear).toBe(true);
      expect(onBusyChange).toHaveBeenLastCalledWith(false);
      expect(onSpeech).not.toHaveBeenCalled();
    } finally { await engine.stop(); }
  });

  it("releases a cancelled greeting retry even while voice activity continues", async () => {
    const feed = audioHarness();
    const engine = await startAcousticEngine({
      preset: getFrequencyPreset("18000"), canvas: {} as HTMLCanvasElement,
      onData: vi.fn(), onBusyChange: vi.fn(), canListenForSpeech: () => false,
    });
    try {
      await feed(-85, 600);
      await feed(-35, 700);
      let cancelled = false;
      let released = false;
      const waiting = engine.waitForClearChannel(() => cancelled).then(() => { released = true; });
      await feed(-35, 200);
      expect(released).toBe(false);
      cancelled = true;
      await feed(-35, 120);
      await waiting;
      expect(released).toBe(true);
    } finally { await engine.stop(); }
  });
});
