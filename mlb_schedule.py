"""Collect compact, verified MLB Monday-Sunday schedules from MLB Stats API."""
from __future__ import annotations

import json
import urllib.parse
import urllib.request
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

BASE = "https://statsapi.mlb.com/api/v1"
ARIZONA = ZoneInfo("America/Phoenix")


def _get(path: str, params: dict | None = None, timeout: int = 30):
    query = urllib.parse.urlencode(params or {})
    url = f"{BASE}/{path}" + (f"?{query}" if query else "")
    req = urllib.request.Request(
        url,
        headers={"Accept": "application/json", "User-Agent": "FantasyGM2027/1.0"},
        method="GET",
    )
    with urllib.request.urlopen(req, timeout=timeout) as response:
        if response.status != 200:
            raise RuntimeError(f"MLB Stats API HTTP {response.status}")
        return json.load(response)


def _week_bounds(now: datetime | None = None, week_offset: int = 0) -> tuple[date, date]:
    local = (now or datetime.now(ARIZONA)).astimezone(ARIZONA)
    start = local.date() - timedelta(days=local.weekday()) + timedelta(days=7 * week_offset)
    return start, start + timedelta(days=6)


def fetch_weekly_schedule(now: datetime | None = None, week_offset: int = 0) -> dict:
    start, end = _week_bounds(now, week_offset)
    teams_payload = _get("teams", {"sportId": 1})
    teams = teams_payload.get("teams")
    if not isinstance(teams, list) or len(teams) < 30:
        raise ValueError("Incomplete MLB team catalogue")

    abbreviations = {}
    for team in teams:
        tid = team.get("id")
        abbr = team.get("abbreviation")
        if isinstance(tid, int) and isinstance(abbr, str) and abbr.strip():
            abbreviations[tid] = abbr.strip().upper()
    if len(abbreviations) < 30:
        raise ValueError("Incomplete MLB team abbreviations")

    payload = _get(
        "schedule",
        {
            "sportId": 1,
            "startDate": start.isoformat(),
            "endDate": end.isoformat(),
            "hydrate": "probablePitcher",
        },
    )
    dates = payload.get("dates")
    if not isinstance(dates, list):
        raise ValueError("MLB schedule unavailable")

    by_team: dict[str, dict[str, list[dict]]] = {abbr: {} for abbr in abbreviations.values()}
    games_seen = 0
    for day in dates:
        day_text = day.get("date")
        games = day.get("games")
        if not isinstance(day_text, str) or not isinstance(games, list):
            continue
        for game in games:
            sides = game.get("teams") or {}
            home = sides.get("home") or {}
            away = sides.get("away") or {}
            home_id = (home.get("team") or {}).get("id")
            away_id = (away.get("team") or {}).get("id")
            home_abbr = abbreviations.get(home_id)
            away_abbr = abbreviations.get(away_id)
            if not home_abbr or not away_abbr:
                continue
            games_seen += 1
            status = ((game.get("status") or {}).get("detailedState") or "Scheduled")
            game_pk = game.get("gamePk")
            home_probable = (home.get("probablePitcher") or {}).get("fullName")
            away_probable = (away.get("probablePitcher") or {}).get("fullName")
            by_team[home_abbr].setdefault(day_text, []).append({
                "opponent": away_abbr,
                "home_away": "home",
                "game_pk": game_pk,
                "team_probable_pitcher": home_probable,
                "opponent_probable_pitcher": away_probable,
                "status": status,
            })
            by_team[away_abbr].setdefault(day_text, []).append({
                "opponent": home_abbr,
                "home_away": "away",
                "game_pk": game_pk,
                "team_probable_pitcher": away_probable,
                "opponent_probable_pitcher": home_probable,
                "status": status,
            })

    return {
        "source": "MLB Stats API",
        "week_start": start.isoformat(),
        "week_end": end.isoformat(),
        "days": [(start + timedelta(days=i)).isoformat() for i in range(7)],
        "games_seen": games_seen,
        "teams": by_team,
    }
