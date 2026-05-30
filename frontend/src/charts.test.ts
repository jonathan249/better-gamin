import { describe, expect, test } from "bun:test";
import { buildRows } from "./charts";

describe("buildRows", () => {
  test("respects requested chart width", () => {
    const rows = buildRows(
      [
        { date: "2026-05-01", value: 70 },
        { date: "2026-05-02", value: 80 },
      ],
      50,
      100,
      "2026-05-02",
      false,
      40,
      8,
    );

    expect(rows[0]?.length).toBe(44);
    expect(rows.at(-2)?.length).toBe(44);
  });
});
