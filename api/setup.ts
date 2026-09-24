import { apertusConfigured } from "./_lib/apertus";
import { listVoices } from "./_lib/elevenlabs";
import { json, route } from "./_lib/http";
import type { Writer } from "./_lib/turn";

export const GET = route(async () => {
  const writers: Writer[] = apertusConfigured() ? ["elevenlabs", "apertus"] : ["elevenlabs"];
  return json({ voices: await listVoices(), writers });
});
