#!/usr/bin/env python3
"""Attach verified 2026 Baseball Savant Sprint Speed values to the shared snapshot."""
from __future__ import annotations

import argparse
import csv
import io
import json
import math
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

from add_statcast_exit_velocity import hitter_eligible, normalize_name

SEASON = 2026
BASE_URL = "https://baseballsavant.mlb.com/leaderboard/sprint_speed"
SOURCE_URL = BASE_URL + "?" + urllib.parse.urlencode({
    "type": "player", "min_season": SEASON, "max_season": SEASON,
    "position": "", "team": "", "min": 10, "csv": "true",
})
REQUIRED_COLUMNS = {"last_name, first_name", "player_id", "sprint_speed"}


def _speed(row: dict[str, str]) -> float | None:
    raw = (row.get("sprint_speed") or "").strip()
    if not raw:
        return None
    try:
        value = float(raw)
    except ValueError:
        raise ValueError(f"Invalid sprint_speed for Baseball Savant player {row.get('player_id')}") from None
    if not math.isfinite(value) or value < 15 or value > 40:
        raise ValueError(f"Out-of-range sprint_speed for Baseball Savant player {row.get('player_id')}")
    return value


def parse_sprint_speed_csv(text: str, minimum_records: int = 500) -> list[dict]:
    reader = csv.DictReader(io.StringIO(text))
    if not REQUIRED_COLUMNS <= set(reader.fieldnames or []):
        raise ValueError("Baseball Savant Sprint Speed CSV is missing required fields")

    records = []
    seen_ids = set()
    for row in reader:
        raw_name = (row.get("last_name, first_name") or "").strip()
        player_id = (row.get("player_id") or "").strip()
        if not raw_name or not player_id.isdigit() or player_id in seen_ids:
            raise ValueError("Invalid or duplicate Baseball Savant Sprint Speed identity")
        seen_ids.add(player_id)
        if "," in raw_name:
            last, first = (part.strip() for part in raw_name.split(",", 1))
            name = f"{first} {last}".strip()
        else:
            name = raw_name
        records.append({"savantId": player_id, "name": name, "sprintSpeed": _speed(row)})
    if len(records) < minimum_records:
        raise ValueError(f"Incomplete Baseball Savant Sprint Speed leaderboard: {len(records)} records")
    return records


def _stable_ids(player: dict) -> set[str]:
    values = [player.get(key) for key in ("mlbId", "mlbPlayerId", "mlb_id", "baseballSavantId", "savantId")]
    statcast = player.get("statcast2026")
    if isinstance(statcast, dict):
        values.append(statcast.get("savantId"))
    return {str(value) for value in values if value is not None and str(value).isdigit()}


def attach_sprint_speed(snapshot: dict, records: list[dict], fetched_at: str | None = None) -> dict:
    pool = snapshot.get("pool")
    if not isinstance(pool, list) or not pool:
        raise ValueError("FantasyGM player pool is unavailable")
    if any(not isinstance(player, dict) or not isinstance(player.get("fantraxId"), str) for player in pool):
        raise ValueError("FantasyGM player pool has invalid player identities")

    statcast_summary = snapshot.get("statcast2026")
    if not isinstance(statcast_summary, dict) or statcast_summary.get("source") != "Baseball Savant" or statcast_summary.get("season") != SEASON:
        raise ValueError("Validated Phase 1 Statcast snapshot is unavailable")

    by_id: dict[str, list[dict]] = {}
    by_name: dict[str, list[dict]] = {}
    for player in pool:
        if not hitter_eligible(player):
            continue
        for player_id in _stable_ids(player):
            by_id.setdefault(player_id, []).append(player)
        key = normalize_name(player.get("name"))
        if key:
            by_name.setdefault(key, []).append(player)

    source_names: dict[str, int] = {}
    for record in records:
        key = normalize_name(record["name"])
        source_names[key] = source_names.get(key, 0) + 1

    # Clear only this metric so a previously published value cannot survive a missing source row.
    for player in pool:
        statcast = player.get("statcast2026")
        if isinstance(statcast, dict):
            statcast.pop("sprintSpeed", None)

    matched_ids: set[str] = set()
    conflicted_ids: set[str] = set()
    ambiguous = 0
    unmatched = 0
    for record in records:
        key = normalize_name(record["name"])
        candidates = by_id.get(record["savantId"], [])
        if len(candidates) != 1:
            candidates = by_name.get(key, []) if source_names.get(key) == 1 else []
        if len(candidates) != 1:
            if len(candidates) > 1 or source_names.get(key, 0) > 1:
                ambiguous += 1
            else:
                unmatched += 1
            continue

        player = candidates[0]
        fantrax_id = player["fantraxId"]
        if fantrax_id in conflicted_ids:
            ambiguous += 1
            continue
        if fantrax_id in matched_ids:
            conflicted = player.get("statcast2026")
            if isinstance(conflicted, dict):
                conflicted.pop("sprintSpeed", None)
            matched_ids.remove(fantrax_id)
            conflicted_ids.add(fantrax_id)
            ambiguous += 2
            continue
        statcast = player.setdefault("statcast2026", {})
        statcast.update({"savantId": record["savantId"], "sprintSpeed": record["sprintSpeed"]})
        matched_ids.add(fantrax_id)

    if len(matched_ids) + ambiguous + unmatched != len(records):
        raise ValueError("Baseball Savant Sprint Speed match accounting failed")
    statcast_summary["sprint_speed"] = {
        "source_url": SOURCE_URL,
        "records_received": len(records),
        "matched_pool_players": len(matched_ids),
        "ambiguous_name_matches": ambiguous,
        "unmatched_records": unmatched,
        "fetched_at": fetched_at or datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z"),
    }
    return snapshot


def fetch_csv() -> str:
    request = urllib.request.Request(SOURCE_URL, headers={"User-Agent": "FantasyGM2027/1.0", "Accept": "text/csv"})
    with urllib.request.urlopen(request, timeout=45) as response:
        content_type = response.headers.get("Content-Type", "").lower()
        if response.status != 200 or "text/csv" not in content_type:
            raise ValueError(f"Baseball Savant returned unexpected Sprint Speed response: HTTP {response.status} {content_type}")
        return response.read().decode("utf-8-sig")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--snapshot", type=Path, default=Path("public/fantasygm.json"))
    args = parser.parse_args()
    snapshot = json.loads(args.snapshot.read_text(encoding="utf-8"))
    records = parse_sprint_speed_csv(fetch_csv())
    attach_sprint_speed(snapshot, records)
    temporary = args.snapshot.with_suffix(".tmp")
    temporary.write_text(json.dumps(snapshot, ensure_ascii=False, allow_nan=False) + "\n", encoding="utf-8")
    temporary.replace(args.snapshot)
    summary = snapshot["statcast2026"]["sprint_speed"]
    print("2026 Baseball Savant Sprint Speed feed validated")
    print(f"Sprint Speed records received: {summary['records_received']}")
    print(f"FantasyGM pool players matched: {summary['matched_pool_players']}")
    print(f"Ambiguous name matches left blank: {summary['ambiguous_name_matches']}")
    print(f"No pool match: {summary['unmatched_records']}")


if __name__ == "__main__":
    main()
