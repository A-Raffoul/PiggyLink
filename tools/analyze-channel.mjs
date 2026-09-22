import fs from "node:fs";

function readWav(path) {
  const bytes = fs.readFileSync(path);
  if (bytes.toString("ascii", 0, 4) !== "RIFF" || bytes.toString("ascii", 8, 12) !== "WAVE") throw new Error(`${path} is not WAV`);
  const channels = bytes.readUInt16LE(22);
  const sampleRate = bytes.readUInt32LE(24);
  const bits = bytes.readUInt16LE(34);
  if (channels !== 1 || bits !== 16) throw new Error(`${path} must be 16-bit mono WAV`);
  const dataLength = bytes.readUInt32LE(40);
  const samples = new Float64Array(dataLength / 2);
  for (let index = 0; index < samples.length; index += 1) samples[index] = bytes.readInt16LE(44 + index * 2) / 32768;
  return { sampleRate, samples };
}

function rms(samples, start = 0, end = samples.length) {
  let total = 0;
  for (let index = start; index < end; index += 1) total += samples[index] ** 2;
  return Math.sqrt(total / Math.max(1, end - start));
}

function envelope(samples, hop) {
  const values = [];
  for (let start = 0; start + hop <= samples.length; start += hop) values.push(rms(samples, start, start + hop));
  return values;
}

function bestOffset(reference, recording, hop, sampleRate) {
  const ref = envelope(reference, hop);
  const received = envelope(recording, hop);
  let best = { offset: 0, correlation: -Infinity };
  for (let offset = 0; offset <= received.length - ref.length; offset += 1) {
    let dot = 0; let refPower = 0; let receivedPower = 0;
    for (let index = 0; index < ref.length; index += 1) {
      dot += ref[index] * received[offset + index];
      refPower += ref[index] ** 2;
      receivedPower += received[offset + index] ** 2;
    }
    const correlation = dot / Math.sqrt(refPower * receivedPower || 1);
    if (correlation > best.correlation) best = { offset, correlation };
  }
  return { seconds: (best.offset * hop) / sampleRate, correlation: best.correlation };
}

function goertzelPower(samples, start, length, sampleRate, frequency) {
  const coefficient = 2 * Math.cos((2 * Math.PI * frequency) / sampleRate);
  let previous = 0; let previousPrevious = 0;
  for (let index = start; index < start + length; index += 1) {
    const current = (samples[index] ?? 0) + coefficient * previous - previousPrevious;
    previousPrevious = previous;
    previous = current;
  }
  return previousPrevious ** 2 + previous ** 2 - coefficient * previous * previousPrevious;
}

const args = process.argv.slice(2);
const sweepMode = args[0] === "--sweep";
const [referencePath, recordingPath] = sweepMode ? args.slice(1) : args;
if (!referencePath || !recordingPath) throw new Error("Usage: node tools/analyze-channel.mjs reference.wav recording.wav");
const reference = readWav(referencePath);
const recording = readWav(recordingPath);
if (reference.sampleRate !== recording.sampleRate) throw new Error("Sample rates must match");
const hop = Math.round(reference.sampleRate / 100);
const aligned = bestOffset(reference.samples, recording.samples, hop, reference.sampleRate);
const offset = Math.round(aligned.seconds * reference.sampleRate);
const length = Math.min(reference.samples.length, recording.samples.length - offset);
const frequencies = Array.from({ length: 29 }, (_, index) => 15_000 + index * 250);
const sweepWindow = Math.round(reference.sampleRate * 0.2);
const sweepHop = Math.round(reference.sampleRate * 0.05);
const response = frequencies.map((frequency, index) => {
  if (!sweepMode) {
    const sent = goertzelPower(reference.samples, 0, length, reference.sampleRate, frequency);
    const received = goertzelPower(recording.samples, offset, length, recording.sampleRate, frequency);
    return { hz: frequency, relativeDb: Number((10 * Math.log10((received + 1e-20) / (sent + 1e-20))).toFixed(1)) };
  }
  const expectedStart = Math.round(index * reference.sampleRate * 0.4);
  const sent = goertzelPower(reference.samples, expectedStart, sweepWindow, reference.sampleRate, frequency);
  let best = { start: 0, power: 0 };
  for (let start = 0; start + sweepWindow <= recording.samples.length; start += sweepHop) {
    const power = goertzelPower(recording.samples, start, sweepWindow, recording.sampleRate, frequency);
    if (power > best.power) best = { start, power };
  }
  return {
    hz: frequency,
    detectedAtSeconds: Number((best.start / recording.sampleRate).toFixed(2)),
    relativeDb: Number((10 * Math.log10((best.power + 1e-20) / (sent + 1e-20))).toFixed(1)),
  };
});
console.log(JSON.stringify({
  referenceSeconds: Number((reference.samples.length / reference.sampleRate).toFixed(3)),
  recordingSeconds: Number((recording.samples.length / recording.sampleRate).toFixed(3)),
  alignmentSeconds: Number(aligned.seconds.toFixed(3)),
  envelopeCorrelation: Number(aligned.correlation.toFixed(3)),
  referenceRmsDbfs: Number((20 * Math.log10(rms(reference.samples) + 1e-12)).toFixed(1)),
  receivedRmsDbfs: Number((20 * Math.log10(rms(recording.samples, offset, offset + length) + 1e-12)).toFixed(1)),
  bandResponseRelativeDb: response,
}, null, 2));
