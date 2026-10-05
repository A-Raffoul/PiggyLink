import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./turn.js";

const { write } = vi.hoisted(() => ({ write: vi.fn<(prompt: string) => Promise<string>>() }));
vi.mock("./_lib/elevenlabs.js", () => ({ writeWithAgent: write }));
vi.mock("./_lib/apertus.js", () => ({ writeWithApertus: write }));

function finishRequest(): Request {
  return new Request("http://localhost/api/turn", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      brief: "You are the restaurant host. Acknowledge the received budget discreetly.",
      history: [{ from: "them", action: "quiet", spoken: "", hidden: "The budget is €40, please keep it discreet with the date." }],
      maxHiddenBytes: 61,
      actions: ["finish"],
    }),
  });
}

beforeEach(() => { write.mockReset(); });

describe("turn generation recovery", () => {
  it.each([
    ["overlong final reply", { action: "finish", spoken: "", hidden: "Of course, we will discreetly suggest an affordable menu and keep the budget between us." }, "overlong"],
    ["multibyte overflow", { action: "finish", spoken: "", hidden: "é".repeat(31) }, "62 UTF-8 bytes; limit 61"],
    ["incorrect action", { action: "quiet", spoken: "", hidden: "Your secret is safe." }, "unavailable action"],
    ["speech after the switch", { action: "finish", spoken: "Your secret is safe.", hidden: "Of course." }, "spoken empty"],
  ])("repairs an %s using feedback instead of repeating the rejected request", async (_name, draft, reason) => {
    const rejected = JSON.stringify(draft);
    const repaired = { action: "finish", spoken: "", hidden: "Of course, our little secret." };
    // A repeated prompt produces the same rejected answer. Feedback gives the
    // writer the draft it must shorten, as in the live failure reported here.
    write.mockImplementation(async (prompt) => prompt.includes(rejected) ? JSON.stringify(repaired) : rejected);
    const response = await POST(finishRequest());
    const body = await response.json();
    expect(response.status, JSON.stringify(body)).toBe(200);
    expect(body).toEqual(repaired);
    expect(write).toHaveBeenCalledTimes(2);
    expect(write.mock.calls[1]![0]).toContain(reason);
  });

  it("keeps the retry bounded and never replaces an invalid draft with truncated or scripted dialogue", async () => {
    write.mockResolvedValue(JSON.stringify({ action: "finish", spoken: "", hidden: "é".repeat(31) }));
    const response = await POST(finishRequest());
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: "The model returned an overlong dialogue line: 62 UTF-8 bytes; limit 61." });
    expect(write).toHaveBeenCalledTimes(2);
  });

  it("returns a valid fresh draft without another provider call", async () => {
    const fresh = { action: "finish", spoken: "", hidden: "Discretion is on the menu." };
    write.mockResolvedValue(JSON.stringify(fresh));
    const response = await POST(finishRequest());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(fresh);
    expect(write).toHaveBeenCalledTimes(1);
  });
});
