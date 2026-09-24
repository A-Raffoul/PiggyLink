import { int16ToFloat32 } from "../audio/pcm";

export type Writer = "elevenlabs" | "apertus";

export interface VoiceOption {
  readonly id: string;
  readonly name: string;
}

export interface SetupInfo {
  readonly voices: VoiceOption[];
  readonly writers: Writer[];
}

export interface HistoryTurn {
  readonly from: "me" | "them";
  readonly spoken: string;
  readonly hidden: string;
}

export interface AgentTurn {
  readonly spoken: string;
  readonly hidden: string;
}

async function call(path: string, accessCode: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set("x-access-code", accessCode);
  const response = await fetch(path, { ...init, headers });
  if (!response.ok) {
    let message = `Request failed (${response.status}).`;
    try {
      const body = (await response.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      // Keep the generic message when the body isn't JSON (e.g. the route doesn't exist locally).
    }
    throw new Error(message);
  }
  return response;
}

const postJson = (path: string, accessCode: string, body: unknown): Promise<Response> =>
  call(path, accessCode, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

export async function fetchSetup(accessCode: string): Promise<SetupInfo> {
  return (await (await call("/api/setup", accessCode)).json()) as SetupInfo;
}

export async function writeAgentTurn(
  accessCode: string,
  request: { writer: Writer; brief: string; history: HistoryTurn[]; maxHiddenBytes: number },
): Promise<AgentTurn> {
  return (await (await postJson("/api/turn", accessCode, request)).json()) as AgentTurn;
}

// Returns mono samples at 48 kHz.
export async function speak(accessCode: string, text: string, voiceId: string): Promise<Float32Array> {
  const response = await postJson("/api/speak", accessCode, { text, voiceId });
  return int16ToFloat32(await response.arrayBuffer());
}

export async function transcribe(accessCode: string, wav: ArrayBuffer): Promise<string> {
  const response = await call("/api/transcribe", accessCode, {
    method: "POST",
    headers: { "content-type": "audio/wav" },
    body: wav,
  });
  return ((await response.json()) as { text: string }).text;
}
