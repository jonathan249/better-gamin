import argparse
import datetime as dt
import json
import os
from pathlib import Path

from dotenv import load_dotenv
from garminconnect import Garmin


def get_bool_env(name: str, default: bool = False) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def read_cache(cache_file: Path, ttl_minutes: int) -> dict | None:
    if not cache_file.exists():
        return None

    modified = dt.datetime.fromtimestamp(cache_file.stat().st_mtime, tz=dt.timezone.utc)
    age = dt.datetime.now(tz=dt.timezone.utc) - modified
    if age > dt.timedelta(minutes=ttl_minutes):
        return None

    try:
        return json.loads(cache_file.read_text())
    except Exception:
        return None


def write_cache(cache_file: Path, payload: dict) -> None:
    cache_file.parent.mkdir(parents=True, exist_ok=True)
    cache_file.write_text(json.dumps(payload, indent=2, default=str))


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Fetch Garmin data and cache by day")
    parser.add_argument("--date", help="Single date to fetch, format YYYY-MM-DD")
    parser.add_argument("--days", type=int, default=1, help="Fetch this many days ending today or --date")
    parser.add_argument("--refresh", action="store_true", help="Bypass cache TTL")
    return parser.parse_args()


def daterange(end_date: dt.date, days: int) -> list[dt.date]:
    days = max(1, days)
    start = end_date - dt.timedelta(days=days - 1)
    return [start + dt.timedelta(days=i) for i in range(days)]


def main() -> int:
    load_dotenv()
    args = parse_args()

    email = os.getenv("GARMIN_EMAIL")
    password = os.getenv("GARMIN_PASSWORD")
    is_cn = get_bool_env("GARMIN_IS_CN", False)
    cache_ttl_minutes = int(os.getenv("GARMIN_CACHE_TTL_MINUTES", "60"))

    if not email or not password:
        print("Missing GARMIN_EMAIL or GARMIN_PASSWORD in environment.")
        print("Copy .env.example to .env and fill in your credentials.")
        return 1

    target_date = dt.date.fromisoformat(args.date) if args.date else dt.date.today()
    dates = daterange(target_date, args.days)

    cache_dir = Path(__file__).resolve().parent / "cache"

    try:
        client = Garmin(email=email, password=password, is_cn=is_cn)
        client.login()

        outputs: list[dict] = []
        for day in dates:
            date_str = day.isoformat()
            cache_file = cache_dir / f"garmin_{date_str}.json"

            if not args.refresh:
                cached = read_cache(cache_file, cache_ttl_minutes)
                if cached is not None:
                    outputs.append(cached)
                    continue

            user_profile = client.get_user_summary(date_str)
            activities = client.get_activities_by_date(date_str, date_str)
            sleep = client.get_sleep_data(date_str)

            output = {
                "fetched_at": dt.datetime.now(tz=dt.timezone.utc).isoformat(),
                "date": date_str,
                "summary": user_profile,
                "activities": activities,
                "sleep": sleep,
            }
            write_cache(cache_file, output)
            outputs.append(output)

        print(json.dumps(outputs[-1] if len(outputs) == 1 else outputs, indent=2, default=str))
        return 0
    except Exception as exc:
        print(f"Garmin fetch failed: {exc}")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
