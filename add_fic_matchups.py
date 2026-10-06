"""Attach Fantasy Info Central batter-vs-pitcher context for roster and free-agent hitters.

Conservative rules:
- factual BvP context only; no fabricated start/sit calls;
- fewer than 5 PA is insufficient sample, matching FIC guidance;
- future pages are requested only for today through the next 14 days;
- source failures do not block the core Fantrax refresh.
"""
from __future__ import annotations

import argparse
import html
import json
import re
import urllib.request
from datetime import datetime, timedelta, timezone
from html.parser import HTMLParser
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo

BASE_URL = "https://www.fantasyinfocentral.com/mlb/daily-matchups?date={date}"
USER_AGENT = "FantasyGM2027/1.0 (+personal fantasy-baseball research)"
ARIZONA = ZoneInfo("America/Phoenix")


class _TableParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.tables: list[list[list[str]]] = []
        self._table: list[list[str]] | None = None
        self._row: list[str] | None = None
        self._cell: list[str] | None = None

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag == "table":
            self._table = []
        elif self._table is not None and tag == "tr":
            self._row = []
        elif self._row is not None and tag in {"th", "td"}:
            self._cell = []

    def handle_data(self, data: str) -> None:
        if self._cell is not None:
            text = " ".join(data.split())
            if text:
                self._cell.append(text)

    def handle_endtag(self, tag: str) -> None:
        if tag in {"th", "td"} and self._cell is not None and self._row is not None:
            self._row.append(" ".join(self._cell).strip())
            self._cell = None
        elif tag == "tr" and self._row is not None and self._table is not None:
            if any(self._row):
                self._table.append(self._row)
            self._row = None
        elif tag == "table" and self._table is not None:
            if self._table:
                self.tables.append(self._table)
            self._table = None


def _norm(value: str) -> str:
    value = html.unescape(value or "").lower()
    value = re.sub(r"\b(jr|sr|ii|iii|iv)\b\.?", "", value)
    return re.sub(r"[^a-z0-9]", "", value)


def _abbr_key(full_name: str) -> str:
    parts = [p for p in re.split(r"\s+", full_name.strip()) if p]
    if len(parts) < 2:
        return _norm(full_name)
    return _norm(parts[0][0] + parts[-1])


def _abbr_from_cell(text: str) -> str | None:
    m = re.match(r"\s*([A-Za-z])\.\s+([^,(]+)", text or "")
    if not m:
        return None
    return _norm(m.group(1) + m.group(2).strip())


def _num(text: str) -> float | None:
    text = (text or "").strip().replace("%", "")
    if not text or text in {"---", "--", "n/a", "N/A"}:
        return None
    try:
        return float(text)
    except ValueError:
        return None


def _int(text: str) -> int | None:
    value = _num(text)
    return int(value) if value is not None else None


def _find_matchup_table(source: str) -> list[list[str]]:
    parser = _TableParser()
    parser.feed(source)
    for table in parser.tables:
        if not table:
            continue
        headers = [c.strip() for c in table[0]]
        lowered = {h.lower() for h in headers}
        if "batter" in lowered and "pitcher" in lowered and "ops" in lowered and "ab" in lowered:
            return table
    return []


def parse_fic_html(source: str) -> list[dict[str, Any]]:
    table = _find_matchup_table(source)
    if len(table) < 2:
        return []
    headers = [h.strip() for h in table[0]]
    rows: list[dict[str, Any]] = []
    for cells in table[1:]:
        if len(cells) < len(headers):
            cells = cells + [""] * (len(headers) - len(cells))
        row = {headers[i]: cells[i] for i in range(min(len(headers), len(cells)))}
        batter_key = _abbr_from_cell(row.get("Batter", ""))
        pitcher_key = _abbr_from_cell(row.get("Pitcher", ""))
        if not batter_key:
            continue
        ab = _int(row.get("AB", ""))
        bb = _int(row.get("BB", ""))
        pa_proxy = (ab or 0) + (bb or 0)
        rows.append({
            "batter_key": batter_key,
            "pitcher_key": pitcher_key,
            "pitcher": row.get("Pitcher") or None,
            "qAB_pct": _num(row.get("qAB", "")),
            "hard_hit_pct": _num(row.get("HH%", "")),
            "ab": ab,
            "h": _int(row.get("H", "")),
            "hr": _int(row.get("HR", "")),
            "bb": bb,
            "ba": _num(row.get("BA", "")),
            "obp": _num(row.get("OBP", "")),
            "ops": _num(row.get("OPS", "")),
            "sample_pa_proxy": pa_proxy,
            "sample_ok": pa_proxy >= 5,
        })
    return rows


def _fetch_day(day: str) -> str:
    request = urllib.request.Request(BASE_URL.format(date=day), headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=20) as response:  # noqa: S310 - fixed trusted host
        return response.read().decode("utf-8", errors="replace")


def _positions(value: Any) -> set[str]:
    return {p.strip().upper() for p in re.split(r"[/,|]", str(value or "")) if p.strip()}


def _is_hitter(value: Any) -> bool:
    return not (_positions(value) & {"P", "SP", "RP"})


def _is_free_agent(value: Any) -> bool:
    text = str(value or "").strip().lower()
    return text == "fa" or "free" in text


def _target_hitters(snapshot: dict[str, Any]) -> list[tuple[str, str]]:
    """Return (Fantrax ID, name) pairs for Rats hitters and free-agent hitters.

    Fantrax ID is the canonical league-side identity. Name is retained only for
    matching FIC's abbreviated display names. Duplicate/ambiguous FIC name keys
    are rejected later instead of being guessed.
    """
    teams = snapshot.get("teams") or []
    rats = next((t for t in teams if str(t.get("Team", "")).strip().lower() == "desert rats"), None)
    team_id = rats.get("Team ID") if rats else None
    targets: list[tuple[str, str]] = []
    for player in snapshot.get("pool") or []:
        if not _is_hitter(player.get("positions")):
            continue
        is_rat = team_id is not None and player.get("teamId") == team_id
        if not is_rat and not _is_free_agent(player.get("availability")):
            continue
        fantrax_id = str(player.get("fantraxId") or "").strip()
        name = str(player.get("name") or "").strip()
        if fantrax_id and name and name != "Name unavailable":
            targets.append((fantrax_id, name))
    return targets


def _lookahead_days(snapshot: dict[str, Any]) -> list[str]:
    candidates: set[str] = set()
    current = snapshot.get("weekly_schedule") or {}
    candidates.update(d for d in current.get("days") or [] if isinstance(d, str))
    for week in (snapshot.get("fa_lookahead") or {}).get("weeks") or []:
        candidates.update(d for d in week.get("days") or [] if isinstance(d, str))

    today = datetime.now(ARIZONA).date()
    end = today + timedelta(days=14)
    return sorted(d for d in candidates if today.isoformat() <= d <= end.isoformat())


def attach(snapshot: dict[str, Any]) -> dict[str, Any]:
    hitters = _target_hitters(snapshot)
    days = _lookahead_days(snapshot)

    key_to_targets: dict[str, list[tuple[str, str]]] = {}
    for fantrax_id, name in hitters:
        key_to_targets.setdefault(_abbr_key(name), []).append((fantrax_id, name))

    result: dict[str, Any] = {
        "source": "Fantasy Info Central daily matchups",
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        "url_template": BASE_URL,
        "status": "verified",
        "sample_rule": "sample_ok when AB + BB >= 5; factual BvP context only",
        "identity_rule": "Fantrax ID is canonical; ambiguous FIC abbreviated-name matches are rejected",
        "fantrax_ids_by_name": {},
        "players": {},
        "days": {},
    }

    for day in days:
        try:
            rows = parse_fic_html(_fetch_day(day))
        except Exception as exc:
            result["days"][day] = {"status": "unavailable", "reason": type(exc).__name__}
            continue

        matched = 0
        ambiguous = 0
        for row in rows:
            targets = key_to_targets.get(row["batter_key"], [])
            if len(targets) != 1:
                if targets:
                    ambiguous += 1
                continue
            fantrax_id, name = targets[0]
            result["fantrax_ids_by_name"][name] = fantrax_id
            result["players"].setdefault(name, {})[day] = {k: v for k, v in row.items() if k != "batter_key"}
            matched += 1
        result["days"][day] = {
            "status": "verified",
            "matched_target_hitters": matched,
            "ambiguous_target_matches": ambiguous,
        }

    if not any(v.get("status") == "verified" for v in result["days"].values()):
        result["status"] = "unavailable"
    snapshot["fic_matchups"] = result
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
    status = data["fic_matchups"]["status"]
    print(f"FIC roster/free-agent matchup context: {status}")


if __name__ == "__main__":
    main()
