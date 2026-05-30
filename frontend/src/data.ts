import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export type SleepDTO = {
  calendarDate?: string;
  sleepTimeSeconds?: number;
  deepSleepSeconds?: number;
  lightSleepSeconds?: number;
  remSleepSeconds?: number;
  awakeSleepSeconds?: number;
  sleepStartTimestampLocal?: number;
  sleepEndTimestampLocal?: number;
};

export type Activity = {
  activityName?: string;
  activityType?: { typeKey?: string };
  distance?: number;
  duration?: number;
  averageHR?: number;
  startTimeLocal?: string;
};

type GarminCache = {
  fetched_at?: string;
  date?: string;
  summary?: {
    bodyBatteryMostRecentValue?: number;
    averageStressLevel?: number;
    restingHeartRate?: number;
  };
  sleep?: {
    dailySleepDTO?: SleepDTO;
    avgOvernightHrv?: number;
    hrvStatus?: string;
    hrvData?: Array<{ value?: number; startGMT?: number }>;
  };
  activities?: Activity[];
};

export type SleepSnapshot = {
  sourceName: string;
  cacheDate: string;
  fetchedAt?: string;
  sleep: SleepDTO;
  summary?: GarminCache["summary"];
  hrv?: number;
  hrvStatus?: string;
  activities: Activity[];
};

function extractHrv(data: GarminCache): number | undefined {
  if (typeof data.sleep?.avgOvernightHrv === "number") return data.sleep.avgOvernightHrv;
  const values = (data.sleep?.hrvData ?? []).map((x) => x.value).filter((v): v is number => typeof v === "number");
  if (!values.length) return undefined;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export async function loadSleepSnapshots(): Promise<SleepSnapshot[]> {
  const cacheDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../backend/cache");
  const entries = await fs.readdir(cacheDir, { withFileTypes: true });
  const files = entries
    .filter((e) => e.isFile() && e.name.startsWith("garmin_") && e.name.endsWith(".json"))
    .map((e) => path.join(cacheDir, e.name));

  const snapshots: SleepSnapshot[] = [];

  for (const file of files) {
    try {
      const raw = await fs.readFile(file, "utf8");
      const data = JSON.parse(raw) as GarminCache;
      const sleep = data.sleep?.dailySleepDTO;
      const cacheDate = data.date ?? sleep?.calendarDate;

      if (!sleep || !cacheDate) continue;
      if (!sleep.sleepTimeSeconds || sleep.sleepTimeSeconds <= 0) continue;

      snapshots.push({
        sourceName: path.basename(file),
        cacheDate,
        fetchedAt: data.fetched_at,
        sleep,
        summary: data.summary,
        hrv: extractHrv(data),
        hrvStatus: data.sleep?.hrvStatus,
        activities: data.activities ?? [],
      });
    } catch {
      // ignore malformed cache files
    }
  }

  snapshots.sort((a, b) => a.cacheDate.localeCompare(b.cacheDate));
  return snapshots;
}
