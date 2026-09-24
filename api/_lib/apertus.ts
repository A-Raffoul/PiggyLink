import { HttpError, requireEnv } from "./http.js";
import { WRITER_INSTRUCTIONS } from "./turn.js";

export function apertusConfigured(): boolean {
  return Boolean(
    process.env.APERTUS_API_KEY?.trim() && process.env.APERTUS_BASE_URL?.trim() && process.env.APERTUS_MODEL?.trim(),
  );
}

// Any OpenAI-compatible chat completions provider that serves Apertus.
export async function writeWithApertus(prompt: string): Promise<string> {
  const baseUrl = requireEnv("APERTUS_BASE_URL").replace(/\/+$/, "");
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${requireEnv("APERTUS_API_KEY")}`,
      "content-type": "application/json",
      "user-agent": "SottoLink/0.1",
    },
    body: JSON.stringify({
      model: requireEnv("APERTUS_MODEL"),
      messages: [
        { role: "system", content: WRITER_INSTRUCTIONS },
        { role: "user", content: prompt },
      ],
      temperature: 0.8,
      max_tokens: 400,
    }),
    signal: AbortSignal.timeout(25_000),
  });
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 300);
    throw new HttpError(502, `Apertus returned ${response.status}: ${detail}`);
  }
  const body = (await response.json()) as { choices?: { message?: { content?: string } }[] };
  return body.choices?.[0]?.message?.content ?? "";
}
