export interface MixResult {
  readonly channels: Float32Array[];
  readonly carrierScale: number;
  readonly outputScale: number;
  readonly peak: number;
}

export interface PlaybackWindow {
  readonly start: number;
  readonly end: number;
}

export function transmissionPlaybackWindow(
  coverLength: number,
  speechOnset: number,
  overlayStart: number,
  carrierLength: number,
  sampleRate: number,
): PlaybackWindow {
  const leadInSamples = Math.round(sampleRate * 0.1);
  const tailSamples = Math.round(sampleRate * 0.25);
  const start = Math.max(0, speechOnset - leadInSamples);
  const end = Math.min(coverLength, overlayStart + carrierLength + tailSamples);
  if (end <= start) throw new Error("The compact playback window is invalid.");
  return { start, end };
}

function peakOf(channels: readonly Float32Array[]): number {
  let peak = 0;
  for (const channel of channels) {
    for (const sample of channel) peak = Math.max(peak, Math.abs(sample));
  }
  return peak;
}

function rmsOfRange(channels: readonly Float32Array[], start: number, length: number): number {
  let sumOfSquares = 0;
  let sampleCount = 0;
  const end = start + length;

  for (const channel of channels) {
    for (let index = start; index < end; index += 1) {
      const sample = channel[index] ?? 0;
      sumOfSquares += sample * sample;
      sampleCount += 1;
    }
  }

  return sampleCount === 0 ? 0 : Math.sqrt(sumOfSquares / sampleCount);
}

export function findAudioOnset(
  channels: readonly Float32Array[],
  sampleRate: number,
  thresholdRatio = 0.08,
): number {
  const firstChannel = channels[0];
  if (!firstChannel) throw new Error("Cover audio has no channels.");
  const peak = peakOf(channels);
  if (peak === 0) throw new Error("Cover audio is silent.");

  const frameLength = Math.max(1, Math.round(sampleRate * 0.02));
  const threshold = Math.max(0.005, peak * thresholdRatio);
  for (let start = 0; start < firstChannel.length; start += frameLength) {
    const length = Math.min(frameLength, firstChannel.length - start);
    if (rmsOfRange(channels, start, length) >= threshold) return start;
  }

  return 0;
}

export function decibelsToGain(decibels: number): number {
  return 10 ** (decibels / 20);
}

export function mixCarrierIntoCover(
  coverChannels: readonly Float32Array[],
  carrier: Float32Array,
  delaySamples: number,
  relativeDecibels: number,
  sampleRate: number,
  headroom = 0.98,
): MixResult {
  const firstChannel = coverChannels[0];
  if (!firstChannel || coverChannels.length === 0) throw new Error("Cover audio has no channels.");
  if (delaySamples < 0 || !Number.isInteger(delaySamples)) throw new Error("Invalid overlay delay.");
  if (delaySamples + carrier.length > firstChannel.length) {
    throw new Error("Cover audio is too short for this transmission.");
  }
  if (coverChannels.some((channel) => channel.length !== firstChannel.length)) {
    throw new Error("Cover audio channels have different lengths.");
  }

  const coverRms = rmsOfRange(coverChannels, delaySamples, carrier.length);
  const carrierRms = rmsOfRange([carrier], 0, carrier.length);
  if (coverRms === 0) throw new Error("The cover audio is silent during the transmission window.");
  if (carrierRms === 0) throw new Error("Generated carrier is silent.");

  const analysisFrameSamples = Math.max(1, Math.round(sampleRate * 0.05));
  const analysisHopSamples = Math.max(1, Math.round(sampleRate * 0.01));
  const maximumQuietSamples = Math.max(1, Math.round(sampleRate * 0.25));
  const conservativeQuietLimit = Math.max(1, maximumQuietSamples - analysisHopSamples);
  const maskingThreshold = coverRms * 0.05;
  let quietCoverageStart = -1;
  for (let offset = 0; offset < carrier.length; offset += analysisHopSamples) {
    const frameLength = Math.min(analysisFrameSamples, carrier.length - offset);
    const frameRms = rmsOfRange(coverChannels, delaySamples + offset, frameLength);
    if (frameRms < maskingThreshold) {
      if (quietCoverageStart < 0) quietCoverageStart = offset;
    } else {
      quietCoverageStart = -1;
    }
    const quietCoverageEnd = offset + frameLength;
    if (quietCoverageStart >= 0 && quietCoverageEnd - quietCoverageStart >= conservativeQuietLimit) {
      throw new Error(
        "The cover audio has a sustained quiet gap during transmission. Use denser speech or a shorter message.",
      );
    }
  }

  const carrierScale = (coverRms * decibelsToGain(relativeDecibels)) / carrierRms;
  const channels = coverChannels.map((channel) => new Float32Array(channel));

  for (const channel of channels) {
    for (let index = 0; index < carrier.length; index += 1) {
      const targetIndex = delaySamples + index;
      channel[targetIndex] = (channel[targetIndex] ?? 0) + (carrier[index] ?? 0) * carrierScale;
    }
  }

  const mixedPeak = peakOf(channels);
  const outputScale = mixedPeak > headroom ? headroom / mixedPeak : 1;
  if (outputScale < 1) {
    for (const channel of channels) {
      for (let index = 0; index < channel.length; index += 1) {
        channel[index] = (channel[index] ?? 0) * outputScale;
      }
    }
  }

  return { channels, carrierScale, outputScale, peak: Math.min(mixedPeak, headroom) };
}
