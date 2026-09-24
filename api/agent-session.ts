declare const process: {
  env: Record<string, string | undefined>;
};

function jsonError(message: string, status: number): Response {
  return Response.json({ error: message }, { status });
}

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method !== "GET") {
      return jsonError("Method not allowed.", 405);
    }

    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      return jsonError("ElevenLabs is not configured yet. Add ELEVENLABS_API_KEY in Vercel.", 503);
    }

    const role = new URL(request.url).searchParams.get("role");
    if (role !== "a" && role !== "b") {
      return jsonError("Choose agent role a or b.", 400);
    }

    const sharedAgentId = process.env.ELEVENLABS_AGENT_ID?.trim();
    const agentId = (
      role === "a"
        ? process.env.ELEVENLABS_AGENT_A_ID
        : process.env.ELEVENLABS_AGENT_B_ID
    )?.trim() || sharedAgentId;

    if (!agentId) {
      return jsonError(
        `Dynamic replies need an ElevenLabs Agent ID. Add ELEVENLABS_AGENT_${role.toUpperCase()}_ID in Vercel.`,
        503,
      );
    }

    const endpoint = new URL("https://api.elevenlabs.io/v1/convai/conversation/get-signed-url");
    endpoint.searchParams.set("agent_id", agentId);
    const elevenLabsResponse = await fetch(endpoint, {
      headers: {
        "xi-api-key": apiKey,
      },
    });

    if (!elevenLabsResponse.ok) {
      const details = await elevenLabsResponse.text();
      console.error("ElevenLabs signed URL error", elevenLabsResponse.status, details);
      return jsonError(
        elevenLabsResponse.status === 401
          ? "The ElevenLabs API key is invalid."
          : elevenLabsResponse.status === 404
            ? `The ElevenLabs Agent ID for role ${role.toUpperCase()} was not found.`
            : "ElevenLabs could not start the agent session.",
        elevenLabsResponse.status,
      );
    }

    const result = await elevenLabsResponse.json() as { signed_url?: string };
    if (!result.signed_url?.startsWith("wss://")) {
      return jsonError("ElevenLabs returned an invalid agent session.", 502);
    }

    return Response.json(
      { signedUrl: result.signed_url },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  },
};
