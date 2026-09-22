export interface TrialEvent {
  readonly receivedAt: string;
  readonly message: string;
  readonly presetLabel: string;
  readonly duplicate: boolean;
}

export interface TrialPlan {
  readonly first: number;
  readonly count: number;
  readonly condition: string;
}

export interface TrialReportRow {
  readonly trialNumber: number | null;
  readonly expectedMessage: string;
  readonly receivedAt: string;
  readonly receivedMessage: string;
  readonly presetLabel: string;
  readonly result: "received" | "missed" | "duplicate" | "unexpected";
  readonly condition: string;
}

const TRIAL_MESSAGE = /^\d{4}$/;

export function formatTrialMessage(sequence: number): string {
  if (!Number.isInteger(sequence) || sequence < 1 || sequence > 9_999) {
    throw new Error("Trial numbers must be whole numbers from 1 through 9999.");
  }
  return String(sequence).padStart(4, "0");
}

export function isTrialMessage(message: string): boolean {
  return TRIAL_MESSAGE.test(message);
}

export function createTrialPlan(first: number, count: number, condition: string): TrialPlan {
  formatTrialMessage(first);
  if (!Number.isInteger(count) || count < 1 || count > 100 || first + count - 1 > 9_999) {
    throw new Error("Choose 1–100 trials that stay within message 9999.");
  }
  return { first, count, condition: condition.trim() || "Unlabelled condition" };
}

export function recordTrialEvent(
  events: readonly TrialEvent[],
  message: string,
  presetLabel: string,
  receivedAt = new Date().toISOString(),
): TrialEvent {
  return {
    receivedAt,
    message,
    presetLabel,
    duplicate: events.some((event) => event.message === message),
  };
}

function csvCell(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

export function buildTrialReport(plan: TrialPlan, events: readonly TrialEvent[]): TrialReportRow[] {
  const expectedMessages = Array.from({ length: plan.count }, (_, offset) => formatTrialMessage(plan.first + offset));
  const expectedSet = new Set(expectedMessages);
  const rows: TrialReportRow[] = [];

  for (const [offset, message] of expectedMessages.entries()) {
    const matching = events.filter((event) => event.message === message);
    const first = matching[0];
    rows.push({
      trialNumber: plan.first + offset,
      expectedMessage: message,
      receivedAt: first?.receivedAt ?? "",
      receivedMessage: first?.message ?? "",
      presetLabel: first?.presetLabel ?? "",
      result: first ? "received" : "missed",
      condition: plan.condition,
    });
    for (const duplicate of matching.slice(1)) {
      rows.push({
        trialNumber: plan.first + offset,
        expectedMessage: message,
        receivedAt: duplicate.receivedAt,
        receivedMessage: duplicate.message,
        presetLabel: duplicate.presetLabel,
        result: "duplicate",
        condition: plan.condition,
      });
    }
  }

  for (const event of events) {
    if (expectedSet.has(event.message)) continue;
    rows.push({
      trialNumber: null,
      expectedMessage: "",
      receivedAt: event.receivedAt,
      receivedMessage: event.message,
      presetLabel: event.presetLabel,
      result: "unexpected",
      condition: plan.condition,
    });
  }
  return rows;
}

export function exportTrialReportCsv(plan: TrialPlan, events: readonly TrialEvent[]): string {
  const rows = ["condition,trial_number,expected_message,received_at_utc,received_message,preset,result"];
  for (const row of buildTrialReport(plan, events)) {
    rows.push(
      [
        csvCell(row.condition),
        row.trialNumber === null ? "" : String(row.trialNumber),
        csvCell(row.expectedMessage),
        csvCell(row.receivedAt),
        csvCell(row.receivedMessage),
        csvCell(row.presetLabel),
        row.result,
      ].join(","),
    );
  }
  return `${rows.join("\n")}\n`;
}
