declare const process: {
  env: Record<string, string | undefined>;
};

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

    let incoming: FormData;
    try {
      incoming = await request.formData();
    } catch {
      return jsonError("The request must contain an audio file.", 400);
    }

    const audio = incoming.get("audio");
    if (!(audio instanceof File) || audio.size === 0) {
      return jsonError("The recorded audio is empty.", 400);
    }
    if (audio.size > 8 * 1024 * 1024) {
      return jsonError("The recorded line is too large to transcribe.", 413);
    }
    if (audio.type && !audio.type.startsWith("audio/")) {
      return jsonError("Only recorded audio can be transcribed.", 415);
    }

    const payload = new FormData();
    payload.append("file", audio, audio.name || "peer-line.webm");
    payload.append("model_id", "scribe_v2");
    payload.append("language_code", "eng");
    payload.append("tag_audio_events", "false");
    payload.append("timestamps_granularity", "none");

    const elevenLabsResponse = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
      },
      body: payload,
    });

    if (!elevenLabsResponse.ok) {
      const details = await elevenLabsResponse.text();
      console.error("ElevenLabs Scribe error", elevenLabsResponse.status, details);
      return jsonError(
        elevenLabsResponse.status === 401
          ? "The ElevenLabs API key is invalid."
          : "ElevenLabs could not decode the other voice.",
        elevenLabsResponse.status,
      );
    }

    const result = await elevenLabsResponse.json() as {
      text?: string;
      language_code?: string;
      language_probability?: number;
    };

    return Response.json({
      text: result.text?.trim() ?? "",
      languageCode: result.language_code ?? null,
      languageProbability: result.language_probability ?? null,
    });
  },
};
