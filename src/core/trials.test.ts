import { describe, expect, it } from "vitest";
import {
  buildTrialReport,
  createTrialPlan,
  exportTrialReportCsv,
  formatTrialMessage,
  isTrialMessage,
  recordTrialEvent,
} from "./trials";

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
  it("reports received, missed, duplicate, and unexpected payloads in a CSV", () => {
    const first = recordTrialEvent([], "0001", "15 kHz", "2026-09-22T20:00:00.000Z");
    const second = recordTrialEvent([first], "0001", "15 kHz", "2026-09-22T20:00:02.000Z");
    const unexpected = recordTrialEvent([first, second], "0099", "15 kHz", "2026-09-22T20:00:03.000Z");
    const plan = createTrialPlan(1, 2, "Mac → iPhone · 15 kHz · −30 dB");

    expect(first.duplicate).toBe(false);
    expect(second.duplicate).toBe(true);
    expect(buildTrialReport(plan, [first, second, unexpected]).map((row) => row.result)).toEqual([
      "received",
      "duplicate",
      "missed",
      "unexpected",
    ]);
    expect(exportTrialReportCsv(plan, [first, second, unexpected])).toBe(
      'condition,trial_number,expected_message,received_at_utc,received_message,preset,result\n"Mac → iPhone · 15 kHz · −30 dB",1,"0001","2026-09-22T20:00:00.000Z","0001","15 kHz",received\n"Mac → iPhone · 15 kHz · −30 dB",1,"0001","2026-09-22T20:00:02.000Z","0001","15 kHz",duplicate\n"Mac → iPhone · 15 kHz · −30 dB",2,"0002","","","",missed\n"Mac → iPhone · 15 kHz · −30 dB",,"","2026-09-22T20:00:03.000Z","0099","15 kHz",unexpected\n',
    );
  });
});
