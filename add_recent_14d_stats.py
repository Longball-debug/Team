#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
import unicodedata
import urllib.parse
import urllib.request
from datetime import datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

BASE = "https://statsapi.mlb.com/api/v1"

# FantasyGM2027 / LONGBALL 2027 working scoring.
HIT = {
    "1B": 1.5, "2B": 3.0, "3B": 3.0, "HR": 5.0, "RBI": 2.0,
    "R": 1.0, "SB": 3.0, "BB": 1.0, "SO": -0.5, "HBP": 1.0,
    "SF": 1.0, "SH": 1.0, "GIDP": -2.0, "CS": -2.0,
}
PIT = {
    "IP": 2.0, "K": 1.5, "ER": -2.0, "H": -0.5, "BB": -0.5,
    "QS": 5.0, "W": 5.0, "SV": 5.0, "HLD": 5.0, "L": -5.0,
    "BS": -3.0,
}


def fetch_json(path: str, params: dict) -> dict:
    url = f"{BASE}/{path}?{urllib.parse.urlencode(params)}"
    req = urllib.request.Request(url, headers={"User-Agent": "FantasyGM2027/1.0", "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=45) as resp:
        if resp.status != 200:
            raise RuntimeError(f"MLB Stats API HTTP {resp.status}")
        return json.loads(resp.read().decode("utf-8"))


def norm(value: str | None) -> str:
    text = unicodedata.normalize("NFD", str(value or ""))
    text = "".join(ch for ch in text if unicodedata.category(ch) != "Mn")
    text = re.sub(r"\b(jr|sr|ii|iii|iv)\b\.?", "", text.lower())
    return re.sub(r"[^a-z0-9]", "", text)


def num(stat: dict, key: str) -> float:
    try:
        return float(stat.get(key) or 0)
    except (TypeError, ValueError):
        return 0.0


def innings(value) -> float:
    text = str(value or "0")
    if "." not in text:
        try:
            return float(text)
        except ValueError:
            return 0.0
    whole, frac = text.split(".", 1)
    try:
        outs = int(frac[:1])
        return int(whole) + outs / 3.0
    except ValueError:
        return 0.0


def hitter_points(s: dict) -> float:
    hits = num(s, "hits")
    doubles = num(s, "doubles")
    triples = num(s, "triples")
    homers = num(s, "homeRuns")
    singles = max(0.0, hits - doubles - triples - homers)
    return (
        singles * HIT["1B"] + doubles * HIT["2B"] + triples * HIT["3B"] + homers * HIT["HR"]
        + num(s, "rbi") * HIT["RBI"] + num(s, "runs") * HIT["R"] + num(s, "stolenBases") * HIT["SB"]
        + num(s, "baseOnBalls") * HIT["BB"] + num(s, "strikeOuts") * HIT["SO"] + num(s, "hitByPitch") * HIT["HBP"]
        + num(s, "sacFlies") * HIT["SF"] + num(s, "sacBunts") * HIT["SH"]
        + num(s, "groundIntoDoublePlay") * HIT["GIDP"] + num(s, "caughtStealing") * HIT["CS"]
    )


def pitcher_points(s: dict) -> float:
    return (
        innings(s.get("inningsPitched")) * PIT["IP"] + num(s, "strikeOuts") * PIT["K"]
        + num(s, "earnedRuns") * PIT["ER"] + num(s, "hits") * PIT["H"] + num(s, "baseOnBalls") * PIT["BB"]
        + num(s, "qualityStarts") * PIT["QS"] + num(s, "wins") * PIT["W"] + num(s, "saves") * PIT["SV"]
        + num(s, "holds") * PIT["HLD"] + num(s, "losses") * PIT["L"] + num(s, "blownSaves") * PIT["BS"]
    )


def splits(group: str, start: str, end: str) -> list[dict]:
    payload = fetch_json("stats", {
        "stats": "byDateRange",
        "group": group,
        "sportIds": 1,
        "startDate": start,
        "endDate": end,
        "limit": 5000,
        "hydrate": "person,team",
    })
    blocks = payload.get("stats") or []
    if not blocks:
        raise RuntimeError(f"No {group} stats returned")
    return blocks[0].get("splits") or []


def player_name(split: dict) -> str:
    player = split.get("player") or split.get("person") or {}
    return str(player.get("fullName") or player.get("name") or "").strip()


def build_maps(start: str, end: str) -> tuple[dict, dict]:
    hitter_map, pitcher_map = {}, {}
    for split in splits("hitting", start, end):
        name = player_name(split)
        if not name:
            continue
        s = split.get("stat") or {}
        games = int(num(s, "gamesPlayed"))
        pts = hitter_points(s)
        hitter_map[norm(name)] = {"points": round(pts, 1), "games": games, "ppg": round(pts / games, 2) if games else None}
    for split in splits("pitching", start, end):
        name = player_name(split)
        if not name:
            continue
        s = split.get("stat") or {}
        games = int(num(s, "gamesPitched") or num(s, "gamesPlayed"))
        pts = pitcher_points(s)
        pitcher_map[norm(name)] = {"points": round(pts, 1), "games": games, "ppg": round(pts / games, 2) if games else None}
    return hitter_map, pitcher_map


def is_pitcher(positions) -> bool:
    if isinstance(positions, list):
        vals = positions
    else:
        vals = re.split(r"[/,|]", str(positions or ""))
    return any(str(p).strip().upper() in {"P", "SP", "RP"} for p in vals)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--snapshot", type=Path, default=Path("public/fantasygm.json"))
    args = ap.parse_args()

    data = json.loads(args.snapshot.read_text(encoding="utf-8"))
    today = datetime.now(ZoneInfo("America/Phoenix")).date()
    end = today - timedelta(days=1)
    start = end - timedelta(days=13)
    start_s, end_s = start.isoformat(), end.isoformat()

    hitters, pitchers = build_maps(start_s, end_s)
    matched = 0
    for p in data.get("pool") or []:
        record = (pitchers if is_pitcher(p.get("positions")) else hitters).get(norm(p.get("name")))
        if record:
            p["points14"] = record["points"]
            p["games14"] = record["games"]
            p["ppg14"] = record["ppg"]
            matched += 1
        else:
            p["points14"] = None
            p["games14"] = None
            p["ppg14"] = None

    data["recent_14d"] = {
        "source": "MLB Stats API · FantasyGM2027 scoring",
        "start_date": start_s,
        "end_date": end_s,
        "matched_pool_players": matched,
    }

    tmp = args.snapshot.with_suffix(".tmp")
    tmp.write_text(json.dumps(data, ensure_ascii=False, allow_nan=False) + "\n", encoding="utf-8")
    tmp.replace(args.snapshot)
    print(f"Attached 14-day fantasy points for {matched} pool players ({start_s} through {end_s})")


if __name__ == "__main__":
    main()
