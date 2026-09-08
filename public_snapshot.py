"""Build a complete, allowlisted website publication after a successful cloud sync."""
import argparse
import json
import math
import re
from datetime import datetime, timezone
from pathlib import Path
from cloud_sync import Airtable, build_records

LEAGUE = 'gxq8uqpqmg5m5edj'

def build_snapshot(data, client, now=None):
    now = now or datetime.now(timezone.utc)
    stamp = datetime.fromisoformat(data['generated_at'])
    if stamp.tzinfo is None or not -300 <= (now-stamp).total_seconds() <= 7200:
        raise ValueError('Publication requires a fresh collection')
    if data['league']['league_id'] != LEAGUE:
        raise ValueError('Wrong league')
    teams, players = build_records(data)
    tids = [t['Team ID'] for t in teams]
    standings = [str(t['team_id']) for t in data['standings']]
    if len(tids) != 12 or len(set(tids)) != 12 or len(standings) != 12 or set(standings) != set(tids):
        raise ValueError('Incomplete league standings')
    rats = [t for t in teams if t['Team'].strip().lower() == 'desert rats']
    if len(rats) != 1 or not any(p['Fantasy Team ID'] == rats[0]['Team ID'] for p in players):
        raise ValueError('Empty or ambiguous Desert Rats roster')
    if any(not any(p['Fantasy Team ID'] == tid for p in players) for tid in tids):
        raise ValueError('Incomplete league rosters')
    # Read back every operational record. A partially completed multi-batch sync
    # cannot replace the last successful public snapshot.
    old = {}
    for table, key, expected in [('Teams', 'Team ID', teams), ('Players', 'Player ID', players)]:
        rows = {}
        for record in client.records(table):
            f = record['fields']
            if f.get('League ID') != LEAGUE:
                continue
            if not f.get(key) or f[key] in rows:
                raise ValueError('Ambiguous Airtable identity')
            rows[f[key]] = f
        for row in expected:
            saved = rows.get(row[key], {})
            for field, value in row.items():
                actual = saved.get(field)
                if field == 'Updated At':
                    if not actual or datetime.fromisoformat(actual) != stamp:
                        raise ValueError('Partial refresh timestamp')
                elif actual != value:
                    raise ValueError('Refresh readback mismatch')
        if table == 'Players' and any(f.get('Fantasy Team ID') and pid not in {p['Player ID'] for p in players} for pid, f in rows.items()):
            raise ValueError('Departed membership not cleared')
        old[table] = rows
    public_teams = []
    for t in teams:
        row = {k: t[k] for k in ('Team', 'Team ID')}
        if 'Record' in t:
            row['Record'] = t['Record']
        if 'Points' in t:
            if not math.isfinite(t['Points']):
                raise ValueError('Nonfinite points')
            row['Points'] = t['Points']
        public_teams.append(row)
    public_players = []
    for p in players:
        row = {k: p[k] for k in ('Player ID', 'Fantasy Team ID', 'Status')}
        if p.get('Positions'):
            row['Positions'] = p['Positions']
        # Only preserve names keyed by BOTH league and stable Fantrax player ID.
        name = p.get('Player') or old['Players'][p['Player ID']].get('Player')
        if isinstance(name, str) and name.strip():
            row['Player'] = name.strip()
        public_players.append(row)
    return dict(schema_version=1, league_id=LEAGUE, generated_at=data['generated_at'],
                source='Fantrax REST API · Airtable verified names', teams=public_teams, players=public_players,
                unavailable=['matchup_scores','starts_used','injury_details','free_agents','pitcher_ratings'])

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--root', type=Path, required=True)
    parser.add_argument('--output', type=Path, default=Path('public/fantasygm.json'))
    args = parser.parse_args()
    data = json.loads((args.root/'data/fantrax/site_data.json').read_text(encoding='utf-8-sig'))
    result = build_snapshot(data, Airtable())
    if args.output.exists():
        previous = json.loads(args.output.read_text(encoding='utf-8'))
        if datetime.fromisoformat(previous['generated_at']) > datetime.fromisoformat(result['generated_at']):
            raise ValueError('Refusing to replace a newer publication')
    args.output.parent.mkdir(parents=True, exist_ok=True)
    temporary = args.output.with_suffix('.tmp')
    temporary.write_text(json.dumps(result, ensure_ascii=False, allow_nan=False)+'\n', encoding='utf-8')
    temporary.replace(args.output)
    print(f"Published sanitized snapshot: {len(result['teams'])} teams, {len(result['players'])} players")

if __name__ == '__main__':
    main()
