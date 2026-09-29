"""Attach public Pitcher List SP streamer tiers to the FantasyGM weekly snapshot.

Only public article tables are collected. Missing or ambiguous rows stay unverified.
"""
from __future__ import annotations

import argparse
import html
import json
import re
import urllib.request
from html.parser import HTMLParser
from pathlib import Path
from typing import Any

ARCHIVE_URL = "https://pitcherlist.com/category/fantasy/starting-pitchers/"
USER_AGENT = "FantasyGM2027/1.0 (+personal fantasy-baseball research)"


def _norm(value: str) -> str:
    value = html.unescape(value or "").lower()
    value = re.sub(r"\([^)]*\)", "", value)
    value = re.sub(r"\b(jr|sr|ii|iii|iv)\b\.?", "", value)
    return re.sub(r"[^a-z0-9]", "", value)


class ArchiveParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.links: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag != "a":
            return
        href = dict(attrs).get("href") or ""
        if href.startswith("https://pitcherlist.com/") and "starting-pitcher-streamer" in href:
            href = href.split("?")[0]
            if href not in self.links:
                self.links.append(href)


class ArticleParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.heading: str | None = None
        self._heading_buf: list[str] | None = None
        self._table: list[list[str]] | None = None
        self._row: list[str] | None = None
        self._cell: list[str] | None = None
        self.tables: list[tuple[str | None, list[list[str]]]] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag in {"h2", "h3", "h4"}:
            self._heading_buf = []
        elif tag == "table":
            self._table = []
        elif self._table is not None and tag == "tr":
            self._row = []
        elif self._row is not None and tag in {"th", "td"}:
            self._cell = []

    def handle_data(self, data: str) -> None:
        text = " ".join(data.split())
        if not text:
            return
        if self._heading_buf is not None:
            self._heading_buf.append(text)
        if self._cell is not None:
            self._cell.append(text)

    def handle_endtag(self, tag: str) -> None:
        if tag in {"h2", "h3", "h4"} and self._heading_buf is not None:
            text = " ".join(self._heading_buf).strip()
            if text:
                self.heading = text
            self._heading_buf = None
        elif tag in {"th", "td"} and self._cell is not None and self._row is not None:
            self._row.append(" ".join(self._cell).strip())
            self._cell = None
        elif tag == "tr" and self._row is not None and self._table is not None:
            if any(self._row):
                self._table.append(self._row)
            self._row = None
        elif tag == "table" and self._table is not None:
            if self._table:
                self.tables.append((self.heading, self._table))
            self._table = None


def _fetch(url: str) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=20) as response:  # noqa: S310 fixed trusted host
        return response.read().decode("utf-8", errors="replace")


def _heading_date(heading: str | None, season: int) -> str | None:
    m = re.search(r"\b(\d{1,2})/(\d{1,2})\b", heading or "")
    if not m:
        return None
    month, day = map(int, m.groups())
    try:
        return f"{season:04d}-{month:02d}-{day:02d}"
    except ValueError:
        return None


def parse_article(source: str, season: int, url: str) -> list[dict[str, Any]]:
    parser = ArticleParser()
    parser.feed(source)
    out: list[dict[str, Any]] = []
    for heading, table in parser.tables:
        if len(table) < 2:
            continue
        headers = [c.strip().lower() for c in table[0]]
        if "pitcher" not in headers or "matchup" not in headers or "rank" not in headers:
            continue
        day = _heading_date(heading, season)
        if not day:
            continue
        ix = {name: headers.index(name) for name in ("rank", "pitcher", "matchup")}
        tier = None
        for cells in table[1:]:
            padded = cells + [""] * max(0, len(headers) - len(cells))
            rank_text = padded[ix["rank"]].strip()
            pitcher = padded[ix["pitcher"]].strip()
            matchup = padded[ix["matchup"]].strip()
            joined = " ".join(padded).strip()
            lowered = joined.lower()
            for label in ("auto start", "probably start", "questionable start", "do not start"):
                if label in lowered and not re.search(r"\d", rank_text):
                    tier = label.title()
            m = re.search(r"\d+", rank_text)
            if not m or not pitcher or not matchup:
                continue
            out.append({
                "date": day,
                "rank": int(m.group()),
                "pitcher": pitcher,
                "pitcher_key": _norm(pitcher),
                "matchup": matchup,
                "tier": tier or "Unverified Tier",
                "source_url": url,
            })
    return out


def attach(snapshot: dict[str, Any]) -> dict[str, Any]:
    days = list((snapshot.get("weekly_schedule") or {}).get("days") or [])
    season = int(days[0][:4]) if days else 2026
    result: dict[str, Any] = {
        "source": "Pitcher List public SP Streamer rankings",
        "archive_url": ARCHIVE_URL,
        "status": "unavailable",
        "days": {day: [] for day in days},
    }
    try:
        archive = ArchiveParser()
        archive.feed(_fetch(ARCHIVE_URL))
        rows: list[dict[str, Any]] = []
        for url in archive.links[:12]:
            try:
                rows.extend(parse_article(_fetch(url), season, url))
            except Exception:
                continue
        seen: set[tuple[str, str, str]] = set()
        for row in rows:
            day = row["date"]
            if day not in result["days"]:
                continue
            key = (day, row["pitcher_key"], row["matchup"])
            if key in seen:
                continue
            seen.add(key)
            result["days"][day].append({k: v for k, v in row.items() if k != "date"})
        if any(result["days"].values()):
            result["status"] = "verified"
    except Exception as exc:
        result["reason"] = type(exc).__name__
    snapshot["pitcher_list"] = result
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
    print(f"Pitcher List weekly context: {data['pitcher_list']['status']}")


if __name__ == "__main__":
    main()
