"""Attach Desert Rats pitcher last-three game logs to the website snapshot."""
from __future__ import annotations

import argparse
import json
from pathlib import Path

from mlb_pitcher_logs import collect_pitcher_logs


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--snapshot', type=Path, default=Path('public/fantasygm.json'))
    args = parser.parse_args()

    data = json.loads(args.snapshot.read_text(encoding='utf-8'))
    logs = collect_pitcher_logs(data)
    data['pitcher_recent_games'] = logs

    tmp = args.snapshot.with_suffix('.tmp')
    tmp.write_text(json.dumps(data, ensure_ascii=False, allow_nan=False) + '\n', encoding='utf-8')
    tmp.replace(args.snapshot)

    verified = sum(1 for item in logs['players'].values() if item.get('source_status') == 'VERIFIED')
    print(f"Attached pitcher recent games for {verified}/{len(logs['players'])} Desert Rats pitchers")


if __name__ == '__main__':
    main()
