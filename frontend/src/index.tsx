import { TextAttributes, createCliRenderer } from "@opentui/core";
import { createRoot, useKeyboard } from "@opentui/react";
import { useMemo, useState } from "react";
import { loadSleepSnapshots, type SleepSnapshot } from "./data";
import {
  HrvChart,
  SleepScoreChart,
  type ChartMode,
  type HrvPoint,
  type SleepScorePoint,
} from "./charts";

function clamp(n: number): number {
  return Math.max(0, Math.min(100, n));
}

function pct(n: number, total: number): number {
  if (!total) return 0;
  return Math.max(0, Math.min(100, (n / total) * 100));
}

function formatHM(seconds = 0): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

function formatMin(seconds = 0): string {
  return `${Math.round(seconds / 60)} min`;
}

function formatKm(meters = 0): string {
  return `${(meters / 1000).toFixed(1)} km`;
}

function dateLabel(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`);
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatBedtimeRange(startMs?: number, endMs?: number): string {
  if (!startMs || !endMs) return "-";
  const start = new Date(startMs);
  const end = new Date(endMs);
  const fmt = (d: Date) => d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return `${fmt(start)} -> ${fmt(end)}`;
}

function buildCalendarLines(dateStr: string): string[] {
  const d = new Date(`${dateStr}T00:00:00`);
  const year = d.getFullYear();
  const month = d.getMonth();
  const day = d.getDate();

  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const monthName = first.toLocaleDateString(undefined, { month: "long", year: "numeric" });

  const lines: string[] = [monthName, "Su Mo Tu We Th Fr Sa"];
  let line = "";

  for (let i = 0; i < first.getDay(); i++) {
    line += "   ";
  }

  for (let dNum = 1; dNum <= last.getDate(); dNum++) {
    const isCurrent = dNum === day;
    const cell = isCurrent ? `[${String(dNum).padStart(2, " ")}]` : ` ${String(dNum).padStart(2, " ")}`;

    if (isCurrent) {
      line += cell;
    } else {
      line += `${cell} `;
    }

    const dayOfWeek = new Date(year, month, dNum).getDay();
    if (dayOfWeek === 6) {
      lines.push(line.trimEnd());
      line = "";
    }
  }

  if (line.trim().length > 0) lines.push(line.trimEnd());
  return lines;
}

function sleepScoreFromSnapshot(snapshot: SleepSnapshot): number {
  const sleep = snapshot.sleep;
  const total = sleep.sleepTimeSeconds ?? 0;
  const deep = sleep.deepSleepSeconds ?? 0;
  const rem = sleep.remSleepSeconds ?? 0;

  const sleepDurationScore = clamp((total / (8 * 3600)) * 100);
  const deepScore = clamp((deep / (90 * 60)) * 100);
  const remScore = clamp((rem / (90 * 60)) * 100);
  return clamp(sleepDurationScore * 0.7 + deepScore * 0.15 + remScore * 0.15);
}

function Progress({ label, value, color }: { label: string; value: number; color: string }) {
  const safe = clamp(value);
  return (
    <box flexDirection="column" marginBottom={1}>
      <box flexDirection="row" justifyContent="space-between">
        <text>{label}</text>
        <text attributes={TextAttributes.DIM}>{safe.toFixed(0)}%</text>
      </box>
      <box style={{ backgroundColor: "#202329" }}>
        <box style={{ width: `${safe}%`, height: 1, backgroundColor: color }} />
      </box>
    </box>
  );
}

function ScoreCircle({ title, value, tint }: { title: string; value: number | string; tint: string }) {
  const display = String(value).slice(0, 7);
  return (
    <box width={20} alignItems="center" flexDirection="column">
      <text attributes={TextAttributes.DIM}>{title}</text>
      <text fg={tint}>    +----------+</text>
      <text fg={tint}>    |          |</text>
      <text fg={tint}>    |   {display.padStart(3, " ")}    |</text>
      <text fg={tint}>    |          |</text>
      <text fg={tint}>    +----------+</text>
    </box>
  );
}

function SleepDashboard({ snapshots }: { snapshots: SleepSnapshot[] }) {
  const [index, setIndex] = useState(Math.max(0, snapshots.length - 1));
  const [trendMode, setTrendMode] = useState<ChartMode>("month");

  useKeyboard((key) => {
    if (key.name === "escape" || key.name === "q") process.exit(0);
    if (key.name === "left" || key.name === "h") setIndex((i) => Math.max(0, i - 1));
    if (key.name === "right" || key.name === "l") setIndex((i) => Math.min(snapshots.length - 1, i + 1));

    if (key.name === "w") setTrendMode("week");
    if (key.name === "m") setTrendMode("month");
  });

  const current = snapshots[index]!;
  const sleep = current.sleep;

  const total = sleep.sleepTimeSeconds ?? 0;
  const deep = sleep.deepSleepSeconds ?? 0;
  const light = sleep.lightSleepSeconds ?? 0;
  const rem = sleep.remSleepSeconds ?? 0;
  const awake = sleep.awakeSleepSeconds ?? 0;

  const bodyBattery = current.summary?.bodyBatteryMostRecentValue ?? 0;
  const stress = current.summary?.averageStressLevel ?? 0;
  const restingHR = current.summary?.restingHeartRate ?? 0;
  const hrv = current.hrv;

  const sleepScore = sleepScoreFromSnapshot(current);

  const stageTotal = deep + light + rem;
  const deepPct = pct(deep, stageTotal);
  const lightPct = pct(light, stageTotal);
  const remPct = pct(rem, stageTotal);

  const stressScore = clamp(100 - stress * 1.5);
  const hrvScore = typeof hrv === "number" ? clamp((hrv / 60) * 100) : 50;
  const recoveryEstimate = clamp(sleepScore * 0.4 + bodyBattery * 0.35 + hrvScore * 0.15 + stressScore * 0.1);

  const latestSnapshotDate = snapshots[snapshots.length - 1]?.cacheDate;

  const sleepTrendPoints = useMemo<SleepScorePoint[]>(() => {
    if (!latestSnapshotDate) return [];

    const end = new Date(`${latestSnapshotDate}T00:00:00`);
    const windowDays = trendMode === "week" ? 7 : 30;
    const start = new Date(end);
    start.setDate(end.getDate() - (windowDays - 1));

    return snapshots
      .filter((s) => {
        const d = new Date(`${s.cacheDate}T00:00:00`);
        return d >= start && d <= end;
      })
      .map((s) => ({ date: s.cacheDate, score: sleepScoreFromSnapshot(s) }));
  }, [latestSnapshotDate, trendMode, snapshots]);

  const hrvTrendPoints = useMemo<HrvPoint[]>(() => {
    if (!latestSnapshotDate) return [];

    const end = new Date(`${latestSnapshotDate}T00:00:00`);
    const windowDays = trendMode === "week" ? 7 : 30;
    const start = new Date(end);
    start.setDate(end.getDate() - (windowDays - 1));

    return snapshots
      .filter((s) => {
        const d = new Date(`${s.cacheDate}T00:00:00`);
        return d >= start && d <= end && typeof s.hrv === "number";
      })
      .map((s) => ({ date: s.cacheDate, hrv: s.hrv as number }));
  }, [latestSnapshotDate, trendMode, snapshots]);

  const calendarLines = useMemo(() => buildCalendarLines(current.cacheDate), [current.cacheDate]);

  return (
    <box flexDirection="column" flexGrow={1} padding={1}>
      <text attributes={TextAttributes.BOLD}>Better Garmin - Sleep + Recovery Dashboard</text>
      <text attributes={TextAttributes.DIM}>Left/Right or h/l day | w=7d m=30d charts | q/esc quit</text>
      <text attributes={TextAttributes.DIM}>
        Day: {dateLabel(current.cacheDate)} ({index + 1}/{snapshots.length}) | Sleep window: {formatBedtimeRange(sleep.sleepStartTimestampLocal, sleep.sleepEndTimestampLocal)}
      </text>

      <text> </text>
      <box justifyContent="center" flexDirection="row" gap={1}>
        <ScoreCircle title="Sleep Score" value={Math.round(sleepScore)} tint="#4cc9f0" />
        <ScoreCircle title="Recovery" value={Math.round(recoveryEstimate)} tint="#7ae582" />
      </box>
      <box justifyContent="center" flexDirection="row" gap={1}>
        <ScoreCircle title="Resting HR" value={restingHR || "-"} tint="#ffd166" />
        <ScoreCircle title="HRV (ms)" value={typeof hrv === "number" ? Math.round(hrv) : "-"} tint="#72efdd" />
        <ScoreCircle title="Stress" value={Math.round(stress)} tint="#f72585" />
      </box>

      <text> </text>
      <box flexDirection="row" gap={1}>
        <box width="50%" style={{ border: true, borderStyle: "single", borderColor: "#3a3f4b", padding: 1 }}>
          <text attributes={TextAttributes.BOLD}>Sleep Breakdown</text>
          <text>Total sleep: {formatHM(total)}</text>
          <text>Awake: {formatMin(awake)}</text>
          <text>HRV status: {current.hrvStatus ?? "-"}</text>
          <text> </text>
          <Progress label={`Deep (${formatHM(deep)})`} value={deepPct} color="#4361ee" />
          <Progress label={`Light (${formatHM(light)})`} value={lightPct} color="#4895ef" />
          <Progress label={`REM (${formatHM(rem)})`} value={remPct} color="#f72585" />
          <text attributes={TextAttributes.DIM}>Sleep: 70%duration + 15%deep + 15%REM</text>
          <text attributes={TextAttributes.DIM}>Recovery: 40%sleep + 35%BB + 15%HRV + 10%stress</text>
        </box>

        <box width="50%" style={{ border: true, borderStyle: "single", borderColor: "#3a3f4b", padding: 1 }}>
          <text attributes={TextAttributes.BOLD}>Calendar</text>
          <text> </text>
          {calendarLines.map((line, idx) => (
            <text key={idx}>{line}</text>
          ))}
        </box>
      </box>

      <text> </text>
      <box flexDirection="row" gap={1}>
        <box width="50%">
          <SleepScoreChart points={sleepTrendPoints} mode={trendMode} selectedDate={current.cacheDate} />
        </box>
        <box width="50%">
          <HrvChart points={hrvTrendPoints} mode={trendMode} selectedDate={current.cacheDate} />
        </box>
      </box>

      <text attributes={TextAttributes.DIM}>Source: {current.sourceName}</text>
    </box>
  );
}

function ErrorView({ message }: { message: string }) {
  return (
    <box flexDirection="column" flexGrow={1} padding={1}>
      <text attributes={TextAttributes.BOLD}>Better Garmin - Sleep Dashboard</text>
      <text>Could not load sleep cache.</text>
      <text attributes={TextAttributes.DIM}>{message}</text>
      <text attributes={TextAttributes.DIM}>Expected cache files in ../backend/cache/garmin_*.json</text>
    </box>
  );
}

const renderer = await createCliRenderer();
const root = createRoot(renderer);

try {
  const snapshots = await loadSleepSnapshots();
  root.render(snapshots.length ? <SleepDashboard snapshots={snapshots} /> : <ErrorView message="No valid sleep snapshots found." />);
} catch (error) {
  root.render(<ErrorView message={error instanceof Error ? error.message : String(error)} />);
}
