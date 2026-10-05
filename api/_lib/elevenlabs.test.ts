import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

class AgentSocket extends EventTarget {
  static connections: string[] = [];
  static failNext = false;
  constructor(url: string) {
    super();
    AgentSocket.connections.push(url);
    queueMicrotask(() => this.dispatchEvent(new Event("open")));
  }
  send(data: string): void {
    const message = JSON.parse(data) as { type: string; text?: string };
    if (message.type === "user_message") queueMicrotask(() => {
      if (AgentSocket.failNext) {
        AgentSocket.failNext = false;
        this.dispatchEvent(new Event("error"));
      } else this.dispatchEvent(new MessageEvent("message", {
        data: JSON.stringify({ type: "agent_response", agent_response_event: { agent_response: message.text } }),
      }));
    });
  }
  close(): void {}
}

beforeEach(() => {
  vi.resetModules();
  AgentSocket.connections = [];
  AgentSocket.failNext = false;
  vi.stubEnv("ELEVENLABS_API_KEY", "test-key");
  vi.stubEnv("ELEVENLABS_AGENT_ID", "test-agent");
  vi.stubGlobal("WebSocket", AgentSocket);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("agent connection setup", () => {
  it("avoids repeated authentication round trips while keeping each reply in its own conversation", async () => {
    // Each HTTP request needs its own consumable response body.
    const fetch = vi.fn(async () => new Response(JSON.stringify({ signed_url: "wss://example.test/agent" })));
    vi.stubGlobal("fetch", fetch);
    const { writeWithAgent } = await import("./elevenlabs.js");
    expect(await writeWithAgent("First profile's turn")).toBe("First profile's turn");
    expect(await writeWithAgent("Second profile's turn")).toBe("Second profile's turn");
    expect(AgentSocket.connections).toHaveLength(2);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("shares pending authentication across simultaneous turns without sharing their replies", async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify({ signed_url: "wss://example.test/agent" })));
    vi.stubGlobal("fetch", fetch);
    const { writeWithAgent } = await import("./elevenlabs.js");
    expect(await Promise.all([writeWithAgent("One"), writeWithAgent("Two")])).toEqual(["One", "Two"]);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(AgentSocket.connections).toHaveLength(2);
  });

  it("refreshes authentication before the provider's fifteen-minute expiry", async () => {
    const now = vi.spyOn(Date, "now").mockReturnValue(1_000);
    const fetch = vi.fn(async () => new Response(JSON.stringify({ signed_url: `wss://example.test/agent-${Date.now()}` })));
    vi.stubGlobal("fetch", fetch);
    const { writeWithAgent } = await import("./elevenlabs.js");
    await writeWithAgent("One");
    now.mockReturnValue(1_000 + 10 * 60_000);
    await writeWithAgent("Two");
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(AgentSocket.connections[0]).not.toBe(AgentSocket.connections[1]);
  });

  it("gets fresh authentication after a failed connection", async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify({ signed_url: "wss://example.test/agent" })));
    vi.stubGlobal("fetch", fetch);
    const { writeWithAgent } = await import("./elevenlabs.js");
    AgentSocket.failNext = true;
    await expect(writeWithAgent("One")).rejects.toThrow("Could not reach");
    expect(await writeWithAgent("Two")).toBe("Two");
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("does not cache a failed authentication request", async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(new Response("Unavailable", { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ signed_url: "wss://example.test/agent" })));
    vi.stubGlobal("fetch", fetch);
    const { writeWithAgent } = await import("./elevenlabs.js");
    await expect(writeWithAgent("One")).rejects.toThrow("503");
    expect(await writeWithAgent("Two")).toBe("Two");
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});

describe("voice generation", () => {
  it("defaults to Flash while honoring an explicit voice-model setting", async () => {
    vi.stubEnv("ELEVENLABS_TTS_MODEL", "");
    const models: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body)) as { model_id: string };
      models.push(body.model_id);
      return new Response(new Uint8Array([0, 1]));
    }));
    const { synthesize } = await import("./elevenlabs.js");
    await synthesize("Hello.", "test-voice");
    vi.stubEnv("ELEVENLABS_TTS_MODEL", "eleven_multilingual_v2");
    await synthesize("Hello.", "test-voice");
    expect(models).toEqual(["eleven_flash_v2_5", "eleven_multilingual_v2"]);
  });
});
