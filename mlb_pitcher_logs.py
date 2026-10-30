"""Collect the last three verified MLB pitching games for Desert Rats pitchers."""
from __future__ import annotations
from scoring_fields import missing_fields, source_number
from scoring_model import score_events

import json
import re
import unicodedata
import urllib.parse
import urllib.request
from datetime import datetime, timezone

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


def longball_points(stat: dict) -> float | None:
    """Score one pitching appearance using actual game role.

    LONGBALL 2027 uses SP W/L at +5/-5 and RP W/L at +2/-2.
    Role is determined from gamesStarted for this appearance, never from
    Fantrax position eligibility.
    """
    if missing_fields(stat, "pitching", aggregate=False):
        return None
    ip = _ip_value(stat.get("inningsPitched"))
    k = _num(stat, "strikeOuts")
    er = _num(stat, "earnedRuns")
    hits = _num(stat, "hits")
    bb = _num(stat, "baseOnBalls")
    gs = _num(stat, "gamesStarted")
    relief_role = gs < 1
    qs = 1 if not relief_role and ip >= 6 and er <= 3 else 0
    win = _num(stat, "wins")
    loss = _num(stat, "losses")
    win_points = 2 if relief_role else 5
    loss_points = -2 if relief_role else -5
    saves = _num(stat, "saves")
    holds = _num(stat, "holds")
    blown = _num(stat, "blownSaves")
    # A solo official no-hitter requires a complete game of at least nine
    # innings with zero hits. Never credit a partial combined appearance.
    no_hitter = (stat.get("gamesPlayed") == 1 and gs == 1
                 and _num(stat, "completeGames") == 1 and ip >= 9
                 and hits == 0)
    if gs not in (0,1) or (saves and holds):
        return None
    result = score_events({
        'IP':ip,'K':k,'ER':er,'H':hits,'BB':bb,'QS':qs,'W':win,
        'SVH':saves+holds,'L':loss,'BS':blown,'CG':_num(stat,'completeGames'),
        'HB':_num(stat,'hitBatsmen'),'HR':_num(stat,'homeRuns'),
        'PKO':_num(stat,'pickoffs'),'SHO':_num(stat,'shutouts'),'NH':int(no_hitter),
    }, 'PITCHING', 'RP' if relief_role else 'Default')
    return round(result['points'],2) if result['points'] is not None else None


def _all_mlb_players(season: int) -> dict[str, list[dict]]:
    payload = _get("sports/1/players", {"season": season})
    people = payload.get("people")
    if not isinstance(people, list):
        raise ValueError("MLB player catalogue unavailable")
    result: dict[str, list[dict]] = {}
    for person in people:
        key = _norm(person.get("fullName"))
        if key and isinstance(person.get("id"), int):
            result.setdefault(key, []).append(person)
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
    pool_by_id = {p.get("fantraxId"):p for p in snapshot.get("pool",[])}
    catalogue_by_id = {p["id"]:p for group in catalogue.values() for p in group}
    for player, pos in pitchers:
        name = str(player.get("Player") or "").strip()
        fantrax_id = str(player.get("Player ID") or "").strip()
        identity = pool_by_id.get(fantrax_id,{})
        mlb_id = identity.get("mlbId")
        people = [catalogue_by_id[mlb_id]] if mlb_id in catalogue_by_id else []
        if not identity and not snapshot.get("player_identity"):
            people = catalogue.get(_norm(name), [])
        if len(people) != 1 or not fantrax_id:
            results[name] = {
                "fantrax_id": fantrax_id or None,
                "source_status": "NOT VERIFIED",
                "identity_status": "AMBIGUOUS" if len(people) > 1 else "NOT VERIFIED",
                "games": [],
            }
            continue
        person = people[0]
        splits = _game_log(person["id"], season)
        is_sp = "SP" in pos
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
                "strikeouts": int(source_number(stat, "strikeOuts")) if source_number(stat, "strikeOuts") is not None else None,
                "earned_runs": int(source_number(stat, "earnedRuns")) if source_number(stat, "earnedRuns") is not None else None,
                "hits": int(source_number(stat, "hits")) if source_number(stat, "hits") is not None else None,
                "walks": int(source_number(stat, "baseOnBalls")) if source_number(stat, "baseOnBalls") is not None else None,
                "wins": int(source_number(stat, "wins")) if source_number(stat, "wins") is not None else None,
                "losses": int(source_number(stat, "losses")) if source_number(stat, "losses") is not None else None,
                "saves": int(source_number(stat, "saves")) if source_number(stat, "saves") is not None else None,
                "holds": int(source_number(stat, "holds")) if source_number(stat, "holds") is not None else None,
                "blown_saves": int(source_number(stat, "blownSaves")) if source_number(stat, "blownSaves") is not None else None,
                "fantasy_points": longball_points(stat),
            }
            selected.append(game)
            if len(selected) == 3:
                break
        results[name] = {
            "fantrax_id": fantrax_id,
            "mlb_id": person["id"],
            "identity_status": "VERIFIED",
            "mode": "starts" if is_sp else "appearances",
            "source_status": "VERIFIED" if selected else "NOT VERIFIED",
            "games": selected,
        }

    return {"source": "MLB Stats API", "season": season, "fetched_at": datetime.now(timezone.utc).isoformat(), "players": results}
