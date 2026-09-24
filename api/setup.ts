import { apertusConfigured } from "./_lib/apertus.js";
import { listVoices } from "./_lib/elevenlabs.js";
import { json, route } from "./_lib/http.js";
import type { Writer } from "./_lib/turn.js";

export const GET = route(async () => {
  const writers: Writer[] = apertusConfigured() ? ["elevenlabs", "apertus"] : ["elevenlabs"];
  return json({ voices: await listVoices(), writers });
});
