import { transcribe } from "./_lib/elevenlabs";
import { HttpError, json, route } from "./_lib/http";

export const config = { maxDuration: 30 };

const MAX_AUDIO_BYTES = 4 * 1024 * 1024;

export const POST = route(async (request) => {
  const audio = await request.arrayBuffer();
  if (audio.byteLength < 1_000 || audio.byteLength > MAX_AUDIO_BYTES) {
    throw new HttpError(400, "Audio must be a WAV file under 4 MB.");
  }
  return json({ text: await transcribe(new Blob([audio], { type: "audio/wav" })) });
});
