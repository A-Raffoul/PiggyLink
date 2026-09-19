import { MAX_MESSAGE_BYTES } from "./config";

const FRAME_PREFIX = "SL1";

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

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

export function encodePrivateFrame(message: string): string {
  const payload = new TextEncoder().encode(message);
  const checksum = crc16(payload).toString(16).padStart(4, "0");
  return `${FRAME_PREFIX}.${bytesToBase64(payload)}.${checksum}`;
}

export function decodePrivateFrame(frame: string): string | null {
  const parts = frame.split(".");
  if (parts.length !== 3 || parts[0] !== FRAME_PREFIX || !parts[1] || !parts[2]) return null;

  try {
    const payload = base64ToBytes(parts[1]);
    if (payload.byteLength > MAX_MESSAGE_BYTES) return null;
    const expectedChecksum = crc16(payload).toString(16).padStart(4, "0");
    if (expectedChecksum !== parts[2].toLowerCase()) return null;
    return new TextDecoder("utf-8", { fatal: true }).decode(payload);
  } catch {
    return null;
  }
}
