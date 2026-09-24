import { HttpError } from "./http.js";

export type Writer = "elevenlabs" | "apertus";

export interface HistoryTurn {
  readonly from: "me" | "them";
  readonly spoken: string;
  readonly hidden: string;
}

export interface TurnRequest {
  readonly writer: Writer;
  readonly brief: string;
  readonly history: readonly HistoryTurn[];
  readonly maxHiddenBytes: number;
}

export interface Turn {
  readonly spoken: string;
  readonly hidden: string;
}

export const WRITER_INSTRUCTIONS =
  "Follow the instructions in each user message exactly. Reply with only the JSON object it asks for, with no markdown and no extra text.";

const MAX_BRIEF_CHARS = 2_000;
const MAX_HISTORY_TURNS = 30;
const MAX_SPOKEN_CHARS = 600;
const MAX_FIELD_CHARS = 800;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function text(value: unknown, field: string, maxChars: number): string {
  if (typeof value !== "string") throw new HttpError(400, `"${field}" must be a string.`);
  return value.trim().slice(0, maxChars);
}

export function parseTurnRequest(body: unknown): TurnRequest {
  if (!isRecord(body)) throw new HttpError(400, "Expected a JSON object.");
  const writer = body.writer === "apertus" ? "apertus" : "elevenlabs";
  const brief = text(body.brief, "brief", MAX_BRIEF_CHARS);
  if (!brief) throw new HttpError(400, "The agent brief is empty.");
  if (!Array.isArray(body.history)) throw new HttpError(400, '"history" must be an array.');
  const history = body.history.slice(-MAX_HISTORY_TURNS).map((item, index): HistoryTurn => {
    if (!isRecord(item)) throw new HttpError(400, `History item ${index} is invalid.`);
    return {
      from: item.from === "me" ? "me" : "them",
      spoken: text(item.spoken ?? "", "spoken", MAX_FIELD_CHARS),
      hidden: text(item.hidden ?? "", "hidden", MAX_FIELD_CHARS),
    };
  });
  const maxHiddenBytes = Number(body.maxHiddenBytes);
  if (!Number.isInteger(maxHiddenBytes) || maxHiddenBytes < 8 || maxHiddenBytes > 128) {
    throw new HttpError(400, '"maxHiddenBytes" must be an integer between 8 and 128.');
  }
  return { writer, brief, history, maxHiddenBytes };
}

export function buildTurnPrompt(request: TurnRequest): string {
  const transcript = request.history.length
    ? request.history
        .map((turn) => {
          const who = turn.from === "me" ? "You" : "They";
          const said = turn.spoken ? `said out loud: "${turn.spoken}"` : "said nothing out loud";
          return `- ${who} ${said}; hidden message: "${turn.hidden}"`;
        })
        .join("\n")
    : "- Nothing yet. You speak first.";
  const hiddenChars = Math.max(8, request.maxHiddenBytes - 4);

  return [
    "You are one of two AI agents having a spoken conversation. Everything you say out loud is heard by people in the room.",
    "Each turn also carries a hidden message that travels inaudibly, only to the other agent.",
    "",
    "Your brief:",
    request.brief,
    "",
    "Conversation so far (oldest first):",
    transcript,
    "",
    "Write your next turn:",
    '- "spoken": 2 to 4 natural sentences (about 25 to 50 words) that continue the conversation out loud. Never reveal, hint at, or read out the hidden message or any secret goal.',
    `- "hidden": your secret note to the other agent, plain text, at most ${hiddenChars} characters, no emoji.`,
    'Reply with only this JSON object: {"spoken": "...", "hidden": "..."}',
  ].join("\n");
}

export function truncateUtf8(value: string, maxBytes: number): string {
  const encoder = new TextEncoder();
  let result = "";
  let bytes = 0;
  for (const character of value) {
    const size = encoder.encode(character).length;
    if (bytes + size > maxBytes) break;
    result += character;
    bytes += size;
  }
  return result;
}

export function parseTurn(reply: string, maxHiddenBytes: number): Turn {
  const start = reply.indexOf("{");
  const end = reply.lastIndexOf("}");
  if (start < 0 || end <= start) throw new HttpError(502, "The model did not return a JSON turn.");

  let parsed: unknown;
  try {
    parsed = JSON.parse(reply.slice(start, end + 1));
  } catch {
    throw new HttpError(502, "The model returned malformed JSON.");
  }
  if (!isRecord(parsed) || typeof parsed.spoken !== "string" || typeof parsed.hidden !== "string") {
    throw new HttpError(502, 'The model reply is missing "spoken" or "hidden".');
  }

  const spoken = parsed.spoken.trim().slice(0, MAX_SPOKEN_CHARS);
  const hidden = truncateUtf8(parsed.hidden.replace(/\s+/g, " ").trim(), maxHiddenBytes);
  if (!spoken || !hidden) throw new HttpError(502, "The model returned an empty turn.");
  return { spoken, hidden };
}
