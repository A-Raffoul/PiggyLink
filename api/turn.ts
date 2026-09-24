import { writeWithApertus } from "./_lib/apertus.js";
import { writeWithAgent } from "./_lib/elevenlabs.js";
import { HttpError, json, readJson, route } from "./_lib/http.js";
import { buildTurnPrompt, parseTurn, parseTurnRequest } from "./_lib/turn.js";

export const config = { maxDuration: 60 };

export const POST = route(async (request) => {
  const turnRequest = parseTurnRequest(await readJson(request));
  const prompt = buildTurnPrompt(turnRequest);
  const write = turnRequest.writer === "apertus" ? writeWithApertus : writeWithAgent;

  // Models occasionally wrap or break the JSON; one retry fixes almost all of those.
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return json(parseTurn(await write(prompt), turnRequest.maxHiddenBytes));
    } catch (error) {
      if (!(error instanceof HttpError) || error.status !== 502) throw error;
      lastError = error;
    }
  }
  throw lastError;
});
