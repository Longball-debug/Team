"""Attach current-week RotoBaller Start/Sit source metadata.

This collector is deliberately freshness-gated. It discovers the latest public
RotoBaller hitter/pitcher Start/Sit articles, extracts their advertised week,
and attaches them only when that week matches the verified MLB schedule in the
FantasyGM snapshot. Stale articles are never surfaced as current advice.

The rating-table parser will consume the article's published sheet in the next
layer; this step establishes reliable current-week source discovery first.
"""
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


def discover(index_html: str) -> dict[str, str]:
    out: dict[str, str] = {}
    for m in ARTICLE_RE.finditer(index_html):
        kind = m.group("kind").lower()
        out.setdefault(kind, html.unescape(m.group("url")))
    return out


def inspect_article(url: str, expected_start: str, expected_end: str) -> dict[str, Any]:
    period = _week_from_slug(url)
    if period != (expected_start, expected_end):
        return {"status": "stale", "url": url, "week_start": period[0] if period else None, "week_end": period[1] if period else None}
    source = _fetch(url)
    iframe = IFRAME_RE.search(source)
    return {
        "status": "verified",
        "url": url,
        "week_start": expected_start,
        "week_end": expected_end,
        "published_sheet": html.unescape(iframe.group(1)) if iframe else None,
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
        links = discover(_fetch(INDEX_URL))
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
    print(f"RotoBaller weekly source: {rb['status']} ({rb.get('reason','current source found')})")


if __name__ == "__main__":
    main()
