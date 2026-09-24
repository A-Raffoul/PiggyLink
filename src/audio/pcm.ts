export function int16ToFloat32(bytes: ArrayBuffer): Float32Array {
  const view = new DataView(bytes);
  const samples = new Float32Array(Math.floor(bytes.byteLength / 2));
  for (let index = 0; index < samples.length; index += 1) samples[index] = view.getInt16(index * 2, true) / 32_768;
  return samples;
}

// Averaging each group acts as a simple low-pass before decimation; plenty for speech recognition.
export function downsample(samples: Float32Array, factor: number): Float32Array {
  if (!Number.isInteger(factor) || factor < 1) throw new Error("Downsample factor must be a positive integer.");
  const output = new Float32Array(Math.floor(samples.length / factor));
  for (let index = 0; index < output.length; index += 1) {
    let sum = 0;
    for (let offset = 0; offset < factor; offset += 1) sum += samples[index * factor + offset] ?? 0;
    output[index] = sum / factor;
  }
  return output;
}

export function encodeWav(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const writeAscii = (offset: number, value: string): void => {
    for (let index = 0; index < value.length; index += 1) view.setUint8(offset + index, value.charCodeAt(index));
  };
  writeAscii(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeAscii(8, "WAVE");
  writeAscii(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeAscii(36, "data");
  view.setUint32(40, samples.length * 2, true);
  samples.forEach((sample, index) => {
    const clamped = Math.max(-1, Math.min(1, sample));
    view.setInt16(44 + index * 2, Math.round(clamped * 32_767), true);
  });
  return buffer;
}

export class AudioRing {
  private readonly buffer: Float32Array;
  private written = 0;

  constructor(capacity: number) {
    this.buffer = new Float32Array(capacity);
  }

  push(samples: Float32Array): void {
    for (const sample of samples) {
      this.buffer[this.written % this.buffer.length] = sample;
      this.written += 1;
    }
  }

  latest(count: number): Float32Array {
    const available = Math.min(count, this.written, this.buffer.length);
    const output = new Float32Array(available);
    const start = this.written - available;
    for (let index = 0; index < available; index += 1) {
      output[index] = this.buffer[(start + index) % this.buffer.length] ?? 0;
    }
    return output;
  }
}
