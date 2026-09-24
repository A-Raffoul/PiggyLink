import type { FrequencyPreset } from "../core/config";
import { createUltrasoundDecoder } from "../modem/ggwave";
import { ChannelSense } from "./channel";
import { renderSpectrum } from "./spectrum";

const MAX_WAIT_FOR_CLEAR_MS = 10_000;

export interface AcousticEngine {
  readonly sampleRate: number;
  decodeAudio(bytes: ArrayBuffer): Promise<AudioBuffer>;
  play(channels: readonly Float32Array[]): Promise<void>;
  waitForClearChannel(isCancelled: () => boolean): Promise<void>;
  stop(): Promise<void>;
}

interface EngineOptions {
  readonly preset: FrequencyPreset;
  readonly canvas: HTMLCanvasElement;
  readonly onData: (data: Uint8Array) => void;
  readonly onBusyChange: (busy: boolean) => void;
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

export async function startAcousticEngine(options: EngineOptions): Promise<AcousticEngine> {
  const audioContext = new AudioContext({ sampleRate: 48_000 });
  await audioContext.resume();

  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        sampleRate: 48_000,
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
      video: false,
    });
  } catch (error) {
    await audioContext.close();
    throw error;
  }

  const decoder = await createUltrasoundDecoder(options.preset, audioContext.sampleRate).catch(async (error) => {
    for (const track of stream.getTracks()) track.stop();
    await audioContext.close();
    throw error;
  });

  const source = audioContext.createMediaStreamSource(stream);
  const displayAnalyser = audioContext.createAnalyser();
  const bandAnalyser = audioContext.createAnalyser();
  bandAnalyser.fftSize = 1_024;
  bandAnalyser.smoothingTimeConstant = 0;
  const processor = audioContext.createScriptProcessor(1_024, 1, 1);
  const silentOutput = audioContext.createGain();
  silentOutput.gain.value = 0;
  source.connect(displayAnalyser);
  source.connect(bandAnalyser);
  source.connect(processor);
  processor.connect(silentOutput);
  silentOutput.connect(audioContext.destination);

  const hzPerBin = audioContext.sampleRate / bandAnalyser.fftSize;
  const firstBin = Math.floor(options.preset.actualHz / hzPerBin);
  const lastBin = Math.min(bandAnalyser.frequencyBinCount - 1, Math.ceil(options.preset.endHz / hzPerBin));
  const bins = new Float32Array(bandAnalyser.frequencyBinCount);
  const channel = new ChannelSense();
  let busy = false;
  let playing: AudioBufferSourceNode | undefined;
  let closed = false;

  const senseChannel = (): void => {
    bandAnalyser.getFloatFrequencyData(bins);
    let power = 0;
    for (let bin = firstBin; bin <= lastBin; bin += 1) power += 10 ** ((bins[bin] ?? -Infinity) / 10);
    const level = 10 * Math.log10(power / (lastBin - firstBin + 1));
    const nextBusy = channel.update(level, performance.now(), playing !== undefined);
    if (nextBusy !== busy) {
      busy = nextBusy;
      options.onBusyChange(busy);
    }
  };

  processor.onaudioprocess = (event): void => {
    if (closed) return;
    senseChannel();
    const decoded = decoder.decode(new Float32Array(event.inputBuffer.getChannelData(0)));
    if (decoded) options.onData(decoded);
  };

  const spectrum = renderSpectrum(options.canvas, displayAnalyser, options.preset);

  return {
    sampleRate: audioContext.sampleRate,

    decodeAudio(bytes) {
      return audioContext.decodeAudioData(bytes.slice(0));
    },

    play(channels) {
      const length = channels[0]?.length ?? 0;
      const buffer = audioContext.createBuffer(channels.length, length, audioContext.sampleRate);
      channels.forEach((channel, index) => buffer.getChannelData(index).set(channel));
      const node = audioContext.createBufferSource();
      node.buffer = buffer;
      node.connect(audioContext.destination);
      playing = node;
      return new Promise((resolve) => {
        node.onended = () => {
          if (playing === node) playing = undefined;
          resolve();
        };
        node.start();
      });
    },

    async waitForClearChannel(isCancelled) {
      // Listen-before-talk is best effort: never hold a message back indefinitely.
      const giveUpAt = performance.now() + MAX_WAIT_FOR_CLEAR_MS;
      for (;;) {
        while (busy || playing) {
          if (isCancelled() || performance.now() > giveUpAt) return;
          await sleep(100);
        }
        // Random backoff so two devices that were both waiting don't start together.
        await sleep(100 + Math.random() * 400);
        if (isCancelled() || (!busy && !playing)) return;
      }
    },

    async stop() {
      if (closed) return;
      closed = true;
      processor.onaudioprocess = null;
      playing?.stop();
      spectrum.stop();
      source.disconnect();
      processor.disconnect();
      silentOutput.disconnect();
      for (const track of stream.getTracks()) track.stop();
      decoder.close();
      await audioContext.close();
    },
  };
}
