export interface EmbindEnumValue {
  readonly value: number;
}

export interface GGWaveParameters {
  payloadLength: number;
  sampleRateInp: number;
  sampleRateOut: number;
  sampleRate: number;
  samplesPerFrame: number;
  soundMarkerThreshold: number;
  sampleFormatInp: EmbindEnumValue;
  sampleFormatOut: EmbindEnumValue;
  operatingMode: number;
}

export interface GGWaveModule {
  readonly ProtocolId: Record<string, EmbindEnumValue>;
  readonly GGWAVE_OPERATING_MODE_RX: number;
  readonly GGWAVE_OPERATING_MODE_TX: number;
  getDefaultParameters(): GGWaveParameters;
  init(parameters: GGWaveParameters): number;
  free(instance: number): void;
  encode(instance: number, data: string, protocol: EmbindEnumValue, volume: number): Int8Array;
  decode(instance: number, waveform: Int8Array): Int8Array;
  disableLog(): void;
  rxToggleProtocol(protocol: EmbindEnumValue, state: number): void;
  txToggleProtocol(protocol: EmbindEnumValue, state: number): void;
  rxProtocolSetFreqStart(protocol: EmbindEnumValue, frequencyBin: number): void;
  txProtocolSetFreqStart(protocol: EmbindEnumValue, frequencyBin: number): void;
}

export interface GGWaveFactoryOptions {
  print?: (...args: unknown[]) => void;
  printErr?: (...args: unknown[]) => void;
}

declare function createGGWave(options?: GGWaveFactoryOptions): Promise<GGWaveModule>;

export default createGGWave;
