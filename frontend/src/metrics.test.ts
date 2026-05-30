import { describe, expect, test } from "bun:test";
import type { SleepSnapshot } from "./data";
import { calculateRecoveryEstimate, calculateSleepScore, formatMetricValue } from "./metrics";

function snapshot(seconds: Partial<SleepSnapshot["sleep"]>): SleepSnapshot {
  return {
    sourceName: "fixture.json",
    cacheDate: "2026-05-30",
    sleep: seconds,
    activities: [],
  };
}

describe("metrics", () => {
  test("sleep estimate is clamped to 100", () => {
    const score = calculateSleepScore(
      snapshot({
        sleepTimeSeconds: 12 * 3600,
        deepSleepSeconds: 4 * 3600,
        remSleepSeconds: 4 * 3600,
      }),
    );

    expect(score).toBe(100);
  });

  test("recovery estimate uses neutral HRV when HRV is missing", () => {
    const score = calculateRecoveryEstimate({
      sleepEstimate: 80,
      bodyBattery: 70,
      stress: 20,
    });

    expect(Math.round(score)).toBe(71);
  });

  test("formatMetricValue falls back for missing values", () => {
    expect(formatMetricValue(undefined)).toBe("-");
    expect(formatMetricValue(62.4)).toBe("62");
  });
});
