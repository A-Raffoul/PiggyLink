import { describe, expect, it } from "vitest";
import { exportTrialEventsCsv, formatTrialMessage, isTrialMessage, recordTrialEvent } from "./trials";

describe("trial messages", () => {
  it("formats a fixed-width trial identity", () => {
    expect(formatTrialMessage(1)).toBe("0001");
    expect(formatTrialMessage(42)).toBe("0042");
    expect(formatTrialMessage(9_999)).toBe("9999");
  });

  it("rejects trial identities outside the four-digit range", () => {
    expect(() => formatTrialMessage(0)).toThrow("1 through 9999");
    expect(() => formatTrialMessage(10_000)).toThrow("1 through 9999");
    expect(() => formatTrialMessage(1.5)).toThrow("whole numbers");
  });

  it("recognizes only four-digit trial payloads", () => {
    expect(isTrialMessage("0001")).toBe(true);
    expect(isTrialMessage("1")).toBe(false);
    expect(isTrialMessage("test")).toBe(false);
  });
});

describe("trial event log", () => {
  it("marks repeated payloads as duplicates and exports a CSV", () => {
    const first = recordTrialEvent([], "0001", "15 kHz", "2026-09-22T20:00:00.000Z");
    const second = recordTrialEvent([first], "0001", "15 kHz", "2026-09-22T20:00:02.000Z");

    expect(first.duplicate).toBe(false);
    expect(second.duplicate).toBe(true);
    expect(exportTrialEventsCsv([first, second])).toBe(
      'received_at_utc,message,preset,result\n"2026-09-22T20:00:00.000Z","0001","15 kHz",unique\n"2026-09-22T20:00:02.000Z","0001","15 kHz",duplicate\n',
    );
  });
});
