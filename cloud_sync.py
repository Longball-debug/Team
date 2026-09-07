"""Publish verified roster and standings fields to the FantasyGM Airtable base."""
import argparse
import json
import os
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

TABLES = {"Teams": "tbloEHPfvS7GqWxSZ", "Players": "tblFhGtwnYbdiQBU5"}

def build_records(data):
    league = data["league"]["league_id"]
    stamp = data["generated_at"]
    common = {"League ID": league, "Updated At": stamp, "Source": "Fantrax REST API"}
    standings = {str(s["team_id"]): s.get("raw", {}) for s in data["standings"]}
    teams, players, seen = [], [], set()
    for team in data["all_rosters"]:
        tid = str(team["team_id"])
        raw = standings.get(tid, {})
        row = dict(common, **{"Team": team["team_name"], "Team ID": tid})
        record = raw.get("points")
        if isinstance(record, str) and re.fullmatch(r"\d+-\d+-\d+", record):
            row["Record"] = record
        points = raw.get("totalPointsFor")
        if isinstance(points, (int, float)) and not isinstance(points, bool):
            row["Points"] = points
        teams.append(row)
        for player in team["players"]:
            pid = player.get("player_id")
            if not pid or str(pid) in seen:
                raise ValueError("Missing or duplicate player ID; refusing ambiguous roster")
            seen.add(str(pid))
            positions = player.get("eligible_positions")
            if isinstance(positions, list):
                positions = "/".join(str(p) for p in positions)
            row = dict(common, **{"Player ID": str(pid), "Fantasy Team ID": tid,
                                  "Status": player.get("roster_status") or "Unknown"})
            # Missing names must not overwrite names maintained in Airtable.
            if player.get("name"):
                row["Player"] = player["name"]
            if positions:
                row["Positions"] = str(positions)
            players.append(row)
    if not teams or not players:
        raise ValueError("Empty roster; refusing to replace operational data")
    return teams, players

class Airtable:
    def __init__(self):
        self.token = os.environ["AIRTABLE_TOKEN"]
        self.base = os.environ.get("AIRTABLE_BASE_ID", "appA7fcI1VWfwOUXq")

    def request(self, table, method="GET", body=None, query=None):
        url = f"https://api.airtable.com/v0/{self.base}/{TABLES[table]}"
        if query:
            url += "?" + urllib.parse.urlencode(query)
        for attempt in range(4):
            req = urllib.request.Request(url, method=method,
                data=json.dumps(body).encode() if body is not None else None,
                headers={"Authorization": f"Bearer {self.token}", "Content-Type": "application/json"})
            try:
                with urllib.request.urlopen(req, timeout=30) as response:
                    result = json.load(response)
                time.sleep(0.25)
                return result
            except urllib.error.HTTPError as error:
                if error.code == 429 or error.code >= 500:
                    if attempt < 3:
                        time.sleep(30 if error.code == 429 else 2 ** attempt)
                        continue
                raise RuntimeError(f"Airtable {table}: HTTP {error.code}") from None
            except urllib.error.URLError:
                if attempt < 3:
                    time.sleep(2 ** attempt)
                    continue
                raise RuntimeError("Airtable connection failed") from None

    def records(self, table):
        query = {"pageSize": 100}
        while True:
            result = self.request(table, query=query)
            yield from result["records"]
            if not result.get("offset"):
                break
            query["offset"] = result["offset"]

    def upsert(self, table, rows, key):
        for i in range(0, len(rows), 10):
            self.request(table, "PATCH", {"performUpsert": {"fieldsToMergeOn": ["League ID", key]},
                "records": [{"fields": row} for row in rows[i:i+10]]})

def sync(client, data):
    teams, players = build_records(data)
    league = data["league"]["league_id"]
    stamp = datetime.fromisoformat(data["generated_at"])
    current = {p["Player ID"] for p in players}
    old = {table: list(client.records(table)) for table in TABLES}
    for records in old.values():
        for record in records:
            fields = record["fields"]
            if fields.get("League ID") == league and fields.get("Updated At"):
                if datetime.fromisoformat(fields["Updated At"]) > stamp:
                    raise ValueError("Airtable has newer data; refusing stale refresh")
    # Retain player identity and custom fields while clearing departed roster membership.
    for record in old["Players"]:
        fields = record["fields"]
        if fields.get("League ID") == league and fields.get("Player ID") not in current:
            if not fields.get("Player ID"):
                raise ValueError("Existing league player has no ID")
            players.append({"League ID": league, "Player ID": fields["Player ID"],
                "Fantasy Team ID": "", "Status": "Not rostered", "Updated At": data["generated_at"],
                "Source": "Fantrax REST API"})
    client.upsert("Teams", teams, "Team ID")
    client.upsert("Players", players, "Player ID")
    return len(teams), len(players)

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path)
    parser.add_argument("--check-config", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    if args.check_config:
        missing = [key for key in ("FANTRAX_USER_SECRET_ID", "AIRTABLE_TOKEN") if not os.getenv(key, "").strip()]
        if missing:
            raise ValueError("Missing repository secrets: " + ", ".join(missing))
        print("Required secrets configured")
        return
    if not args.root:
        raise ValueError("--root is required")
    data = json.loads((args.root / "data/fantrax/site_data.json").read_text(encoding="utf-8-sig"))
    if args.dry_run:
        teams, players = build_records(data)
        print(f"Validated {len(teams)} teams and {len(players)} roster players. No writes performed.")
    else:
        age = (datetime.now(timezone.utc) - datetime.fromisoformat(data["generated_at"])).total_seconds()
        if age < -300 or age > 7200:
            raise ValueError("Snapshot is not fresh; run Fantrax collection first")
        counts = sync(Airtable(), data)
        print(f"Refreshed {counts[0]} teams and {counts[1]} player records")

if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"Cloud refresh failed: {exc}")
        raise SystemExit(1)
