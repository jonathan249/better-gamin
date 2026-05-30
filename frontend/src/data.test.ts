import { afterEach, describe, expect, test } from "bun:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { loadSleepData } from "./data";

const tempDirs: string[] = [];

async function makeTempDir(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "better-garmin-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

describe("loadSleepData", () => {
  test("missing cache directory is an empty result", async () => {
    const result = await loadSleepData({ cacheDir: path.join(os.tmpdir(), "better-garmin-missing-cache") });

    expect(result.snapshots).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  test("loads valid cache files and warns for malformed ones", async () => {
    const dir = await makeTempDir();
    await fs.writeFile(path.join(dir, "garmin_2026-05-30.json"), "{nope");
    await fs.writeFile(
      path.join(dir, "garmin_2026-05-31.json"),
      JSON.stringify({
        date: "2026-05-31",
        sleep: { dailySleepDTO: { calendarDate: "2026-05-31", sleepTimeSeconds: 28800 } },
        activities: [{ activityName: "Run" }],
      }),
    );

    const result = await loadSleepData({ cacheDir: dir });

    expect(result.snapshots).toHaveLength(1);
    expect(result.snapshots[0]?.cacheDate).toBe("2026-05-31");
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]?.reason).toBe("invalid_json");
  });
});
