function asciiAt(bytes: Uint8Array, offset: number, value: string): boolean {
  return [...value].every((character, index) => bytes[offset + index] === character.charCodeAt(0));
}

export function isWavFile(bytes: ArrayBuffer): boolean {
  if (bytes.byteLength < 12) return false;
  const view = new Uint8Array(bytes, 0, 12);
  return asciiAt(view, 0, "RIFF") && asciiAt(view, 8, "WAVE");
}
