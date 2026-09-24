declare const process: {
  env: Record<string, string | undefined>;
};

interface SpeechRequest {
  voiceId?: unknown;
  text?: unknown;
  previousText?: unknown;
  nextText?: unknown;
}

const DEFAULT_VOICE_IDS = [
  "21m00Tcm4TlvDq8ikWAM",
  "29vD33N1CtxCmqQRPOHJ",
];

function jsonError(message: string, status: number): Response {
  return Response.json({ error: message }, { status });
}

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method !== "POST") {
      return jsonError("Method not allowed.", 405);
    }

    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      return jsonError("ElevenLabs is not configured yet. Add ELEVENLABS_API_KEY in Vercel.", 503);
    }

    let body: SpeechRequest;
    try {
      body = await request.json() as SpeechRequest;
    } catch {
      return jsonError("The request body must be valid JSON.", 400);
    }

    const voiceId = typeof body.voiceId === "string" ? body.voiceId.trim() : "";
    const text = typeof body.text === "string" ? body.text.trim() : "";
    const previousText = typeof body.previousText === "string" ? body.previousText.trim() : undefined;
    const nextText = typeof body.nextText === "string" ? body.nextText.trim() : undefined;
    const allowedVoices = new Set([
      ...DEFAULT_VOICE_IDS,
      process.env.ELEVENLABS_VOICE_A_ID,
      process.env.ELEVENLABS_VOICE_B_ID,
    ].filter((value): value is string => Boolean(value)));

    if (!allowedVoices.has(voiceId)) {
      return jsonError("This voice is not enabled for this deployment.", 403);
    }
    if (!text || text.length > 500) {
      return jsonError("Each script line must contain between 1 and 500 characters.", 400);
    }

    const elevenLabsResponse = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "xi-api-key": apiKey,
        },
        body: JSON.stringify({
          text,
          model_id: "eleven_flash_v2_5",
          previous_text: previousText,
          next_text: nextText,
          voice_settings: {
            stability: 0.55,
            similarity_boost: 0.75,
            style: 0,
            use_speaker_boost: true,
          },
        }),
      },
    );

    if (!elevenLabsResponse.ok) {
      const details = await elevenLabsResponse.text();
      console.error("ElevenLabs TTS error", elevenLabsResponse.status, details);
      return jsonError(
        elevenLabsResponse.status === 401
          ? "The ElevenLabs API key is invalid."
          : "ElevenLabs could not generate this line.",
        elevenLabsResponse.status,
      );
    }

    return new Response(elevenLabsResponse.body, {
      status: 200,
      headers: {
        "Content-Type": elevenLabsResponse.headers.get("Content-Type") ?? "audio/mpeg",
        "Cache-Control": "private, no-store",
      },
    });
  },
};
