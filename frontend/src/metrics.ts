import type { SleepSnapshot } from "./data";

export type RecoveryInput = {
  sleepEstimate: number;
  bodyBattery?: number;
  stress?: number;
  hrv?: number;
};

export function clampPercent(n: number): number {
  return Math.max(0, Math.min(100, n));
}

export function calculateSleepScore(snapshot: SleepSnapshot): number {
  const sleep = snapshot.sleep;
  const total = sleep.sleepTimeSeconds ?? 0;
  const deep = sleep.deepSleepSeconds ?? 0;
  const rem = sleep.remSleepSeconds ?? 0;

  const sleepDurationScore = clampPercent((total / (8 * 3600)) * 100);
  const deepScore = clampPercent((deep / (90 * 60)) * 100);
  const remScore = clampPercent((rem / (90 * 60)) * 100);
  return clampPercent(sleepDurationScore * 0.7 + deepScore * 0.15 + remScore * 0.15);
}

export function calculateRecoveryEstimate(input: RecoveryInput): number {
  const bodyBattery = input.bodyBattery ?? 0;
  const stress = input.stress ?? 0;
  const stressScore = clampPercent(100 - stress * 1.5);
  const hrvScore = typeof input.hrv === "number" ? clampPercent((input.hrv / 60) * 100) : 50;

  return clampPercent(input.sleepEstimate * 0.4 + bodyBattery * 0.35 + hrvScore * 0.15 + stressScore * 0.1);
}

export function formatMetricValue(value: number | undefined, fallback = "-"): string {
  return typeof value === "number" && Number.isFinite(value) ? String(Math.round(value)) : fallback;
}
