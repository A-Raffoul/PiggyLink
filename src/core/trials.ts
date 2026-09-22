export interface TrialEvent {
  readonly receivedAt: string;
  readonly message: string;
  readonly presetLabel: string;
  readonly duplicate: boolean;
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

export function exportTrialEventsCsv(events: readonly TrialEvent[]): string {
  const rows = ["received_at_utc,message,preset,result"];
  for (const event of events) {
    rows.push(
      [
        csvCell(event.receivedAt),
        csvCell(event.message),
        csvCell(event.presetLabel),
        event.duplicate ? "duplicate" : "unique",
      ].join(","),
    );
  }
  return `${rows.join("\n")}\n`;
}
