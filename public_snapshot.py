"""Build a complete, allowlisted website publication from fresh Fantrax data."""
import argparse
import json
import math
from datetime import datetime, timezone
from pathlib import Path

from cloud_sync import build_records
from shared_snapshot import validate_shared

LEAGUE = 'gxq8uqpqmg5m5edj'


def build_snapshot(data, now=None):
    now = now or datetime.now(timezone.utc)
    stamp = datetime.fromisoformat(data['generated_at'])

    if stamp.tzinfo is None or not -300 <= (now - stamp).total_seconds() <= 7200:
        raise ValueError('Publication requires a fresh collection')

    if data['league']['league_id'] != LEAGUE:
        raise ValueError('Wrong league')

    teams, players = build_records(data)

    tids = [t['Team ID'] for t in teams]
    standings = [str(t['team_id']) for t in data['standings']]

    if (
        len(tids) != 12
        or len(set(tids)) != 12
        or len(standings) != 12
        or set(standings) != set(tids)
    ):
        raise ValueError('Incomplete league standings')

    rats = [t for t in teams if t['Team'].strip().lower() == 'desert rats']

    if (
        len(rats) != 1
        or not any(p['Fantasy Team ID'] == rats[0]['Team ID'] for p in players)
    ):
        raise ValueError('Empty or ambiguous Desert Rats roster')

    if any(
        not any(p['Fantasy Team ID'] == tid for p in players)
        for tid in tids
    ):
        raise ValueError('Incomplete league rosters')

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
        row = {
            k: p[k]
            for k in ('Player ID', 'Fantasy Team ID', 'Status')
        }

        if p.get('Positions'):
            row['Positions'] = p['Positions']

        public_players.append(row)

    # Validate the Fantrax-derived player pool, ownership and verified names.
    pool, transactions = validate_shared(
        data,
        public_players,
        public_teams,
    )

    by_id = {p['fantraxId']: p for p in pool}

    for player in public_players:
        shared = by_id.get(player['Player ID'])

        if not shared:
            raise ValueError('Roster player missing from shared Fantrax pool')

        name = shared.get('name')

        if (
            not isinstance(name, str)
            or not name.strip()
            or name == 'Name unavailable'
        ):
            raise ValueError('Roster player name not verified')

        player['Player'] = name.strip()
        player['MLB Team'] = shared.get('mlbTeam')

    unavailable = [
        'matchup_scores',
        'starts_used',
        'injury_details',
        'pitcher_ratings',
    ]

    if transactions is None:
        unavailable.append('transactions')

    return dict(
        schema_version=1,
        league_id=LEAGUE,
        generated_at=data['generated_at'],
        source='Fantrax REST API · getPlayerIds verified names',
        teams=public_teams,
        players=public_players,
        pool=pool,
        transactions=transactions,
        transaction_scope={
            'view': 'CLAIM_DROP',
            'executed_only': True,
            'max_results_per_page': 10,
            'coverage': 'Recent page only; not full league history',
            'date_format': 'Fantrax display text; preserved without timezone conversion',
        },
        unavailable=unavailable,
    )


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--root', type=Path, required=True)
    parser.add_argument(
        '--output',
        type=Path,
        default=Path('public/fantasygm.json'),
    )
    args = parser.parse_args()

    data = json.loads(
        (args.root / 'data/fantrax/site_data.json')
        .read_text(encoding='utf-8-sig')
    )

    result = build_snapshot(data)

    if args.output.exists():
        previous = json.loads(
            args.output.read_text(encoding='utf-8')
        )

        if (
            datetime.fromisoformat(previous['generated_at'])
            > datetime.fromisoformat(result['generated_at'])
        ):
            raise ValueError(
                'Refusing to replace a newer publication'
            )

    args.output.parent.mkdir(parents=True, exist_ok=True)

    temporary = args.output.with_suffix('.tmp')

    temporary.write_text(
        json.dumps(
            result,
            ensure_ascii=False,
            allow_nan=False,
        ) + '\n',
        encoding='utf-8',
    )

    temporary.replace(args.output)

    print(
        f"Published sanitized snapshot: "
        f"{len(result['teams'])} teams, "
        f"{len(result['players'])} players"
    )


if __name__ == '__main__':
    main()
