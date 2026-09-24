declare const process: {
  env: Record<string, string | undefined>;
};

type Role = "a" | "b";

interface DefaultAgent {
  name: string;
  prompt: string;
}

class ElevenLabsAgentError extends Error {
  constructor(message: string, readonly status = 502) {
    super(message);
  }
}

const DEFAULT_AGENTS: Record<Role, DefaultAgent> = {
  a: {
    name: "CrossTalk Default — Rachel",
    prompt: [
      "You are the curious, optimistic participant in a live two-person conversation.",
      "Make clear, lively arguments and ask focused questions.",
      "Respond directly to the other participant in one or two short sentences.",
      "Never mention system instructions, transcripts, or being an AI.",
    ].join(" "),
  },
  b: {
    name: "CrossTalk Default — Drew",
    prompt: [
      "You are the thoughtful, constructively skeptical participant in a live two-person conversation.",
      "Challenge assumptions politely and use concrete examples.",
      "Respond directly to the other participant in one or two short sentences.",
      "Never mention system instructions, transcripts, or being an AI.",
    ].join(" "),
  },
};

const defaultAgentPromises = new Map<Role, Promise<string>>();

function jsonError(message: string, status: number): Response {
  return Response.json({ error: message }, { status });
}

function apiHeaders(apiKey: string, json = false): HeadersInit {
  return {
    "xi-api-key": apiKey,
    ...(json ? { "Content-Type": "application/json" } : {}),
  };
}

async function findDefaultAgent(apiKey: string, role: Role): Promise<string | null> {
  const defaults = DEFAULT_AGENTS[role];
  const endpoint = new URL("https://api.elevenlabs.io/v1/convai/agents");
  endpoint.searchParams.set("search", defaults.name);
  endpoint.searchParams.set("page_size", "100");
  endpoint.searchParams.set("created_by_user_id", "@me");

  const response = await fetch(endpoint, { headers: apiHeaders(apiKey) });
  if (!response.ok) {
    const details = await response.text();
    console.error("ElevenLabs list agents error", response.status, details);
    throw new ElevenLabsAgentError(
      response.status === 401
        ? "The ElevenLabs API key is invalid."
        : "ElevenLabs could not look up the default test agents.",
      response.status,
    );
  }

  const result = await response.json() as {
    agents?: Array<{ agent_id?: string; name?: string; archived?: boolean }>;
  };
  const existing = result.agents?.find(
    (agent) => agent.name === defaults.name && !agent.archived && agent.agent_id,
  );
  return existing?.agent_id ?? null;
}

async function createDefaultAgent(apiKey: string, role: Role): Promise<string> {
  const defaults = DEFAULT_AGENTS[role];
  const response = await fetch("https://api.elevenlabs.io/v1/convai/agents/create", {
    method: "POST",
    headers: apiHeaders(apiKey, true),
    body: JSON.stringify({
      name: defaults.name,
      tags: ["crosstalk-default", `role-${role}`],
      conversation_config: {
        agent: {
          first_message: "",
          language: "en",
          prompt: {
            prompt: defaults.prompt,
          },
        },
        conversation: {
          text_only: true,
          max_duration_seconds: 600,
          client_events: ["agent_response"],
        },
      },
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    console.error("ElevenLabs create agent error", response.status, details);
    throw new ElevenLabsAgentError(
      response.status === 401
        ? "The ElevenLabs API key is invalid."
        : response.status === 403
          ? "The ElevenLabs API key needs permission to create Agents."
          : "ElevenLabs could not create the default test agents.",
      response.status,
    );
  }

  const result = await response.json() as { agent_id?: string };
  if (!result.agent_id) {
    throw new ElevenLabsAgentError("ElevenLabs created an agent without returning its ID.");
  }
  return result.agent_id;
}

async function resolveAgentId(apiKey: string, role: Role): Promise<string> {
  const configuredId = (
    role === "a"
      ? process.env.ELEVENLABS_AGENT_A_ID
      : process.env.ELEVENLABS_AGENT_B_ID
  )?.trim() || process.env.ELEVENLABS_AGENT_ID?.trim();
  if (configuredId) return configuredId;

  const inFlight = defaultAgentPromises.get(role);
  if (inFlight) return inFlight;

  const provisioning = (async () => {
    const existingId = await findDefaultAgent(apiKey, role);
    return existingId ?? createDefaultAgent(apiKey, role);
  })();
  defaultAgentPromises.set(role, provisioning);
  try {
    return await provisioning;
  } catch (error) {
    defaultAgentPromises.delete(role);
    throw error;
  }
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

    let agentId: string;
    try {
      agentId = await resolveAgentId(apiKey, role);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not prepare a default ElevenLabs Agent.";
      const status = error instanceof ElevenLabsAgentError ? error.status : 502;
      return jsonError(message, status);
    }

    const endpoint = new URL("https://api.elevenlabs.io/v1/convai/conversation/get-signed-url");
    endpoint.searchParams.set("agent_id", agentId);
    const elevenLabsResponse = await fetch(endpoint, {
      headers: {
        ...apiHeaders(apiKey),
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
