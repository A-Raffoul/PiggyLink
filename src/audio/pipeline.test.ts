import { describe, expect, it } from "vitest";
import exampleCover from "../../public/example-cover.wav?inline";
import { MAX_MESSAGE_BYTES, OVERLAY_DELAY_SECONDS, FREQUENCY_PRESETS } from "../core/config";
import { Conversation } from "../core/conversation";
import { decodeFrame } from "../core/frame";
import { createUltrasoundDecoder, encodeUltrasound } from "../modem/ggwave";
import { extendCover, findAudioOnset, mixCarrierIntoCover } from "./mix";

const SAMPLE_RATE = 48_000;

function readPcm16Mono(dataUrl: string): Float32Array {
  const binary = atob(dataUrl.slice(dataUrl.indexOf(",") + 1));
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  const view = new DataView(bytes.buffer);
  let offset = 12;
  while (offset + 8 <= bytes.length) {
    const id = String.fromCharCode(...bytes.subarray(offset, offset + 4));
    const size = view.getUint32(offset + 4, true);
    if (id === "data") {
      const samples = new Float32Array(size / 2);
      for (let index = 0; index < samples.length; index += 1) {
        samples[index] = view.getInt16(offset + 8 + index * 2, true) / 32_768;
      }
      return samples;
    }
    offset += 8 + size + (size % 2);
  }
  throw new Error("No data chunk.");
}

async function decodeAll(samples: Float32Array): Promise<Uint8Array[]> {
  const decoder = await createUltrasoundDecoder(FREQUENCY_PRESETS[0]!, SAMPLE_RATE);
  const results: Uint8Array[] = [];
  for (let index = 0; index + 1_024 <= samples.length; index += 1_024) {
    const decoded = decoder.decode(samples.slice(index, index + 1_024));
    if (decoded) results.push(decoded);
  }
  decoder.close();
  return results;
}

describe("sender to receiver pipeline", () => {
  it("delivers a maximum-length message mixed into the looped example speech", async () => {
    const cover = readPcm16Mono(exampleCover);
    const alice = new Conversation("a1ce");
    const bob = new Conversation("b0b0");
    const text = "é".repeat(MAX_MESSAGE_BYTES / 2);
    const outgoing = alice.send(text);

    const carrier = await encodeUltrasound(outgoing.wire, FREQUENCY_PRESETS[0]!, SAMPLE_RATE);
    const delay = findAudioOnset([cover], SAMPLE_RATE) + Math.round(OVERLAY_DELAY_SECONDS * SAMPLE_RATE);
    const extended = extendCover([cover], delay + carrier.length, SAMPLE_RATE);
    const mixed = mixCarrierIntoCover(extended, carrier, delay, -30, SAMPLE_RATE);

    const received = (await decodeAll(mixed.channels[0]!)).map(decodeFrame);
    expect(received).toHaveLength(1);
    expect(bob.receive(received[0]!)).toMatchObject({ kind: "message", frame: { text } });
  });
});
