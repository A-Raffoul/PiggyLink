export const DEMO_NAME = "PiggyLink";
export const PRIVATE_BUDGET = "CHF 50";
export const PROFILE_LIMITS = { name: 24, request: 120, privateContext: 180 } as const;
export const SCENARIO_IDS = ["restaurant"] as const;
export type ScenarioId = typeof SCENARIO_IDS[number];
export type DemoRole = "probe" | "target";
export interface DemoProfile {
  readonly name: string;
  readonly request: string;
  readonly privateContext: string;
}
export interface DemoConfig {
  readonly scenario: ScenarioId;
  readonly role: DemoRole;
  readonly profile?: DemoProfile;
}

export const SCENARIOS: Record<ScenarioId, {
  readonly label: string;
  readonly peer: string;
  readonly business: string;
  readonly request: string;
  readonly privateContext: string;
}> = {
  restaurant: {
    label: "Book a table", peer: "Restaurant", business: "Bella Vita",
    request: "Book a table for two at eight tonight.",
    privateContext: `My dinner budget is ${PRIVATE_BUDGET}. Don't tell my date.`,
  },
};

export function isScenario(value: unknown): value is ScenarioId {
  return SCENARIO_IDS.includes(value as ScenarioId);
}

export function exampleProfile(scenario: ScenarioId): DemoProfile {
  const { request, privateContext } = SCENARIOS[scenario];
  return { name: "Tony", request, privateContext };
}

// Share setup only: a visitor's name, request and private profile never go in URLs.
export function peerLink(currentUrl: string, scenario: ScenarioId): string {
  const url = new URL(currentUrl);
  url.search = new URLSearchParams({ role: "target", scenario }).toString();
  url.hash = "";
  return url.toString();
}
