import { synthesize } from "./_lib/elevenlabs";
import { HttpError, readJson, route } from "./_lib/http";

export const config = { maxDuration: 30 };

const MAX_TEXT_CHARS = 600;

export const POST = route(async (request) => {
  const body = (await readJson(request)) as { text?: unknown; voiceId?: unknown };
  const text = typeof body.text === "string" ? body.text.trim() : "";
  const voiceId = typeof body.voiceId === "string" ? body.voiceId.trim() : "";
  if (!text || text.length > MAX_TEXT_CHARS) throw new HttpError(400, `Text must be 1–${MAX_TEXT_CHARS} characters.`);
  if (!/^[A-Za-z0-9]{8,40}$/.test(voiceId)) throw new HttpError(400, "Choose a voice in Settings.");

  const pcm = await synthesize(text, voiceId);
  return new Response(pcm, {
    headers: { "content-type": "application/octet-stream", "x-sample-rate": "48000", "cache-control": "no-store" },
  });
});
