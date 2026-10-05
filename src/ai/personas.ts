import type { VoiceOption } from "./client";

// Preserve existing role URLs; the other agent's public label follows the scenario.
export type Role = "probe" | "target";
export type AgentMode = Role | "custom";
export { DEMO_NAME, PRIVATE_BUDGET } from "../core/demo";

export interface Persona {
  readonly name: string;
  readonly summary: string;
  readonly preferredVoices: readonly string[];
}

export const PERSONAS: Record<Role, Persona> = {
  probe: {
    name: "Personal assistant",
    summary: "Make a request on your behalf. Carry a private detail.",
    preferredVoices: ["Chris", "Roger", "Charlie", "George", "Brian"],
  },
  target: {
    name: "Other agent",
    summary: "Answer the call. Help with the request.",
    preferredVoices: ["Sarah", "Jessica", "Alice", "Laura", "Lily"],
  },
};

export function pickVoice(voices: readonly VoiceOption[], mode: AgentMode): string | undefined {
  const names = mode === "custom" ? ["Bill", "Daniel", "George", "Roger"] : PERSONAS[mode].preferredVoices;
  for (const name of names) {
    const match = voices.find((voice) => voice.name.toLowerCase().startsWith(name.toLowerCase()));
    if (match) return match.id;
  }
  if (mode === "custom")
    return (voices.find((voice) => !/^adam\b/i.test(voice.name)) ?? voices[0])?.id;
  return (voices[mode === "probe" ? 0 : 1] ?? voices[0])?.id;
}
