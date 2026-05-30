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

export type CacheWarningReason = "invalid_json" | "missing_sleep" | "missing_date" | "zero_sleep" | "read_error";

export type CacheWarning = {
  fileName: string;
  reason: CacheWarningReason;
  message: string;
};

export type SleepDataResult = {
  snapshots: SleepSnapshot[];
  warnings: CacheWarning[];
};

type LoadSleepDataOptions = {
  cacheDir?: string;
};

function extractHrv(data: GarminCache): number | undefined {
  if (typeof data.sleep?.avgOvernightHrv === "number") return data.sleep.avgOvernightHrv;
  const values = (data.sleep?.hrvData ?? []).map((x) => x.value).filter((v): v is number => typeof v === "number");
  if (!values.length) return undefined;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function warning(fileName: string, reason: CacheWarningReason, message: string): CacheWarning {
  return { fileName, reason, message };
}

export async function loadSleepData(options: LoadSleepDataOptions = {}): Promise<SleepDataResult> {
  const cacheDir = options.cacheDir ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../backend/cache");
  let entries;
  try {
    entries = await fs.readdir(cacheDir, { withFileTypes: true });
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") return { snapshots: [], warnings: [] };
    return {
      snapshots: [],
      warnings: [warning(path.basename(cacheDir), "read_error", `Could not read cache directory: ${cacheDir}`)],
    };
  }

  const files = entries
    .filter((e) => e.isFile() && e.name.startsWith("garmin_") && e.name.endsWith(".json"))
    .map((e) => path.join(cacheDir, e.name));

  const snapshots: SleepSnapshot[] = [];
  const warnings: CacheWarning[] = [];

  for (const file of files) {
    const fileName = path.basename(file);
    try {
      const raw = await fs.readFile(file, "utf8");
      let data: GarminCache;
      try {
        data = JSON.parse(raw) as GarminCache;
      } catch {
        warnings.push(warning(fileName, "invalid_json", "Skipped invalid JSON cache file."));
        continue;
      }

      const sleep = data.sleep?.dailySleepDTO;
      const cacheDate = data.date ?? sleep?.calendarDate;

      if (!sleep) {
        warnings.push(warning(fileName, "missing_sleep", "Skipped cache file without daily sleep data."));
        continue;
      }

      if (!cacheDate) {
        warnings.push(warning(fileName, "missing_date", "Skipped cache file without a date."));
        continue;
      }

      if (!sleep.sleepTimeSeconds || sleep.sleepTimeSeconds <= 0) {
        warnings.push(warning(fileName, "zero_sleep", "Skipped cache file with no recorded sleep time."));
        continue;
      }

      snapshots.push({
        sourceName: fileName,
        cacheDate,
        fetchedAt: data.fetched_at,
        sleep,
        summary: data.summary,
        hrv: extractHrv(data),
        hrvStatus: data.sleep?.hrvStatus,
        activities: data.activities ?? [],
      });
    } catch {
      warnings.push(warning(fileName, "read_error", "Skipped unreadable cache file."));
    }
  }

  snapshots.sort((a, b) => a.cacheDate.localeCompare(b.cacheDate));
  return { snapshots, warnings };
}
