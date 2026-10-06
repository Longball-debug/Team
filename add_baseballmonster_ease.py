"""Attach Baseball Monster opponent Ease Rankings to the public snapshot.

The public Ease Rankings page states that higher Ease Value means an easier opponent.
This collector stores the published hitter/pitcher opponent values and derives ordinal ranks
(1 = easiest, 30 = toughest). Source failures are explicit and never fabricated.
"""
from __future__ import annotations

import argparse
import json
import re
import urllib.request
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from typing import Any

URL = "https://baseballmonster.com/easerankings.aspx"
USER_AGENT = "FantasyGM2027/1.0 (+personal fantasy-baseball research)"

ALIASES = {
    "AZ": "ARI", "ARI": "ARI",
    "CWS": "CHW", "CHW": "CHW",
    "KC": "KCR", "KCR": "KCR",
    "OAK": "ATH", "ATH": "ATH",
    "SD": "SDP", "SDP": "SDP",
    "SF": "SFG", "SFG": "SFG",
    "TB": "TBR", "TBR": "TBR",
    "WAS": "WSN", "WSN": "WSN",
}


class _Parser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.tables: list[tuple[str | None, list[list[str]]]] = []
        self.context: str | None = None
        self._table: list[list[str]] | None = None
        self._row: list[str] | None = None
        self._cell: list[str] | None = None
        self._heading: list[str] | None = None

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag in {"h1", "h2", "h3", "h4", "h5", "h6"}:
            self._heading = []
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
        if self._heading is not None:
            self._heading.append(text)
        if self._cell is not None:
            self._cell.append(text)
        if "Easiest for hitters to play against" in text:
            self.context = "hitters"
        elif "Easiest for pitchers to play against" in text:
            self.context = "pitchers"

    def handle_endtag(self, tag: str) -> None:
        if tag in {"h1", "h2", "h3", "h4", "h5", "h6"} and self._heading is not None:
            text = " ".join(self._heading)
            if "Easiest for hitters to play against" in text:
                self.context = "hitters"
            elif "Easiest for pitchers to play against" in text:
                self.context = "pitchers"
            self._heading = None
        elif tag in {"th", "td"} and self._cell is not None and self._row is not None:
            self._row.append(" ".join(self._cell))
            self._cell = None
        elif tag == "tr" and self._row is not None and self._table is not None:
            if any(self._row):
                self._table.append(self._row)
            self._row = None
        elif tag == "table" and self._table is not None:
            if self._table:
                self.tables.append((self.context, self._table))
            self._table = None


def _team(value: str) -> str | None:
    text = re.sub(r"^\s*vs\s+", "", value or "", flags=re.I).strip().upper()
    if not re.fullmatch(r"[A-Z]{2,3}", text):
        return None
    return ALIASES.get(text, text)


def _float(value: str) -> float | None:
    try:
        return float((value or "").strip())
    except ValueError:
        return None


def _int(value: str) -> int | None:
    try:
        return int(float((value or "").strip()))
    except ValueError:
        return None


def parse_html(source: str) -> dict[str, dict[str, dict[str, float | int]]]:
    parser = _Parser()
    parser.feed(source)
    candidates: list[tuple[str | None, dict[str, dict[str, float | int]]]] = []

    for context, table in parser.tables:
        if len(table) < 25:
            continue
        header = [c.strip().lower() for c in table[0]]
        try:
            team_idx = next(i for i, h in enumerate(header) if h in {"team", "vs team"} or "team" == h.replace("vs ", ""))
            games_idx = header.index("g")
            value_idx = header.index("value")
        except (StopIteration, ValueError):
            continue

        rows: dict[str, dict[str, float | int]] = {}
        for cells in table[1:]:
            if max(team_idx, games_idx, value_idx) >= len(cells):
                continue
            team = _team(cells[team_idx])
            games = _int(cells[games_idx])
            value = _float(cells[value_idx])
            if team and games is not None and value is not None:
                rows[team] = {"games": games, "value": value}
        if len(rows) >= 28:
            candidates.append((context, rows))

    out: dict[str, dict[str, dict[str, float | int]]] = {}
    for context, rows in candidates:
        if context in {"hitters", "pitchers"} and context not in out:
            out[context] = rows

    # Fallback to page order when headings are not semantically attached to tables.
    if "hitters" not in out and candidates:
        out["hitters"] = candidates[0][1]
    if "pitchers" not in out and len(candidates) > 1:
        out["pitchers"] = candidates[1][1]

    for kind in ("hitters", "pitchers"):
        rows = out.get(kind)
        if not rows or len(rows) < 28:
            continue
        ordered = sorted(rows.items(), key=lambda item: (-float(item[1]["value"]), item[0]))
        for rank, (team, _) in enumerate(ordered, 1):
            rows[team]["rank"] = rank
    return out


def _fetch() -> str:
    req = urllib.request.Request(URL, headers={"User-Agent": USER_AGENT, "Accept": "text/html"})
    with urllib.request.urlopen(req, timeout=25) as response:  # noqa: S310 fixed trusted host
        if response.status != 200:
            raise RuntimeError(f"HTTP {response.status}")
        return response.read().decode("utf-8", errors="replace")


def attach(snapshot: dict[str, Any]) -> dict[str, Any]:
    result: dict[str, Any] = {
        "source": "Baseball Monster Ease Rankings",
        "source_url": URL,
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        "status": "unavailable",
        "definition": "Higher Ease Value means an easier opponent.",
        "hitters": {},
        "pitchers": {},
    }
    try:
        parsed = parse_html(_fetch())
        hitters = parsed.get("hitters") or {}
        pitchers = parsed.get("pitchers") or {}
        if len(hitters) < 28 or len(pitchers) < 28:
            raise ValueError("Incomplete Ease Rankings tables")
        result["hitters"] = hitters
        result["pitchers"] = pitchers
        result["status"] = "verified"
    except Exception as exc:
        result["reason"] = type(exc).__name__
    snapshot["baseball_monster_ease"] = result
    return snapshot


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--snapshot", type=Path, default=Path("public/fantasygm.json"))
    args = ap.parse_args()
    data = json.loads(args.snapshot.read_text(encoding="utf-8"))
    attach(data)
    tmp = args.snapshot.with_suffix(".tmp")
    tmp.write_text(json.dumps(data, ensure_ascii=False, allow_nan=False) + "\n", encoding="utf-8")
    tmp.replace(args.snapshot)
    print(f"Baseball Monster Ease Rankings: {data['baseball_monster_ease']['status']}")


if __name__ == "__main__":
    main()
