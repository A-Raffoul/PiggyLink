import { MAX_MESSAGE_BYTES } from "./config";

// Wire: "L2" + sender id (4 base36) + sequence (2 base36) + CRC-16 (4 hex) + raw UTF-8 text.
const FRAME_VERSION = "L2";
const ID_LENGTH = 4;
const SEQUENCE_LENGTH = 2;
const CRC_LENGTH = 4;
const HEADER_LENGTH = FRAME_VERSION.length + ID_LENGTH + SEQUENCE_LENGTH + CRC_LENGTH;
export const SEQUENCE_MODULO = 36 ** SEQUENCE_LENGTH;

const ID_PATTERN = /^[0-9a-z]{4}$/;
const SEQUENCE_PATTERN = /^[0-9a-z]{2}$/;
const CRC_PATTERN = /^[0-9a-f]{4}$/;

export interface ChatFrame {
  readonly senderId: string;
  readonly sequence: number;
  readonly text: string;
}

function crc16(bytes: Uint8Array): number {
  let crc = 0xffff;

  for (const byte of bytes) {
    crc ^= byte << 8;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc & 0x8000) !== 0 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }

  return crc;
}

function checksum(senderId: string, sequence: string, text: Uint8Array): string {
  const header = new TextEncoder().encode(senderId + sequence);
  const bytes = new Uint8Array(header.length + text.length);
  bytes.set(header);
  bytes.set(text, header.length);
  return crc16(bytes).toString(16).padStart(CRC_LENGTH, "0");
}

export function createDeviceId(): string {
  const random = crypto.getRandomValues(new Uint8Array(ID_LENGTH));
  return Array.from(random, (value) => (value % 36).toString(36)).join("");
}

export function encodeFrame(frame: ChatFrame): string {
  if (!ID_PATTERN.test(frame.senderId)) throw new Error("Invalid sender id.");
  if (!Number.isInteger(frame.sequence) || frame.sequence < 0 || frame.sequence >= SEQUENCE_MODULO) {
    throw new Error("Invalid sequence number.");
  }
  const text = new TextEncoder().encode(frame.text);
  if (text.length === 0 || text.length > MAX_MESSAGE_BYTES) {
    throw new Error(`Messages must be 1–${MAX_MESSAGE_BYTES} UTF-8 bytes.`);
  }

  const sequence = frame.sequence.toString(36).padStart(SEQUENCE_LENGTH, "0");
  return `${FRAME_VERSION}${frame.senderId}${sequence}${checksum(frame.senderId, sequence, text)}${frame.text}`;
}

export function decodeFrame(bytes: Uint8Array): ChatFrame | null {
  if (bytes.length <= HEADER_LENGTH || bytes.length > HEADER_LENGTH + MAX_MESSAGE_BYTES) return null;

  const header = String.fromCharCode(...bytes.subarray(0, HEADER_LENGTH));
  let offset = 0;
  const take = (length: number): string => header.slice(offset, (offset += length));
  const version = take(FRAME_VERSION.length);
  const senderId = take(ID_LENGTH);
  const sequence = take(SEQUENCE_LENGTH);
  const crc = take(CRC_LENGTH);
  if (
    version !== FRAME_VERSION ||
    !ID_PATTERN.test(senderId) ||
    !SEQUENCE_PATTERN.test(sequence) ||
    !CRC_PATTERN.test(crc)
  ) {
    return null;
  }

  const text = bytes.subarray(HEADER_LENGTH);
  if (checksum(senderId, sequence, text) !== crc) return null;

  try {
    return {
      senderId,
      sequence: Number.parseInt(sequence, 36),
      text: new TextDecoder("utf-8", { fatal: true }).decode(text),
    };
  } catch {
    return null;
  }
}
