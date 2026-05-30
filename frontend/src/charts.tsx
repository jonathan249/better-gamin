import { TextAttributes } from "@opentui/core";

export type SleepScorePoint = { date: string; score: number };
export type HrvPoint = { date: string; hrv: number };
export type ChartMode = "week" | "month";

type NumericPoint = { date: string; value: number };

const DEFAULT_PLOT_WIDTH = 80;
const DEFAULT_PLOT_HEIGHT = 20;
const MIN_PLOT_WIDTH = 40;
const MIN_PLOT_HEIGHT = 8;

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function createGrid(width: number, height: number): string[][] {
  return Array.from({ length: height }, () => Array.from({ length: width }, () => " "));
}

function drawLine(grid: string[][], x0: number, y0: number, x1: number, y1: number): void {
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
  for (let i = 0; i <= steps; i++) {
    const x = Math.round(x0 + ((x1 - x0) * i) / steps);
    const y = Math.round(y0 + ((y1 - y0) * i) / steps);
    if (grid[y]?.[x] !== undefined && grid[y][x] === " ") grid[y][x] = "•";
  }
}

function yForValue(value: number, min: number, max: number, height: number): number {
  if (max <= min) return Math.floor(height / 2);
  const normalized = (value - min) / (max - min);
  return Math.round((1 - clamp(normalized, 0, 1)) * (height - 1));
}

export function buildRows(
  points: NumericPoint[],
  min: number,
  max: number,
  selectedDate?: string,
  showBaselines = true,
  width = DEFAULT_PLOT_WIDTH,
  height = DEFAULT_PLOT_HEIGHT,
): string[] {
  if (points.length < 2) return [];

  const plotWidth = Math.max(MIN_PLOT_WIDTH, Math.floor(width));
  const plotHeight = Math.max(MIN_PLOT_HEIGHT, Math.floor(height));
  const grid = createGrid(plotWidth, plotHeight);

  if (showBaselines) {
    const lines = [0.25, 0.5, 0.75].map((p) => Math.round((plotHeight - 1) * p));
    for (const y of lines) {
      for (let x = 0; x < plotWidth; x++) {
        if (grid[y]?.[x] === " ") grid[y][x] = "─";
      }
    }
  }

  const plot = points.map((p, i) => ({
    date: p.date,
    x: Math.round((i * (plotWidth - 1)) / (points.length - 1)),
    y: yForValue(p.value, min, max, plotHeight),
  }));

  const selectedIndex = points.findIndex((p) => p.date === selectedDate);
  const selectedX = selectedIndex >= 0 ? plot[selectedIndex]?.x : undefined;

  if (selectedX !== undefined) {
    for (let y = 0; y < plotHeight; y++) {
      if (grid[y]?.[selectedX] !== undefined && grid[y]![selectedX] === " ") grid[y]![selectedX] = "│";
    }
  }

  for (let i = 1; i < plot.length; i++) {
    drawLine(grid, plot[i - 1]!.x, plot[i - 1]!.y, plot[i]!.x, plot[i]!.y);
  }

  for (let i = 0; i < plot.length; i++) {
    const p = plot[i]!;
    grid[p.y]![p.x] = i === selectedIndex ? "◎" : "●";
  }

  const rows: string[] = [];
  for (let y = 0; y < plotHeight; y++) {
    const yVal = Math.round(max - ((max - min) * y) / (plotHeight - 1));
    rows.push(`${String(yVal).padStart(3, " ")}│${grid[y]!.join("")}`);
  }

  rows.push(`${String(min).padStart(3, " ")}└${"─".repeat(plotWidth)}`);

  const start = points[0]!.date.slice(5);
  const end = points[points.length - 1]!.date.slice(5);
  const spacing = Math.max(1, plotWidth - start.length - end.length + 1);
  rows.push(`   ${start}${" ".repeat(spacing)}${end}`);

  return rows;
}

function ChartShell({ title, subtitle, rows, footer }: { title: string; subtitle: string; rows: string[]; footer: string }) {
  return (
    <box flexShrink={0} style={{ border: true, borderStyle: "single", borderColor: "#3a3f4b", padding: 1 }}>
      <text attributes={TextAttributes.BOLD}>{title}</text>
      <text attributes={TextAttributes.DIM}>{subtitle}</text>
      {rows.length === 0 ? <text attributes={TextAttributes.DIM}>Need at least 2 points for chart.</text> : rows.map((r, i) => <text key={i}>{r}</text>)}
      <text attributes={TextAttributes.DIM}>{footer}</text>
    </box>
  );
}

export function SleepScoreChart({
  points,
  mode,
  selectedDate,
  width,
  height,
}: {
  points: SleepScorePoint[];
  mode: ChartMode;
  selectedDate?: string;
  width?: number;
  height?: number;
}) {
  const values = points.map((p) => p.score);
  const avg = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
  const latest = values.at(-1) ?? 0;
  const rows = buildRows(points.map((p) => ({ date: p.date, value: p.score })), 50, 100, selectedDate, false, width, height);

  return (
    <ChartShell
      title={`Sleep Estimate Trend (${mode === "week" ? "7d" : "30d"})`}
      subtitle="Y: score 50..100, X: date | w/m"
      rows={rows}
      footer={`Avg ${Math.round(avg)} | Latest ${Math.round(latest)} | N=${values.length} | ◎ selected day`}
    />
  );
}

export function HrvChart({
  points,
  mode,
  selectedDate,
  width,
  height,
}: {
  points: HrvPoint[];
  mode: ChartMode;
  selectedDate?: string;
  width?: number;
  height?: number;
}) {
  const values = points.map((p) => p.hrv);
  const avg = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
  const latest = values.at(-1) ?? 0;
  const min = values.length ? Math.floor(Math.min(...values) - 2) : 30;
  const max = values.length ? Math.ceil(Math.max(...values) + 2) : 60;
  const rows = buildRows(points.map((p) => ({ date: p.date, value: p.hrv })), min, max, selectedDate, true, width, height);

  return (
    <ChartShell
      title={`HRV Trend (${mode === "week" ? "7d" : "30d"})`}
      subtitle="Y: HRV ms, X: date | w/m"
      rows={rows}
      footer={`Avg ${Math.round(avg)} ms | Latest ${Math.round(latest)} ms | N=${values.length} | ◎ selected day`}
    />
  );
}
