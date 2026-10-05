import { writeWithApertus } from "./_lib/apertus.js";
import { writeWithAgent } from "./_lib/elevenlabs.js";
import { HttpError, json, readJson, route } from "./_lib/http.js";
import { buildTurnPrompt, buildTurnRepairPrompt, parseTurnForRequest, parseTurnRequest } from "./_lib/turn.js";

export const config = { maxDuration: 60 };

export const POST = route(async (request) => {
  const turnRequest = parseTurnRequest(await readJson(request));
  let prompt = buildTurnPrompt(turnRequest);
  const write =
    turnRequest.writer === "apertus" ? writeWithApertus : writeWithAgent;

  // Retry a rejected draft with its validation error. Repeating the original
  // prompt can reproduce the same oversized or wrong-channel answer.
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    let reply: string | undefined;
    try {
      reply = await write(prompt);
      return json(parseTurnForRequest(reply, turnRequest));
    } catch (error) {
      if (!(error instanceof HttpError) || error.status !== 502) throw error;
      lastError = error;
      if (reply !== undefined)
        prompt = buildTurnRepairPrompt(turnRequest, reply, error.message);
    }
  }
  throw lastError;
});
