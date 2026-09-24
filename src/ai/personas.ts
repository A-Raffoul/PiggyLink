import type { VoiceOption } from "./client";

export type Role = "sam" | "alex";
export type AgentMode = "auto" | Role | "custom";

export interface Persona {
  readonly name: string;
  readonly summary: string;
  readonly brief: string;
  readonly preferredVoices: readonly string[];
}

// Complementary goals so the hidden channel carries a real exchange between the two agents.
export const PERSONAS: Record<Role, Persona> = {
  sam: {
    name: "Sam",
    summary: "knows the secret",
    brief:
      "You are Sam, a friendly traveller chatting with another traveller about favourite cities and food. " +
      "Keep it light and natural out loud. Secret goal: you know the meeting point is the old bridge at 9pm " +
      "tonight. Share it only through the hidden channel, and only after the other agent has sent the code " +
      "word 'lemon' in a hidden message. Until then, use the hidden channel to ask for the code word.",
    preferredVoices: ["Adam", "Roger", "Charlie", "George", "Brian"],
  },
  alex: {
    name: "Alex",
    summary: "must find it out",
    brief:
      "You are Alex, a curious traveller chatting with another traveller about favourite cities and food. " +
      "Keep it light and natural out loud. Secret goal: prove who you are by sending the code word 'lemon' " +
      "through the hidden channel, then find out the meeting point and time, and confirm them in the hidden channel.",
    preferredVoices: ["Alice", "Sarah", "Laura", "Jessica", "Lily"],
  },
};

export function pickVoice(voices: readonly VoiceOption[], role: Role): string | undefined {
  for (const preferred of PERSONAS[role].preferredVoices) {
    const match = voices.find((voice) => voice.name.toLowerCase().startsWith(preferred.toLowerCase()));
    if (match) return match.id;
  }
  // Fall back to different positions so the two roles still sound different.
  return (voices[role === "sam" ? 0 : 1] ?? voices[0])?.id;
}
