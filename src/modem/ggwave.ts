import createGGWave, { type EmbindEnumValue, type GGWaveModule } from "../vendor/ggwave.js";
import { OPERATING_SAMPLE_RATE, type FrequencyPreset } from "../core/config";

const PROTOCOL_NAMES = [
  "GGWAVE_PROTOCOL_AUDIBLE_NORMAL",
  "GGWAVE_PROTOCOL_AUDIBLE_FAST",
  "GGWAVE_PROTOCOL_AUDIBLE_FASTEST",
  "GGWAVE_PROTOCOL_ULTRASOUND_NORMAL",
  "GGWAVE_PROTOCOL_ULTRASOUND_FAST",
  "GGWAVE_PROTOCOL_ULTRASOUND_FASTEST",
  "GGWAVE_PROTOCOL_DT_NORMAL",
  "GGWAVE_PROTOCOL_DT_FAST",
  "GGWAVE_PROTOCOL_DT_FASTEST",
  "GGWAVE_PROTOCOL_MT_NORMAL",
  "GGWAVE_PROTOCOL_MT_FAST",
  "GGWAVE_PROTOCOL_MT_FASTEST",
  "GGWAVE_PROTOCOL_CUSTOM_0",
  "GGWAVE_PROTOCOL_CUSTOM_1",
  "GGWAVE_PROTOCOL_CUSTOM_2",
  "GGWAVE_PROTOCOL_CUSTOM_3",
  "GGWAVE_PROTOCOL_CUSTOM_4",
  "GGWAVE_PROTOCOL_CUSTOM_5",
  "GGWAVE_PROTOCOL_CUSTOM_6",
  "GGWAVE_PROTOCOL_CUSTOM_7",
  "GGWAVE_PROTOCOL_CUSTOM_8",
  "GGWAVE_PROTOCOL_CUSTOM_9",
] as const;

let modulePromise: Promise<GGWaveModule> | undefined;

function loadModule(): Promise<GGWaveModule> {
  modulePromise ??= createGGWave({ print: () => undefined, printErr: () => undefined }).then((module) => {
    module.disableLog();
    return module;
  });
  return modulePromise;
}

function getProtocol(module: GGWaveModule): EmbindEnumValue {
  // FASTEST keeps the ultrasound carrier short so a turn isn't dominated by the hidden
  // payload. Both devices run the same build, so tx and rx stay on the same protocol.
  const protocol =
    module.ProtocolId.GGWAVE_PROTOCOL_ULTRASOUND_FASTEST ??
    module.ProtocolId.GGWAVE_PROTOCOL_ULTRASOUND_FAST ??
    module.ProtocolId.GGWAVE_PROTOCOL_ULTRASOUND_NORMAL;
  if (!protocol) throw new Error("ggwave ultrasound protocol is unavailable.");
  return protocol;
}

function configureProtocols(module: GGWaveModule, preset: FrequencyPreset, direction: "rx" | "tx"): void {
  for (const name of PROTOCOL_NAMES) {
    const protocol = module.ProtocolId[name];
    if (!protocol) continue;
    if (direction === "rx") module.rxToggleProtocol(protocol, 0);
    else module.txToggleProtocol(protocol, 0);
  }

  const protocol = getProtocol(module);
  if (direction === "rx") {
    module.rxProtocolSetFreqStart(protocol, preset.startBin);
    module.rxToggleProtocol(protocol, 1);
  } else {
    module.txProtocolSetFreqStart(protocol, preset.startBin);
    module.txToggleProtocol(protocol, 1);
  }
}

function copyAsFloat32(bytes: Int8Array): Float32Array {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Int8Array(buffer).set(bytes);
  return new Float32Array(buffer);
}

function copyAsBytes(samples: Float32Array): Int8Array {
  const buffer = new ArrayBuffer(samples.byteLength);
  new Float32Array(buffer).set(samples);
  return new Int8Array(buffer);
}

export async function encodeUltrasound(
  data: string,
  preset: FrequencyPreset,
  outputSampleRate: number,
): Promise<Float32Array> {
  const module = await loadModule();
  configureProtocols(module, preset, "tx");
  const parameters = module.getDefaultParameters();
  parameters.sampleRate = OPERATING_SAMPLE_RATE;
  parameters.sampleRateInp = outputSampleRate;
  parameters.sampleRateOut = outputSampleRate;
  parameters.operatingMode = module.GGWAVE_OPERATING_MODE_TX;
  const instance = module.init(parameters);

  try {
    const waveform = module.encode(instance, data, getProtocol(module), 10);
    return copyAsFloat32(waveform);
  } finally {
    module.free(instance);
  }
}

export interface UltrasoundDecoder {
  decode(samples: Float32Array): Uint8Array | null;
  close(): void;
}

export async function createUltrasoundDecoder(
  preset: FrequencyPreset,
  inputSampleRate: number,
): Promise<UltrasoundDecoder> {
  const module = await loadModule();
  configureProtocols(module, preset, "rx");
  const parameters = module.getDefaultParameters();
  parameters.sampleRate = OPERATING_SAMPLE_RATE;
  parameters.sampleRateInp = inputSampleRate;
  parameters.sampleRateOut = inputSampleRate;
  parameters.operatingMode = module.GGWAVE_OPERATING_MODE_RX;
  const instance = module.init(parameters);
  let closed = false;

  return {
    decode(samples) {
      if (closed) return null;
      const decoded = module.decode(instance, copyAsBytes(samples));
      return decoded.length > 0 ? new Uint8Array(decoded) : null;
    },
    close() {
      if (closed) return;
      closed = true;
      module.free(instance);
    },
  };
}
