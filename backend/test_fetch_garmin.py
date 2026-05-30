import datetime as dt
import json
import os
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import fetch_garmin


class FetchGarminTests(unittest.TestCase):
    def test_daterange_ends_on_target_date(self) -> None:
        end = dt.date(2026, 5, 30)

        self.assertEqual(
            fetch_garmin.daterange(end, 3),
            [dt.date(2026, 5, 28), dt.date(2026, 5, 29), dt.date(2026, 5, 30)],
        )

    def test_read_cache_respects_ttl(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            cache_file = Path(temp_dir) / "garmin_2026-05-30.json"
            cache_file.write_text(json.dumps({"date": "2026-05-30"}))

            self.assertEqual(fetch_garmin.read_cache(cache_file, 60), {"date": "2026-05-30"})

            old_time = (dt.datetime.now(tz=dt.timezone.utc) - dt.timedelta(minutes=90)).timestamp()
            os.utime(cache_file, (old_time, old_time))

            self.assertIsNone(fetch_garmin.read_cache(cache_file, 60))

    def test_parse_cache_ttl_rejects_invalid_values(self) -> None:
        self.assertEqual(fetch_garmin.parse_cache_ttl("0"), 0)
        self.assertEqual(fetch_garmin.parse_cache_ttl("60"), 60)

        with self.assertRaises(ValueError):
            fetch_garmin.parse_cache_ttl("abc")

        with self.assertRaises(ValueError):
            fetch_garmin.parse_cache_ttl("-1")

    def test_summary_shape_excludes_account_data(self) -> None:
        cache_file = Path("/tmp/garmin_2026-05-30.json")
        payload = {
            "date": "2026-05-30",
            "summary": {"displayName": "Private User", "email": "person@example.com"},
            "activities": [{"activityName": "Run"}],
            "sleep": {"dailySleepDTO": {"sleepTimeSeconds": 28800}},
        }

        summary = fetch_garmin.summarize_payload(payload, cache_file, "cache")

        self.assertEqual(summary["date"], "2026-05-30")
        self.assertEqual(summary["status"], "cache")
        self.assertTrue(summary["has_sleep"])
        self.assertEqual(summary["activity_count"], 1)
        self.assertEqual(summary["cache_path"], str(cache_file))
        self.assertNotIn("summary", summary)
        self.assertNotIn("email", json.dumps(summary))


if __name__ == "__main__":
    unittest.main()
