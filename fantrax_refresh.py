#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import sys
import time
import urllib.parse
import urllib.request
from copy import deepcopy
from datetime import datetime, timezone
from getpass import getpass
from pathlib import Path
from typing import Any, Iterable

BASE_URL = "https://www.fantrax.com/fxea/general"
DEFAULT_ROOT = Path(r"C:\FantasyGM2027")
DEFAULT_LEAGUE_NAME = "LONGBALL 2026"
DEFAULT_TEAM_NAME = "Desert Rats"

def now_iso() -> str:
    return datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds")

def ensure_dir(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)

def write_json(path: Path, data: Any) -> None:
    ensure_dir(path.parent)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
    tmp.replace(path)

def normalize_name(value: Any) -> str:
    return " ".join(str(value or "").strip().lower().split())

def walk(obj: Any) -> Iterable[Any]:
    yield obj
    if isinstance(obj, dict):
        for v in obj.values():
            yield from walk(v)
    elif isinstance(obj, list):
        for v in obj:
            yield from walk(v)

def first_value(d: dict, keys: Iterable[str]) -> Any:
    for key in keys:
        if key in d and d[key] not in (None, "", [], {}):
            return d[key]
    return None

def redact_sensitive(obj: Any) -> Any:
    if isinstance(obj, dict):
        out = {}
        for k, v in obj.items():
            kl = str(k).lower()
            if any(token in kl for token in ("secret", "token", "password", "credential", "cookie")):
                out[k] = "[REDACTED]"
            else:
                out[k] = redact_sensitive(v)
        return out
    if isinstance(obj, list):
        return [redact_sensitive(x) for x in obj]
    return obj

def load_dpapi_secret(secret_path: Path) -> str | None:
    if os.name != "nt" or not secret_path.exists():
        return None
    import subprocess
    ps = rf'''
$ErrorActionPreference = "Stop"
$bytes = [System.IO.File]::ReadAllBytes("{str(secret_path)}")
$plain = [System.Security.Cryptography.ProtectedData]::Unprotect(
    $bytes,
    $null,
    [System.Security.Cryptography.DataProtectionScope]::CurrentUser
)
[System.Text.Encoding]::UTF8.GetString($plain)
'''
    try:
        result = subprocess.run(
            ["powershell.exe", "-NoProfile", "-NonInteractive", "-Command", ps],
            capture_output=True,
            text=True,
            timeout=20,
            check=True,
        )
        value = result.stdout.strip()
        return value or None
    except Exception:
        return None

def get_secret(root: Path, allow_prompt: bool = True) -> str:
    env = os.getenv("FANTRAX_USER_SECRET_ID", "").strip()
    if env:
        return env
    saved = load_dpapi_secret(root / "secrets" / "fantrax_secret.dpapi")
    if saved:
        return saved
    if allow_prompt and sys.stdin.isatty():
        value = getpass("Fantrax User Secret ID (hidden): ").strip()
        if value:
            return value
    raise RuntimeError("Fantrax secret unavailable. Run setup_fantrax_secret.ps1 once or set FANTRAX_USER_SECRET_ID.")

def api_get(endpoint: str, params: dict[str, Any], retries: int = 3, timeout: int = 30) -> Any:
    clean = {k: v for k, v in params.items() if v is not None}
    url = f"{BASE_URL}/{endpoint}?{urllib.parse.urlencode(clean)}"
    last_exc = None
    for attempt in range(1, retries + 1):
        try:
            req = urllib.request.Request(
                url,
                headers={"Accept": "application/json", "User-Agent": "FantasyGM2027/1.0", "Cache-Control": "no-cache"},
                method="GET",
            )
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                body = resp.read().decode("utf-8")
                if resp.status != 200:
                    raise RuntimeError(f"{endpoint}: HTTP {resp.status}")
                return json.loads(body)
        except Exception as exc:
            last_exc = exc
            if attempt < retries:
                time.sleep(2 * attempt)
    # URL errors can contain the authenticated query string. Never log them.
    raise RuntimeError(f"{endpoint} failed after {retries} attempts") from None

def extract_leagues(payload: Any) -> list[dict]:
    candidates: list[dict] = []

    def maybe_add_list(value: Any) -> None:
        if isinstance(value, list):
            for item in value:
                if isinstance(item, dict):
                    nm = first_value(item, ("name", "leagueName", "league_name"))
                    lid = first_value(item, ("id", "leagueId", "league_id"))
                    if nm or lid:
                        candidates.append(item)

    if isinstance(payload, list):
        maybe_add_list(payload)
    elif isinstance(payload, dict):
        for key in ("leagues", "leagueList", "data", "result"):
            value = payload.get(key)
            if isinstance(value, list):
                maybe_add_list(value)
            elif isinstance(value, dict):
                for inner in ("leagues", "leagueList", "data", "result"):
                    maybe_add_list(value.get(inner))
        if not candidates:
            for node in walk(payload):
                if isinstance(node, dict):
                    nm = first_value(node, ("name", "leagueName", "league_name"))
                    lid = first_value(node, ("leagueId", "league_id"))
                    if nm and lid:
                        candidates.append(node)

    seen, unique = set(), []
    for item in candidates:
        lid = str(first_value(item, ("id", "leagueId", "league_id")) or "")
        key = lid or json.dumps(item, sort_keys=True, default=str)
        if key not in seen:
            seen.add(key)
            unique.append(item)
    return unique

def league_name(item: dict) -> str:
    return str(first_value(item, ("name", "leagueName", "league_name")) or "")

def league_id(item: dict) -> str:
    return str(first_value(item, ("id", "leagueId", "league_id")) or "")

def choose_league(leagues: list[dict], wanted_name: str, wanted_id: str | None = None) -> dict:
    if wanted_id:
        for item in leagues:
            if league_id(item) == wanted_id:
                return item
        raise RuntimeError(f"Configured league ID not found: {wanted_id}")

    target = normalize_name(wanted_name)
    exact = [x for x in leagues if normalize_name(league_name(x)) == target]
    if len(exact) == 1:
        return exact[0]

    contains = [x for x in leagues if target and target in normalize_name(league_name(x))]
    if len(contains) == 1:
        return contains[0]

    names = ", ".join(f"{league_name(x)} [{league_id(x)}]" for x in leagues) or "(none)"
    raise RuntimeError(f"Could not uniquely select league '{wanted_name}'. Returned: {names}")

TEAM_NAME_KEYS = ("teamName", "name", "fantasyTeamName", "franchiseName", "displayName", "team_name")
TEAM_ID_KEYS = ("teamId", "id", "fantasyTeamId", "franchiseId", "team_id")
PLAYER_NAME_KEYS = ("playerName", "name", "fullName", "displayName", "player_name")
PLAYER_ID_KEYS = ("playerId", "id", "fantraxId", "player_id")

def looks_like_team(d: dict) -> bool:
    name = first_value(d, TEAM_NAME_KEYS)
    if not isinstance(name, str) or not name.strip():
        return False
    lowered_keys = {str(k).lower() for k in d.keys()}
    player_signals = {"playerid", "position", "positions", "mlbteam", "teamabbrev"}
    team_signals = {"teamid", "fantasyteamid", "franchiseid", "teamname", "fantasyteamname"}
    return bool(lowered_keys & team_signals) or not bool(lowered_keys & player_signals)

def find_team_objects(payload: Any, wanted_team_name: str) -> list[dict]:
    target = normalize_name(wanted_team_name)
    exact, partial = [], []
    for node in walk(payload):
        if isinstance(node, dict) and looks_like_team(node):
            nm = str(first_value(node, TEAM_NAME_KEYS) or "")
            n = normalize_name(nm)
            if n == target:
                exact.append(node)
            elif target and target in n:
                partial.append(node)
    return exact or partial

def find_all_team_candidates(payload: Any) -> list[dict]:
    found, seen = [], set()
    for node in walk(payload):
        if isinstance(node, dict) and looks_like_team(node):
            nm = str(first_value(node, TEAM_NAME_KEYS) or "")
            tid = str(first_value(node, TEAM_ID_KEYS) or "")
            if not nm:
                continue
            key = (normalize_name(nm), tid)
            if key not in seen:
                seen.add(key)
                found.append(node)
    return found

def compact_team(team: dict) -> dict:
    return {
        "name": first_value(team, TEAM_NAME_KEYS),
        "team_id": first_value(team, TEAM_ID_KEYS),
        "raw": redact_sensitive(deepcopy(team)),
    }

def summarize_standings(payload: Any) -> list[dict]:
    out, seen = [], set()
    rank_keys = ("rank", "place", "standing", "overallRank")
    win_keys = ("wins", "w", "win")
    loss_keys = ("losses", "l", "loss")
    points_keys = ("points", "pts", "totalPoints", "score")

    for node in walk(payload):
        if not isinstance(node, dict):
            continue
        nm = first_value(node, TEAM_NAME_KEYS)
        if not nm:
            continue

        rank = first_value(node, rank_keys)
        wins = first_value(node, win_keys)
        losses = first_value(node, loss_keys)
        pts = first_value(node, points_keys)
        if rank is None and wins is None and losses is None and pts is None:
            continue

        key = (
            normalize_name(nm),
            str(first_value(node, TEAM_ID_KEYS) or ""),
            str(rank), str(wins), str(losses), str(pts),
        )
        if key in seen:
            continue
        seen.add(key)
        out.append({
            "team": nm,
            "team_id": first_value(node, TEAM_ID_KEYS),
            "rank": rank,
            "wins": wins,
            "losses": losses,
            "points": pts,
            "raw": redact_sensitive(deepcopy(node)),
        })
    return out

def summarize_roster(payload: Any, wanted_team_name: str, league_info: Any = None) -> dict[str, Any]:
    """
    Fantrax v1.2 live schema observed for LONGBALL 2026:
      {
        "period": 164,
        "rosters": {
          "<teamId>": {
            "teamName": "...",
            "rosterItems": [
              {"id": "<playerId>", "position": "SP", "status": "ACTIVE"}
            ],
            "salaryCap": 450.0
          }
        }
      }

    getTeamRosters does not include player names in the observed response.
    getLeagueInfo.playerInfo is keyed by player ID and supplies eligibility /
    pool status, but the observed objects also do not contain player names.
    Therefore this function never fabricates names: player_name remains null
    unless Fantrax actually supplies one in a future response.
    """
    rosters = payload.get("rosters", {}) if isinstance(payload, dict) else {}
    player_info = {}
    if isinstance(league_info, dict) and isinstance(league_info.get("playerInfo"), dict):
        player_info = league_info["playerInfo"]

    target = normalize_name(wanted_team_name)
    team_id = None
    team = None

    if isinstance(rosters, dict):
        for tid, obj in rosters.items():
            if isinstance(obj, dict) and normalize_name(obj.get("teamName")) == target:
                team_id = tid
                team = obj
                break

    if team is None:
        return {
            "team_found": False,
            "team": None,
            "players": [],
            "note": "Configured team was not found in Fantrax rosters.",
        }

    players = []
    for item in team.get("rosterItems", []):
        if not isinstance(item, dict):
            continue

        pid = item.get("id")
        info = player_info.get(pid, {}) if pid else {}
        if not isinstance(info, dict):
            info = {}

        players.append({
            "player_id": pid,
            "name": first_value(item, ("playerName", "name", "fullName", "displayName")),
            "slot": item.get("position"),
            "roster_status": item.get("status"),
            "eligible_positions": info.get("eligiblePos"),
            "pool_status": info.get("status"),
        })

    return {
        "team_found": True,
        "team": {
            "name": team.get("teamName"),
            "team_id": team_id,
            "salary_cap": team.get("salaryCap"),
        },
        "period": payload.get("period") if isinstance(payload, dict) else None,
        "player_count": len(players),
        "players": players,
        "note": (
            "The observed Fantrax getTeamRosters response identifies players by ID, "
            "position and roster status but does not include player names. "
            "Names are left null rather than guessed."
        ),
    }

def summarize_all_rosters(payload: Any, league_info: Any = None) -> list[dict[str, Any]]:
    rosters = payload.get("rosters", {}) if isinstance(payload, dict) else {}
    if not isinstance(rosters, dict):
        return []

    out = []
    for tid, team in rosters.items():
        if not isinstance(team, dict):
            continue
        name = team.get("teamName")
        if not name:
            continue
        summary = summarize_roster(payload, name, league_info)
        out.append({
            "team_id": tid,
            "team_name": name,
            "salary_cap": team.get("salaryCap"),
            "player_count": summary.get("player_count", 0),
            "players": summary.get("players", []),
        })
    return out

def extract_named_sections(payload: Any) -> dict[str, Any]:
    keywords = {
        "matchup": ("matchup", "matchups", "matchupInfo", "currentMatchup"),
        "player_pool": ("players", "playerPool", "allPlayers", "playerInfo"),
        "config": ("settings", "leagueSettings", "config", "configuration"),
        "transactions": ("transactions", "transactionHistory", "recentTransactions"),
    }
    found = {k: [] for k in keywords}

    for node in walk(payload):
        if not isinstance(node, dict):
            continue
        for section, keys in keywords.items():
            for key in keys:
                if key in node and node[key] not in (None, "", [], {}):
                    found[section].append(redact_sensitive(deepcopy(node[key])))

    return {k: v for k, v in found.items() if v}

def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", default=str(DEFAULT_ROOT))
    parser.add_argument("--league-name", default=DEFAULT_LEAGUE_NAME)
    parser.add_argument("--league-id", default=None)
    parser.add_argument("--team-name", default=DEFAULT_TEAM_NAME)
    parser.add_argument("--period", type=int, default=None)
    parser.add_argument("--no-prompt", action="store_true")
    args = parser.parse_args()

    root = Path(args.root)
    data_dir = root / "data" / "fantrax"
    raw_dir = data_dir / "raw"
    ensure_dir(raw_dir)

    status_path = data_dir / "refresh_status.json"
    status = {
        "started_at": now_iso(),
        "finished_at": None,
        "ok": False,
        "league_name": args.league_name,
        "league_id": args.league_id,
        "team_name": args.team_name,
        "endpoints": {},
        "error": None,
    }

    try:
        secret = get_secret(root, allow_prompt=not args.no_prompt)

        print("FantasyGM2027 Fantrax refresh")
        print("=" * 50)

        endpoints: dict[str, Any] = {}

        print("1) getLeagues")
        leagues_payload = api_get("getLeagues", {"userSecretId": secret})
        write_json(raw_dir / "leagues.json", redact_sensitive(leagues_payload))
        endpoints["getLeagues"] = leagues_payload
        status["endpoints"]["getLeagues"] = "OK"

        leagues = extract_leagues(leagues_payload)
        if not leagues:
            raise RuntimeError("Fantrax returned no identifiable leagues.")

        selected = choose_league(leagues, args.league_name, args.league_id)
        lid, lname = league_id(selected), league_name(selected)
        if not lid:
            raise RuntimeError("Selected league did not include a league ID.")

        status["league_name"], status["league_id"] = lname, lid
        print(f"   Selected: {lname} [{lid}]")

        calls = [
            ("getLeagueInfo", {"leagueId": lid}),
            ("getTeamRosters", {"leagueId": lid, "period": args.period}),
            ("getStandings", {"leagueId": lid}),
            ("getDraftPicks", {"leagueId": lid}),
            ("getDraftResults", {"leagueId": lid}),
        ]

        for idx, (endpoint, params) in enumerate(calls, start=2):
            print(f"{idx}) {endpoint}")
            try:
                payload = api_get(endpoint, params)
                endpoints[endpoint] = payload
                status["endpoints"][endpoint] = "OK"
                write_json(raw_dir / f"{endpoint}.json", redact_sensitive(payload))
                print("   OK")
            except Exception as exc:
                status["endpoints"][endpoint] = f"FAILED: {exc}"
                print(f"   FAILED: {exc}")
                if endpoint in ("getLeagueInfo", "getTeamRosters", "getStandings"):
                    raise

        league_info = endpoints.get("getLeagueInfo", {})
        rosters = endpoints.get("getTeamRosters", {})
        standings = endpoints.get("getStandings", {})

        normalized = {
            "schema_version": "1.0",
            "generated_at": now_iso(),
            "source": "Fantrax REST API",
            "league": {"name": lname, "league_id": lid},
            "desert_rats": summarize_roster(rosters, args.team_name, league_info),
            "all_rosters": summarize_all_rosters(rosters, league_info),
            "standings": summarize_standings(standings),
            "league_info_sections": extract_named_sections(league_info),
            "teams_detected": [
                {"team_id": tid, "name": obj.get("teamName"), "salary_cap": obj.get("salaryCap")}
                for tid, obj in (rosters.get("rosters", {}) if isinstance(rosters, dict) else {}).items()
                if isinstance(obj, dict)
            ],
            "raw_files": {
                "leagues": "raw/leagues.json",
                "league_info": "raw/getLeagueInfo.json",
                "team_rosters": "raw/getTeamRosters.json",
                "standings": "raw/getStandings.json",
                "draft_picks": "raw/getDraftPicks.json",
                "draft_results": "raw/getDraftResults.json",
            },
            "notes": [
                "Fantrax is the league source of truth.",
                "Raw API responses are preserved because Fantrax API v1.2 is beta and field names can vary.",
                "Specific matchup/free-agent/current-score mappings should be finalized only after inspecting the live getLeagueInfo response.",
            ],
        }

        if "getDraftPicks" in endpoints:
            normalized["draft_picks"] = redact_sensitive(endpoints["getDraftPicks"])
        if "getDraftResults" in endpoints:
            normalized["draft_results"] = redact_sensitive(endpoints["getDraftResults"])

        write_json(data_dir / "site_data.json", normalized)

        summary = {
            "generated_at": normalized["generated_at"],
            "league": normalized["league"],
            "desert_rats_found": normalized["desert_rats"]["team_found"],
            "desert_rats_player_count": len(normalized["desert_rats"]["players"]),
            "standing_rows_detected": len(normalized["standings"]),
            "teams_detected": len(normalized["teams_detected"]),
            "league_info_sections_detected": list(normalized["league_info_sections"].keys()),
        }
        write_json(data_dir / "refresh_summary.json", summary)

        status["ok"] = True
        status["finished_at"] = now_iso()
        write_json(status_path, status)

        print("\n" + "=" * 50)
        print("REFRESH SUCCESS")
        print(f"League: {lname} [{lid}]")
        print(f"Desert Rats found: {summary['desert_rats_found']}")
        print(f"Roster players detected: {summary['desert_rats_player_count']}")
        print(f"Standings rows detected: {summary['standing_rows_detected']}")
        print(f"Output: {data_dir / 'site_data.json'}")
        return 0

    except Exception as exc:
        status["ok"] = False
        status["error"] = str(exc)
        status["finished_at"] = now_iso()
        write_json(status_path, status)
        print(f"\nREFRESH FAILED: {exc}", file=sys.stderr)
        return 1

if __name__ == "__main__":
    raise SystemExit(main())
