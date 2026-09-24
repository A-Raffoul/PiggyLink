import { MAX_MESSAGE_BYTES } from "./config";

// Wire: "L3" + sender id (4) + sequence (2) + speech lead (2) + CRC-16 (4 hex) + raw UTF-8 text; fields are base36.
const FRAME_VERSION = "L3";
const ID_LENGTH = 4;
const SEQUENCE_LENGTH = 2;
const LEAD_LENGTH = 2;
const CRC_LENGTH = 4;
const HEADER_LENGTH = FRAME_VERSION.length + ID_LENGTH + SEQUENCE_LENGTH + LEAD_LENGTH + CRC_LENGTH;
export const SEQUENCE_MODULO = 36 ** SEQUENCE_LENGTH;
export const MAX_SPEECH_LEAD = 36 ** LEAD_LENGTH - 1;

const ID_PATTERN = /^[0-9a-z]{4}$/;
const BASE36_PAIR = /^[0-9a-z]{2}$/;
const CRC_PATTERN = /^[0-9a-f]{4}$/;

export interface ChatFrame {
  readonly senderId: string;
  readonly sequence: number;
  // Tenths of a second of speech before the hidden message ends; 0 when there is nothing to transcribe.
  readonly speechLead: number;
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

function checksum(fields: string, text: Uint8Array): string {
  const header = new TextEncoder().encode(fields);
  const bytes = new Uint8Array(header.length + text.length);
  bytes.set(header);
  bytes.set(text, header.length);
  return crc16(bytes).toString(16).padStart(CRC_LENGTH, "0");
}

const base36 = (value: number, length: number): string => value.toString(36).padStart(length, "0");

function validInteger(value: number, max: number): boolean {
  return Number.isInteger(value) && value >= 0 && value <= max;
}

export function createDeviceId(): string {
  const random = crypto.getRandomValues(new Uint8Array(ID_LENGTH));
  return Array.from(random, (value) => (value % 36).toString(36)).join("");
}

export function encodeFrame(frame: ChatFrame): string {
  if (!ID_PATTERN.test(frame.senderId)) throw new Error("Invalid sender id.");
  if (!validInteger(frame.sequence, SEQUENCE_MODULO - 1)) throw new Error("Invalid sequence number.");
  if (!validInteger(frame.speechLead, MAX_SPEECH_LEAD)) throw new Error("Invalid speech lead.");
  const text = new TextEncoder().encode(frame.text);
  if (text.length === 0 || text.length > MAX_MESSAGE_BYTES) {
    throw new Error(`Messages must be 1–${MAX_MESSAGE_BYTES} UTF-8 bytes.`);
  }

  const fields = `${frame.senderId}${base36(frame.sequence, SEQUENCE_LENGTH)}${base36(frame.speechLead, LEAD_LENGTH)}`;
  return `${FRAME_VERSION}${fields}${checksum(fields, text)}${frame.text}`;
}

export function decodeFrame(bytes: Uint8Array): ChatFrame | null {
  if (bytes.length <= HEADER_LENGTH || bytes.length > HEADER_LENGTH + MAX_MESSAGE_BYTES) return null;

  const header = String.fromCharCode(...bytes.subarray(0, HEADER_LENGTH));
  let offset = 0;
  const take = (length: number): string => header.slice(offset, (offset += length));
  const version = take(FRAME_VERSION.length);
  const senderId = take(ID_LENGTH);
  const sequence = take(SEQUENCE_LENGTH);
  const speechLead = take(LEAD_LENGTH);
  const crc = take(CRC_LENGTH);
  if (
    version !== FRAME_VERSION ||
    !ID_PATTERN.test(senderId) ||
    !BASE36_PAIR.test(sequence) ||
    !BASE36_PAIR.test(speechLead) ||
    !CRC_PATTERN.test(crc)
  ) {
    return null;
  }

  const text = bytes.subarray(HEADER_LENGTH);
  if (checksum(`${senderId}${sequence}${speechLead}`, text) !== crc) return null;

  try {
    return {
      senderId,
      sequence: Number.parseInt(sequence, 36),
      speechLead: Number.parseInt(speechLead, 36),
      text: new TextDecoder("utf-8", { fatal: true }).decode(text),
    };
  } catch {
    return null;
  }
}
