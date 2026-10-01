"""Attach freshness-gated RotoBaller pitcher and hitter chart ratings."""
from __future__ import annotations

import argparse
import html
import json
import re
import urllib.parse
import urllib.request
from datetime import date
from pathlib import Path
from typing import Any
from rotoballer_ratings import parse_ratings, sheet_csv_url, merge_ratings

BASE = "https://www.rotoballer.com"
INDEX_URL = BASE + "/fantasy-baseball"
UA = "FantasyGM2027/1.0 (+personal fantasy-baseball research)"

ARTICLE_RE = re.compile(
    r'href=["\'](?P<url>https?://www\.rotoballer\.com/(?P<slug>start-sit-(?P<kind>pitchers|hitters)-fantasy-baseball-matchups-for-[^"\']+))["\']',
    re.I,
)
WEEK_RE = re.compile(r"(?:September|August|July|June|May|April|March)\s+(\d{1,2})\s*-\s*(?:September|August|July|June|May|April|March)?\s*(\d{1,2})", re.I)
DATE_SLUG_RE = re.compile(r"for-(\d{1,2})-(\d{1,2})-(\d{1,2})-(\d{1,2})-(\d{4})")
IFRAME_RE = re.compile(r'<iframe[^>]+src=["\']([^"\']+docs\.google\.com/spreadsheets/[^"\']+)["\']', re.I)


def _fetch(url: str) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=20) as r:  # noqa: S310 fixed trusted host
        return r.read().decode("utf-8", errors="replace")


def _week_from_slug(url: str) -> tuple[str, str] | None:
    m = DATE_SLUG_RE.search(url)
    if not m:
        return None
    sm, sd, em, ed, year = map(int, m.groups())
    try:
        start = date(year, sm, sd).isoformat()
        end = date(year, em, ed).isoformat()
    except ValueError:
        return None
    return start, end


def discover(index_html: str, expected_start=None, expected_end=None) -> dict[str, str]:
    out: dict[str, str] = {}
    for m in ARTICLE_RE.finditer(index_html):
        kind = m.group("kind").lower()
        url = html.unescape(m.group("url"))
        if kind not in out or _week_from_slug(url) == (expected_start, expected_end):
            out[kind] = url
    return out


def inspect_article(url: str, expected_start: str, expected_end: str) -> dict[str, Any]:
    period = _week_from_slug(url)
    if period != (expected_start, expected_end):
        return {"status": "stale", "url": url, "week_start": period[0] if period else None, "week_end": period[1] if period else None}
    source = _fetch(url)
    kind = 'pitchers' if '/start-sit-pitchers-' in url else 'hitters'
    rows = parse_ratings(source, kind, expected_start, expected_end)
    sheets = []
    # Both iframe sources and the article's separate-page links are published charts.
    for raw in re.findall(r'(?:src|href)=["\']([^"\']+)["\']', source, re.I):
        csv_url = sheet_csv_url(html.unescape(raw))
        if csv_url and csv_url not in sheets:
            sheets.append(csv_url)
    errors = []
    for sheet in sheets[:4]:
        try:
            rows.extend(parse_ratings(_fetch(sheet), kind, expected_start, expected_end))
        except Exception as exc:
            errors.append(type(exc).__name__)
    rows = merge_ratings(rows)
    verified = any(row.get('status') == 'verified' for row in rows)
    return {
        "status": "verified" if verified else "unavailable",
        "url": url,
        "week_start": expected_start,
        "week_end": expected_end,
        "published_sheets": sheets[:4],
        "ratings": rows,
        "reason": None if verified else "NOT VERIFIED: no unambiguous current-week chart ratings",
        "fetch_errors": errors,
    }


def attach(snapshot: dict[str, Any]) -> dict[str, Any]:
    schedule = snapshot.get("weekly_schedule") or {}
    week_start = schedule.get("week_start")
    week_end = schedule.get("week_end")
    result: dict[str, Any] = {
        "source": "RotoBaller weekly Start/Sit",
        "status": "unavailable",
        "week_start": week_start,
        "week_end": week_end,
        "pitchers": {"status": "unavailable"},
        "hitters": {"status": "unavailable"},
    }
    if not week_start or not week_end:
        result["reason"] = "verified weekly schedule missing"
        snapshot["rotoballer_weekly"] = result
        return snapshot

    try:
        links = discover(_fetch(INDEX_URL), week_start, week_end)
    except Exception as exc:
        result["reason"] = f"index fetch failed: {type(exc).__name__}"
        snapshot["rotoballer_weekly"] = result
        return snapshot

    for kind in ("pitchers", "hitters"):
        url = links.get(kind)
        if not url:
            result[kind] = {"status": "unavailable", "reason": "current article not discovered"}
            continue
        try:
            result[kind] = inspect_article(url, week_start, week_end)
        except Exception as exc:
            result[kind] = {"status": "unavailable", "url": url, "reason": type(exc).__name__}

    if any(result[k].get("status") == "verified" for k in ("pitchers", "hitters")):
        result["status"] = "verified"
    else:
        result["reason"] = "no current-week RotoBaller article; stale advice suppressed"
    snapshot["rotoballer_weekly"] = result
    return snapshot


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--snapshot", type=Path, default=Path("public/fantasygm.json"))
    args = parser.parse_args()
    data = json.loads(args.snapshot.read_text(encoding="utf-8"))
    attach(data)
    tmp = args.snapshot.with_suffix(".tmp")
    tmp.write_text(json.dumps(data, ensure_ascii=False, allow_nan=False) + "\n", encoding="utf-8")
    tmp.replace(args.snapshot)
    rb = data["rotoballer_weekly"]
    print(f"RotoBaller weekly ratings: {rb['status']} ({rb.get('reason','current source found')})")


if __name__ == "__main__":
    main()
