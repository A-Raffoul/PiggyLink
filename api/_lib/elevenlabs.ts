import { HttpError, requireEnv } from "./http";
import { WRITER_INSTRUCTIONS } from "./turn";

const BASE_URL = "https://api.elevenlabs.io";
const AGENT_NAME = "SottoLink turn writer";
const AGENT_TIMEOUT_MS = 25_000;

async function elevenFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set("xi-api-key", requireEnv("ELEVENLABS_API_KEY"));
  const response = await fetch(`${BASE_URL}${path}`, { ...init, headers });
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 300);
    throw new HttpError(502, `ElevenLabs returned ${response.status}: ${detail}`);
  }
  return response;
}

export interface VoiceOption {
  readonly id: string;
  readonly name: string;
}

export async function listVoices(): Promise<VoiceOption[]> {
  const response = await elevenFetch("/v2/voices?page_size=100&sort=name&sort_direction=asc");
  const body = (await response.json()) as { voices?: { voice_id: string; name: string }[] };
  return (body.voices ?? []).map((voice) => ({ id: voice.voice_id, name: voice.name }));
}

// Returns raw 16-bit little-endian mono PCM at 48 kHz, the app's operating rate.
export async function synthesize(text: string, voiceId: string): Promise<ArrayBuffer> {
  const model = process.env.ELEVENLABS_TTS_MODEL?.trim() || "eleven_multilingual_v2";
  const response = await elevenFetch(
    `/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=pcm_48000`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text, model_id: model }),
    },
  );
  return response.arrayBuffer();
}

export async function transcribe(audio: Blob): Promise<string> {
  const form = new FormData();
  form.append("model_id", process.env.ELEVENLABS_STT_MODEL?.trim() || "scribe_v2");
  form.append("file", audio, "turn.wav");
  const response = await elevenFetch("/v1/speech-to-text", { method: "POST", body: form });
  const body = (await response.json()) as { text?: string };
  return (body.text ?? "").trim();
}

let agentIdPromise: Promise<string> | undefined;

async function findOrCreateAgent(): Promise<string> {
  const configured = process.env.ELEVENLABS_AGENT_ID?.trim();
  if (configured) return configured;

  const search = await elevenFetch(`/v1/convai/agents?page_size=30&search=${encodeURIComponent(AGENT_NAME)}`);
  const found = ((await search.json()) as { agents?: { agent_id: string; name: string }[] }).agents?.find(
    (agent) => agent.name === AGENT_NAME,
  );
  if (found) return found.agent_id;

  const created = await elevenFetch("/v1/convai/agents/create", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      name: AGENT_NAME,
      conversation_config: {
        agent: {
          prompt: { prompt: WRITER_INSTRUCTIONS, llm: process.env.ELEVENLABS_AGENT_LLM?.trim() || "gemini-2.5-flash" },
          first_message: "",
          language: "en",
        },
        conversation: { text_only: true },
      },
    }),
  });
  return ((await created.json()) as { agent_id: string }).agent_id;
}

function agentId(): Promise<string> {
  agentIdPromise ??= findOrCreateAgent().catch((error: unknown) => {
    agentIdPromise = undefined;
    throw error;
  });
  return agentIdPromise;
}

interface AgentEvent {
  type?: string;
  agent_response_event?: { agent_response?: string };
  ping_event?: { event_id?: number };
}

// One text-only conversation per turn: the full history travels inside the prompt.
export async function writeWithAgent(prompt: string): Promise<string> {
  const id = await agentId();
  const signed = await elevenFetch(`/v1/convai/conversation/get-signed-url?agent_id=${encodeURIComponent(id)}`);
  const { signed_url: signedUrl } = (await signed.json()) as { signed_url: string };

  return new Promise((resolve, reject) => {
    const socket = new WebSocket(signedUrl);
    let settled = false;
    const settle = (action: () => void): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      socket.close();
      action();
    };
    const timer = setTimeout(
      () => settle(() => reject(new HttpError(504, "The ElevenLabs agent took too long to answer."))),
      AGENT_TIMEOUT_MS,
    );

    socket.addEventListener("open", () => {
      socket.send(JSON.stringify({ type: "conversation_initiation_client_data" }));
      socket.send(JSON.stringify({ type: "user_message", text: prompt }));
    });
    socket.addEventListener("message", (event) => {
      let message: AgentEvent;
      try {
        message = JSON.parse(String(event.data)) as AgentEvent;
      } catch {
        return;
      }
      if (message.type === "ping") {
        socket.send(JSON.stringify({ type: "pong", event_id: message.ping_event?.event_id }));
      } else if (message.type === "agent_response") {
        const reply = message.agent_response_event?.agent_response ?? "";
        settle(() => resolve(reply));
      }
    });
    socket.addEventListener("error", () =>
      settle(() => reject(new HttpError(502, "Could not reach the ElevenLabs agent."))),
    );
    socket.addEventListener("close", () =>
      settle(() => reject(new HttpError(502, "The ElevenLabs agent closed the conversation without answering."))),
    );
  });
}
