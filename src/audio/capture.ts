import type { FrequencyPreset } from "../core/config";
import { createUltrasoundDecoder, type UltrasoundDecoder } from "../modem/ggwave";
import { renderSpectrum, type SpectrumRenderer } from "./spectrum";

export interface CaptureSettings {
  readonly sampleRate: number;
  readonly echoCancellation: boolean | undefined;
  readonly noiseSuppression: boolean | undefined;
  readonly autoGainControl: boolean | undefined;
}

export interface AcousticReceiver {
  stop(): Promise<void>;
}

function reportedBoolean(value: string | boolean | undefined): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

interface ReceiverOptions {
  readonly preset: FrequencyPreset;
  readonly canvas: HTMLCanvasElement;
  readonly onData: (data: Uint8Array) => void;
  readonly onFrame: (count: number) => void;
  readonly onSettings: (settings: CaptureSettings) => void;
}

export async function startAcousticReceiver(options: ReceiverOptions): Promise<AcousticReceiver> {
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

  let decoder: UltrasoundDecoder | undefined;
  let spectrum: SpectrumRenderer | undefined;

  try {
    decoder = await createUltrasoundDecoder(options.preset, audioContext.sampleRate);
    const activeDecoder = decoder;
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    const processor = audioContext.createScriptProcessor(1_024, 1, 1);
    const silentOutput = audioContext.createGain();
    silentOutput.gain.value = 0;
    let frames = 0;
    let closed = false;

    source.connect(analyser);
    analyser.connect(processor);
    processor.connect(silentOutput);
    silentOutput.connect(audioContext.destination);

    processor.onaudioprocess = (event): void => {
      if (closed) return;
      const samples = new Float32Array(event.inputBuffer.getChannelData(0));
      const decoded = activeDecoder.decode(samples);
      frames += 1;
      if (frames % 10 === 0) options.onFrame(frames);
      if (decoded) options.onData(decoded);
    };

    const trackSettings = stream.getAudioTracks()[0]?.getSettings();
    options.onSettings({
      sampleRate: audioContext.sampleRate,
      echoCancellation: reportedBoolean(trackSettings?.echoCancellation),
      noiseSuppression: reportedBoolean(trackSettings?.noiseSuppression),
      autoGainControl: reportedBoolean(trackSettings?.autoGainControl),
    });
    spectrum = renderSpectrum(options.canvas, analyser, options.preset);

    return {
      async stop() {
        if (closed) return;
        closed = true;
        processor.onaudioprocess = null;
        spectrum?.stop();
        spectrum = undefined;
        source.disconnect();
        analyser.disconnect();
        processor.disconnect();
        silentOutput.disconnect();
        for (const track of stream.getTracks()) track.stop();
        activeDecoder.close();
        decoder = undefined;
        await audioContext.close();
      },
    };
  } catch (error) {
    spectrum?.stop();
    decoder?.close();
    for (const track of stream.getTracks()) track.stop();
    await audioContext.close();
    throw error;
  }
}
