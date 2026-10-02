#!/usr/bin/env python3
"""Attach verified 2026 Baseball Savant Expected Statistics to the shared snapshot."""
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
BASE_URL = "https://baseballsavant.mlb.com/leaderboard/expected_statistics"
SOURCE_URL = BASE_URL + "?" + urllib.parse.urlencode({
    "type": "batter", "year": SEASON, "position": "", "team": "",
    "filterType": "bip", "min": 1, "csv": "true",
})
REQUIRED_COLUMNS = {"last_name, first_name", "player_id", "year", "est_ba", "est_slg", "est_woba"}


def _metric(row: dict[str, str], column: str) -> float | None:
    raw = (row.get(column) or "").strip()
    if not raw:
        return None
    try:
        value = float(raw)
    except ValueError:
        raise ValueError(f"Invalid {column} for Baseball Savant player {row.get('player_id')}") from None
    if not math.isfinite(value) or value < 0 or value > 1:
        raise ValueError(f"Out-of-range {column} for Baseball Savant player {row.get('player_id')}")
    return value


def parse_expected_csv(text: str, minimum_records: int = 500) -> list[dict]:
    reader = csv.DictReader(io.StringIO(text))
    if not REQUIRED_COLUMNS <= set(reader.fieldnames or []):
        raise ValueError("Baseball Savant Expected Statistics CSV is missing required fields")

    records = []
    seen_ids = set()
    for row in reader:
        raw_name = (row.get("last_name, first_name") or "").strip()
        player_id = (row.get("player_id") or "").strip()
        if not raw_name or not player_id.isdigit() or player_id in seen_ids or row.get("year") != str(SEASON):
            raise ValueError("Invalid or duplicate Baseball Savant Expected Statistics identity")
        seen_ids.add(player_id)
        if "," in raw_name:
            last, first = (part.strip() for part in raw_name.split(",", 1))
            name = f"{first} {last}".strip()
        else:
            name = raw_name
        records.append({
            "savantId": player_id,
            "name": name,
            "xba": _metric(row, "est_ba"),
            "xslg": _metric(row, "est_slg"),
            "xwoba": _metric(row, "est_woba"),
        })
    if len(records) < minimum_records:
        raise ValueError(f"Incomplete Baseball Savant Expected Statistics leaderboard: {len(records)} records")
    return records


def _stable_ids(player: dict) -> set[str]:
    values = [player.get(key) for key in ("mlbId", "mlbPlayerId", "mlb_id", "baseballSavantId", "savantId")]
    statcast = player.get("statcast2026")
    if isinstance(statcast, dict):
        values.append(statcast.get("savantId"))
    return {str(value) for value in values if value is not None and str(value).isdigit()}


def attach_expected(snapshot: dict, records: list[dict], fetched_at: str | None = None) -> dict:
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
            # Multiple Savant rows resolving to one pool identity are ambiguous; keep no expected stats.
            player["statcast2026"].pop("xba", None)
            player["statcast2026"].pop("xslg", None)
            player["statcast2026"].pop("xwoba", None)
            matched_ids.remove(fantrax_id)
            conflicted_ids.add(fantrax_id)
            ambiguous += 2
            continue
        statcast = player.setdefault("statcast2026", {})
        statcast.update({"savantId": record["savantId"], "xba": record["xba"], "xslg": record["xslg"], "xwoba": record["xwoba"]})
        matched_ids.add(fantrax_id)

    if len(matched_ids) + ambiguous + unmatched != len(records):
        raise ValueError("Baseball Savant Expected Statistics match accounting failed")
    statcast_summary["expected_statistics"] = {
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
            raise ValueError(f"Baseball Savant returned unexpected Expected Statistics response: HTTP {response.status} {content_type}")
        return response.read().decode("utf-8-sig")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--snapshot", type=Path, default=Path("public/fantasygm.json"))
    args = parser.parse_args()
    snapshot = json.loads(args.snapshot.read_text(encoding="utf-8"))
    records = parse_expected_csv(fetch_csv())
    attach_expected(snapshot, records)
    temporary = args.snapshot.with_suffix(".tmp")
    temporary.write_text(json.dumps(snapshot, ensure_ascii=False, allow_nan=False) + "\n", encoding="utf-8")
    temporary.replace(args.snapshot)
    summary = snapshot["statcast2026"]["expected_statistics"]
    print("2026 Baseball Savant Expected Statistics feed validated")
    print(f"Expected Statistics records received: {summary['records_received']}")
    print(f"FantasyGM pool players matched: {summary['matched_pool_players']}")
    print(f"Ambiguous name matches left blank: {summary['ambiguous_name_matches']}")
    print(f"No pool match: {summary['unmatched_records']}")


if __name__ == "__main__":
    main()
