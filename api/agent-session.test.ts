import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const runtimeProcess = (globalThis as unknown as {
  process: { env: Record<string, string | undefined> };
}).process;

function jsonResponse(value: unknown, status = 200): Response {
  return Response.json(value, { status });
}

describe("default ElevenLabs agents", () => {
  beforeEach(() => {
    vi.resetModules();
    runtimeProcess.env.ELEVENLABS_API_KEY = "test-key";
    delete runtimeProcess.env.ELEVENLABS_AGENT_ID;
    delete runtimeProcess.env.ELEVENLABS_AGENT_A_ID;
    delete runtimeProcess.env.ELEVENLABS_AGENT_B_ID;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete runtimeProcess.env.ELEVENLABS_API_KEY;
  });

  it("reuses an existing named default agent", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({
        agents: [{
          agent_id: "agent-rachel",
          name: "CrossTalk Default — Rachel",
          archived: false,
        }],
      }))
      .mockResolvedValueOnce(jsonResponse({ signed_url: "wss://example.test/rachel" }));
    vi.stubGlobal("fetch", fetchMock);

    const { default: route } = await import("./agent-session");
    const response = await route.fetch(new Request("https://example.test/api/agent-session?role=a"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ signedUrl: "wss://example.test/rachel" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/v1/convai/agents?");
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain("agent_id=agent-rachel");
  });

  it("creates a text-only default agent when none exists", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ agents: [] }))
      .mockResolvedValueOnce(jsonResponse({ agent_id: "agent-drew" }))
      .mockResolvedValueOnce(jsonResponse({ signed_url: "wss://example.test/drew" }));
    vi.stubGlobal("fetch", fetchMock);

    const { default: route } = await import("./agent-session");
    const response = await route.fetch(new Request("https://example.test/api/agent-session?role=b"));

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    const createCall = fetchMock.mock.calls[1];
    expect(createCall?.[0]).toBe("https://api.elevenlabs.io/v1/convai/agents/create");
    const createInit = createCall?.[1] as RequestInit;
    const createBody = JSON.parse(String(createInit.body)) as {
      name: string;
      conversation_config: { conversation: { text_only: boolean } };
    };
    expect(createBody.name).toBe("CrossTalk Default — Drew");
    expect(createBody.conversation_config.conversation.text_only).toBe(true);
  });
});
