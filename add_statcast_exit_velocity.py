#!/usr/bin/env python3
"""Attach verified 2026 Baseball Savant Exit Velocity & Barrels metrics."""
from __future__ import annotations

import argparse
import csv
import io
import json
import math
import re
import unicodedata
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

SEASON = 2026
BASE_URL = "https://baseballsavant.mlb.com/leaderboard/statcast"
SOURCE_URL = BASE_URL + "?" + urllib.parse.urlencode({
    "type": "batter", "year": SEASON, "position": "", "team": "", "min": 1,
    "sort": 7, "sortDir": "desc", "csv": "true",
})
REQUIRED_COLUMNS = {"last_name, first_name", "player_id", "avg_hit_speed", "ev95percent", "brl_percent"}
PITCHER_POSITIONS = {"P", "SP", "RP"}


def normalize_name(value: str | None) -> str:
    text = unicodedata.normalize("NFD", str(value or ""))
    text = "".join(ch for ch in text if unicodedata.category(ch) != "Mn")
    text = re.sub(r"\b(jr|sr|ii|iii|iv)\b\.?", "", text.lower())
    return re.sub(r"[^a-z0-9]", "", text)


def hitter_eligible(player: dict) -> bool:
    positions = player.get("positions")
    values = positions if isinstance(positions, list) else re.split(r"[/,|]", str(positions or ""))
    return any(str(pos).strip().upper() not in PITCHER_POSITIONS for pos in values if str(pos).strip())


def _number(row: dict[str, str], key: str, maximum: float) -> float | None:
    raw = (row.get(key) or "").strip()
    if not raw:
        return None
    try:
        value = float(raw)
    except (TypeError, ValueError):
        raise ValueError(f"Missing or invalid {key} for {row.get('player_id')}") from None
    if not math.isfinite(value) or value < 0 or value > maximum:
        raise ValueError(f"Out-of-range {key} for {row.get('player_id')}")
    return value


def parse_leaderboard_csv(text: str, minimum_records: int = 500) -> list[dict]:
    reader = csv.DictReader(io.StringIO(text))
    headers = set(reader.fieldnames or [])
    if not REQUIRED_COLUMNS <= headers:
        raise ValueError("Baseball Savant CSV is missing required fields")

    records = []
    seen_ids = set()
    for row in reader:
        raw_name = (row.get("last_name, first_name") or "").strip()
        player_id = (row.get("player_id") or "").strip()
        if not raw_name or not player_id.isdigit() or player_id in seen_ids:
            raise ValueError("Invalid or duplicate Baseball Savant player identity")
        seen_ids.add(player_id)
        if "," in raw_name:
            last, first = (part.strip() for part in raw_name.split(",", 1))
            name = f"{first} {last}".strip()
        else:
            name = raw_name
        records.append({
            "savantId": player_id,
            "name": name,
            "exitVelocity": _number(row, "avg_hit_speed", 150),
            # Baseball Savant's 95 MPH+ percentage is its Hard-Hit% column.
            "hardHitPct": _number(row, "ev95percent", 100),
            # Use barrels per batted-ball event, not barrels per plate appearance.
            "barrelPct": _number(row, "brl_percent", 100),
        })
    if len(records) < minimum_records:
        raise ValueError(f"Incomplete Baseball Savant leaderboard: {len(records)} records")
    return records


def _stable_ids(player: dict) -> set[str]:
    values = [player.get(key) for key in ("mlbId", "mlbPlayerId", "mlb_id", "baseballSavantId", "savantId")]
    current = player.get("statcast2026")
    if isinstance(current, dict):
        values.append(current.get("savantId"))
    return {str(value) for value in values if value is not None and str(value).isdigit()}


def attach_records(snapshot: dict, records: list[dict], fetched_at: str | None = None) -> dict:
    pool = snapshot.get("pool")
    if not isinstance(pool, list) or not pool:
        raise ValueError("FantasyGM player pool is unavailable")
    if any(not isinstance(player, dict) or not isinstance(player.get("fantraxId"), str) for player in pool):
        raise ValueError("FantasyGM player pool has invalid player identities")

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

    for player in pool:
        player.pop("statcast2026", None)

    matched_ids: set[str] = set()
    ambiguous = 0
    unmatched = 0
    for record in records:
        candidates = by_id.get(record["savantId"], [])
        if len(candidates) != 1:
            candidates = []
            key = normalize_name(record["name"])
            # Name fallback is permitted only when both source and pool names resolve uniquely.
            if source_names.get(key) == 1:
                candidates = by_name.get(key, [])
        if len(candidates) != 1:
            if len(candidates) > 1 or source_names.get(normalize_name(record["name"])) > 1:
                ambiguous += 1
            else:
                unmatched += 1
            continue
        player = candidates[0]
        if player["fantraxId"] in matched_ids:
            ambiguous += 1
            player.pop("statcast2026", None)
            matched_ids.discard(player["fantraxId"])
            continue
        player["statcast2026"] = {
            "savantId": record["savantId"],
            "exitVelocity": record["exitVelocity"],
            "hardHitPct": record["hardHitPct"],
            "barrelPct": record["barrelPct"],
        }
        matched_ids.add(player["fantraxId"])

    if len(matched_ids) + ambiguous + unmatched != len(records):
        raise ValueError("Baseball Savant match accounting failed")
    snapshot["statcast2026"] = {
        "source": "Baseball Savant",
        "source_url": SOURCE_URL,
        "season": SEASON,
        "records_received": len(records),
        "matched_pool_players": len(matched_ids),
        "ambiguous_name_matches": ambiguous,
        "unmatched_records": unmatched,
        "fetched_at": fetched_at or datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z"),
    }
    return snapshot


def fetch_csv() -> str:
    request = urllib.request.Request(SOURCE_URL, headers={
        "User-Agent": "FantasyGM2027/1.0",
        "Accept": "text/csv",
    })
    with urllib.request.urlopen(request, timeout=45) as response:
        content_type = response.headers.get("Content-Type", "").lower()
        if response.status != 200 or "text/csv" not in content_type:
            raise ValueError(f"Baseball Savant returned unexpected response: HTTP {response.status} {content_type}")
        return response.read().decode("utf-8-sig")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--snapshot", type=Path, default=Path("public/fantasygm.json"))
    args = parser.parse_args()

    data = json.loads(args.snapshot.read_text(encoding="utf-8"))
    csv_text = fetch_csv()
    records = parse_leaderboard_csv(csv_text)
    enriched = attach_records(data, records)

    temp = args.snapshot.with_suffix(".tmp")
    temp.write_text(json.dumps(enriched, ensure_ascii=False, allow_nan=False) + "\n", encoding="utf-8")
    temp.replace(args.snapshot)
    meta = enriched["statcast2026"]
    print("2026 Baseball Savant Exit Velocity & Barrels feed validated")
    print(f"Statcast records received: {meta['records_received']}")
    print(f"FantasyGM pool players matched: {meta['matched_pool_players']}")
    print(f"Ambiguous name matches left blank: {meta['ambiguous_name_matches']}")
    print(f"No pool match: {meta['unmatched_records']}")


if __name__ == "__main__":
    main()
