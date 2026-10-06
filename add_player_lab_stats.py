#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from datetime import datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

from add_recent_14d_stats import _put_unique, fetch_json, hitter_points, is_pitcher, norm, num, pitcher_points, player_name


def stat_splits(group: str, stats: str, **params) -> list[dict]:
    query = {"stats": stats, "group": group, "sportIds": 1, "limit": 5000, "hydrate": "person,team", **params}
    payload = fetch_json("stats", query)
    blocks = payload.get("stats") or []
    if not blocks:
        return []
    return blocks[0].get("splits") or []


def recent_map(group: str, start: str, end: str) -> dict[str, dict]:
    out = {}
    for split in stat_splits(group, "byDateRange", startDate=start, endDate=end):
        name = player_name(split)
        if not name:
            continue
        s = split.get("stat") or {}
        games = int(num(s, "gamesPlayed") or num(s, "gamesPitched"))
        pts = pitcher_points(s) if group == "pitching" else hitter_points(s)
        _put_unique(out, norm(name), {
            "points": round(pts, 1),
            "games": games,
            "ppg": round(pts / games, 2) if games else None,
        })
    return out


def season_map(group: str, season: int) -> dict[str, dict]:
    out = {}
    for split in stat_splits(group, "season", season=season):
        name = player_name(split)
        if not name:
            continue
        s = split.get("stat") or {}
        if group == "hitting":
            pa = num(s, "plateAppearances")
            ab = num(s, "atBats")
            bb = num(s, "baseOnBalls")
            so = num(s, "strikeOuts")
            try:
                avg = float(s.get("avg")) if s.get("avg") not in (None, "") else None
                obp = float(s.get("obp")) if s.get("obp") not in (None, "") else None
                slg = float(s.get("slg")) if s.get("slg") not in (None, "") else None
                ops = float(s.get("ops")) if s.get("ops") not in (None, "") else None
            except ValueError:
                avg = obp = slg = ops = None
            _put_unique(out, norm(name), {
                "type": "hitter",
                "games": int(num(s, "gamesPlayed")),
                "pa": int(pa),
                "avg": avg,
                "obp": obp,
                "slg": slg,
                "ops": ops,
                "hr": int(num(s, "homeRuns")),
                "sb": int(num(s, "stolenBases")),
                "bb_pct": round(bb / pa * 100, 1) if pa else None,
                "k_pct": round(so / pa * 100, 1) if pa else None,
                "iso": round(slg - avg, 3) if slg is not None and avg is not None else None,
            })
        else:
            bf = num(s, "battersFaced")
            so = num(s, "strikeOuts")
            bb = num(s, "baseOnBalls")
            try:
                era = float(s.get("era")) if s.get("era") not in (None, "") else None
                whip = float(s.get("whip")) if s.get("whip") not in (None, "") else None
            except ValueError:
                era = whip = None
            _put_unique(out, norm(name), {
                "type": "pitcher",
                "games": int(num(s, "gamesPitched") or num(s, "gamesPlayed")),
                "starts": int(num(s, "gamesStarted")),
                "ip": s.get("inningsPitched"),
                "era": era,
                "whip": whip,
                "k": int(so),
                "bb": int(bb),
                "k_bb_pct": round((so - bb) / bf * 100, 1) if bf else None,
            })
    return out


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--snapshot", type=Path, default=Path("public/fantasygm.json"))
    args = ap.parse_args()

    data = json.loads(args.snapshot.read_text(encoding="utf-8"))
    today = datetime.now(ZoneInfo("America/Phoenix")).date()
    end = today - timedelta(days=1)
    season = end.year

    windows = {}
    for days in (7, 30):
        start = end - timedelta(days=days - 1)
        windows[days] = {
            "start": start.isoformat(),
            "end": end.isoformat(),
            "hitting": recent_map("hitting", start.isoformat(), end.isoformat()),
            "pitching": recent_map("pitching", start.isoformat(), end.isoformat()),
        }

    season_h = season_map("hitting", season)
    season_p = season_map("pitching", season)
    pool = data.get("pool") or []
    pool_name_counts: dict[tuple[bool, str], int] = {}
    for p in pool:
        identity = (is_pitcher(p.get("positions")), norm(p.get("name")))
        pool_name_counts[identity] = pool_name_counts.get(identity, 0) + 1

    matched = 0
    ambiguous_pool_names = 0
    for p in pool:
        key = norm(p.get("name"))
        pitching = is_pitcher(p.get("positions"))
        unique_pool_identity = bool(key) and pool_name_counts.get((pitching, key), 0) == 1
        p7 = windows[7]["pitching" if pitching else "hitting"].get(key) if unique_pool_identity else None
        p30 = windows[30]["pitching" if pitching else "hitting"].get(key) if unique_pool_identity else None
        season_rec = (season_p if pitching else season_h).get(key) if unique_pool_identity else None
        p["points7"] = p7.get("points") if p7 else None
        p["games7"] = p7.get("games") if p7 else None
        p["ppg7"] = p7.get("ppg") if p7 else None
        p["points30"] = p30.get("points") if p30 else None
        p["games30"] = p30.get("games") if p30 else None
        p["ppg30"] = p30.get("ppg") if p30 else None
        p["seasonMetrics"] = season_rec
        if p7 or p30 or season_rec:
            matched += 1
        elif key and not unique_pool_identity:
            ambiguous_pool_names += 1

    source_maps = [
        windows[7]["hitting"], windows[7]["pitching"],
        windows[30]["hitting"], windows[30]["pitching"],
        season_h, season_p,
    ]
    ambiguous_source_names = sum(sum(v is None for v in source.values()) for source in source_maps)
    data["player_lab"] = {
        "source": "MLB Stats API · FantasyGM2027 scoring",
        "season": season,
        "recent_end_date": end.isoformat(),
        "window7_start": windows[7]["start"],
        "window30_start": windows[30]["start"],
        "matched_pool_players": matched,
        "ambiguous_pool_names": ambiguous_pool_names,
        "ambiguous_source_names": ambiguous_source_names,
        "identity_rule": "normalized-name fallback only when unique in both MLB source and Fantrax pool",
    }

    tmp = args.snapshot.with_suffix(".tmp")
    tmp.write_text(json.dumps(data, ensure_ascii=False, allow_nan=False) + "\n", encoding="utf-8")
    tmp.replace(args.snapshot)
    print(f"Attached Player Lab metrics for {matched} pool players through {end.isoformat()}")


if __name__ == "__main__":
    main()
