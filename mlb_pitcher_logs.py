"""Collect the last three verified MLB pitching games for Desert Rats pitchers."""
from __future__ import annotations

import json
import re
import unicodedata
import urllib.parse
import urllib.request
from datetime import datetime

BASE = "https://statsapi.mlb.com/api/v1"
SEASON = datetime.now().year


def _get(path: str, params: dict | None = None, timeout: int = 30):
    query = urllib.parse.urlencode(params or {})
    url = f"{BASE}/{path}" + (f"?{query}" if query else "")
    req = urllib.request.Request(url, headers={"Accept": "application/json", "User-Agent": "FantasyGM2027/1.0"})
    with urllib.request.urlopen(req, timeout=timeout) as response:
        if response.status != 200:
            raise RuntimeError(f"MLB Stats API HTTP {response.status}")
        return json.load(response)


def _norm(name: str) -> str:
    text = unicodedata.normalize("NFD", str(name or ""))
    text = "".join(ch for ch in text if unicodedata.category(ch) != "Mn").lower()
    text = re.sub(r"\b(jr|sr|ii|iii|iv)\b\.?", "", text)
    return re.sub(r"[^a-z0-9]", "", text)


def _positions(value) -> list[str]:
    if isinstance(value, list):
        return [str(v).strip().upper() for v in value if str(v).strip()]
    return [v.strip().upper() for v in re.split(r"[/,|]", str(value or "")) if v.strip()]


def _ip_value(value) -> float:
    text = str(value or "0")
    if "." not in text:
        return float(text or 0)
    whole, outs = text.split(".", 1)
    try:
        out_count = int(outs[:1])
    except ValueError:
        out_count = 0
    if out_count not in (0, 1, 2):
        return float(text)
    return int(whole or 0) + out_count / 3.0


def _num(stat: dict, key: str) -> float:
    try:
        return float(stat.get(key, 0) or 0)
    except (TypeError, ValueError):
        return 0.0


def longball_points(stat: dict, rp_only: bool = False) -> float:
    ip = _ip_value(stat.get("inningsPitched"))
    k = _num(stat, "strikeOuts")
    er = _num(stat, "earnedRuns")
    hits = _num(stat, "hits")
    bb = _num(stat, "baseOnBalls")
    gs = _num(stat, "gamesStarted")
    qs = 1 if gs > 0 and ip >= 6 and er <= 3 else 0
    win = 0 if rp_only else _num(stat, "wins")
    loss = 0 if rp_only else _num(stat, "losses")
    saves = _num(stat, "saves")
    holds = _num(stat, "holds")
    blown = _num(stat, "blownSaves")
    points = (
        ip * 2
        + k * 1.5
        - er * 2
        - hits * 0.5
        - bb * 0.5
        + qs * 5
        + win * 5
        + (saves + holds) * 5
        - loss * 5
        - blown * 3
    )
    return round(points, 2)


def _all_mlb_players(season: int) -> dict[str, dict]:
    payload = _get("sports/1/players", {"season": season})
    people = payload.get("people")
    if not isinstance(people, list):
        raise ValueError("MLB player catalogue unavailable")
    result = {}
    for person in people:
        key = _norm(person.get("fullName"))
        if key and isinstance(person.get("id"), int):
            result[key] = person
    return result


def _game_log(person_id: int, season: int) -> list[dict]:
    payload = _get(f"people/{person_id}/stats", {"stats": "gameLog", "group": "pitching", "season": season})
    stats = payload.get("stats")
    if not isinstance(stats, list):
        return []
    for block in stats:
        splits = block.get("splits")
        if isinstance(splits, list):
            return splits
    return []


def collect_pitcher_logs(snapshot: dict, season: int = SEASON) -> dict:
    teams = snapshot.get("teams") or []
    rats = next((t for t in teams if str(t.get("Team", "")).strip().lower() == "desert rats"), None)
    if not rats:
        raise ValueError("Desert Rats team not found")
    team_id = rats.get("Team ID")
    pitchers = []
    for p in snapshot.get("players") or []:
        if p.get("Fantasy Team ID") != team_id:
            continue
        pos = _positions(p.get("Positions"))
        if any(x in {"P", "SP", "RP"} for x in pos):
            pitchers.append((p, pos))

    catalogue = _all_mlb_players(season)
    results = {}
    for player, pos in pitchers:
        name = str(player.get("Player") or "").strip()
        person = catalogue.get(_norm(name))
        if not person:
            results[name] = {"source_status": "NOT VERIFIED", "games": []}
            continue
        splits = _game_log(person["id"], season)
        is_sp = "SP" in pos
        rp_only = "RP" in pos and "SP" not in pos
        selected = []
        for split in reversed(splits):
            stat = split.get("stat") or {}
            if is_sp and _num(stat, "gamesStarted") < 1:
                continue
            opponent = (split.get("opponent") or {}).get("abbreviation") or (split.get("opponent") or {}).get("name")
            game = {
                "date": split.get("date"),
                "opponent": opponent,
                "innings_pitched": stat.get("inningsPitched"),
                "strikeouts": int(_num(stat, "strikeOuts")),
                "earned_runs": int(_num(stat, "earnedRuns")),
                "hits": int(_num(stat, "hits")),
                "walks": int(_num(stat, "baseOnBalls")),
                "wins": int(_num(stat, "wins")),
                "losses": int(_num(stat, "losses")),
                "saves": int(_num(stat, "saves")),
                "holds": int(_num(stat, "holds")),
                "blown_saves": int(_num(stat, "blownSaves")),
                "fantasy_points": longball_points(stat, rp_only=rp_only),
            }
            selected.append(game)
            if len(selected) == 3:
                break
        results[name] = {
            "mlb_id": person["id"],
            "mode": "starts" if is_sp else "appearances",
            "source_status": "VERIFIED" if selected else "NOT VERIFIED",
            "games": selected,
        }

    return {"source": "MLB Stats API", "season": season, "players": results}
