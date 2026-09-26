import { describe, expect, it } from "vitest";
import { getTrialProgress } from "./trial";

const iso = (value: string) => new Date(value);

describe("getTrialProgress", () => {
  it("computes remaining days and elapsed percent mid-trial", () => {
    const result = getTrialProgress({
      now: iso("2026-09-26T12:00:00.000Z"),
      startedAt: iso("2026-09-25T09:55:00.000Z"),
      endsAt: iso("2026-10-09T09:55:00.000Z"),
    });
    expect(result).not.toBeNull();
    expect(result?.totalDays).toBe(14);
    expect(result?.remainingDays).toBe(13);
    expect(result?.isExpired).toBe(false);
    expect(result?.elapsedPercent).toBe(8);
  });

  it("shows a fresh trial with full days remaining", () => {
    const result = getTrialProgress({
      now: iso("2026-09-25T09:55:00.000Z"),
      startedAt: iso("2026-09-25T09:55:00.000Z"),
      endsAt: iso("2026-10-09T09:55:00.000Z"),
    });
    expect(result?.remainingDays).toBe(14);
    expect(result?.elapsedPercent).toBe(0);
    expect(result?.isExpired).toBe(false);
  });

  it("rounds partial remaining days up", () => {
    const result = getTrialProgress({
      now: iso("2026-09-26T08:00:00.000Z"),
      startedAt: iso("2026-09-25T09:55:00.000Z"),
      endsAt: iso("2026-10-09T09:55:00.000Z"),
    });
    // ~13.08 days left -> displayed as 14
    expect(result?.remainingDays).toBe(14);
  });

  it("marks an expired trial with zero days remaining", () => {
    const result = getTrialProgress({
      now: iso("2026-10-10T00:00:00.000Z"),
      startedAt: iso("2026-09-25T09:55:00.000Z"),
      endsAt: iso("2026-10-09T09:55:00.000Z"),
    });
    expect(result?.remainingDays).toBe(0);
    expect(result?.isExpired).toBe(true);
    expect(result?.elapsedPercent).toBe(100);
  });

  it("returns null when the trial has no end date", () => {
    expect(
      getTrialProgress({
        now: iso("2026-09-26T12:00:00.000Z"),
        startedAt: iso("2026-09-25T09:55:00.000Z"),
        endsAt: null,
      }),
    ).toBeNull();
  });
});
