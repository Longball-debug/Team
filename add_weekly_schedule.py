"""Attach verified MLB weekly schedule data to the sanitized website snapshot."""
from __future__ import annotations

import argparse
import json
from pathlib import Path

from mlb_schedule import fetch_weekly_schedule


def _validate(schedule: dict) -> None:
    if not isinstance(schedule.get('days'), list) or len(schedule['days']) != 7:
        raise ValueError('Weekly MLB schedule must contain exactly seven days')
    if not isinstance(schedule.get('teams'), dict) or len(schedule['teams']) < 30:
        raise ValueError('Weekly MLB schedule missing teams')


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--snapshot', type=Path, default=Path('public/fantasygm.json'))
    args = parser.parse_args()

    data = json.loads(args.snapshot.read_text(encoding='utf-8'))
    current = fetch_weekly_schedule()
    next_week = fetch_weekly_schedule(week_offset=1)
    week_two = fetch_weekly_schedule(week_offset=2)
    for schedule in (current, next_week, week_two):
        _validate(schedule)

    data['weekly_schedule'] = current
    data['fa_lookahead'] = {
        'source': 'MLB Stats API',
        'weeks': [next_week, week_two],
    }
    unavailable = list(data.get('unavailable') or [])
    data['unavailable'] = [x for x in unavailable if x != 'schedule']

    tmp = args.snapshot.with_suffix('.tmp')
    tmp.write_text(json.dumps(data, ensure_ascii=False, allow_nan=False) + '\n', encoding='utf-8')
    tmp.replace(args.snapshot)
    print(
        f"Attached MLB weekly schedule: {current['week_start']} through {current['week_end']}; "
        f"FA lookahead: {next_week['week_start']} through {week_two['week_end']}"
    )


if __name__ == '__main__':
    main()
