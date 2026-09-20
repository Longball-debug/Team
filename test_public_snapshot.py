import unittest
from datetime import datetime, timezone, timedelta

from public_snapshot import LEAGUE, build_snapshot
from cloud_sync import build_records


class PublicationTests(unittest.TestCase):
    def setUp(self):
        self.now = datetime.now(timezone.utc)

        self.data = {
            'league': {'league_id': LEAGUE},
            'generated_at': self.now.isoformat(),
            'all_rosters': [
                {
                    'team_id': str(i),
                    'team_name': 'Desert Rats' if i == 0 else f'Test team {i}',
                    'players': [
                        {
                            'player_id': f'fixture-{i}',
                            'name': f'Fixture Player {i}',
                            'eligible_positions': ['SP'],
                            'roster_status': 'ACTIVE',
                        }
                    ],
                }
                for i in range(12)
            ],
            'standings': [
                {
                    'team_id': str(i),
                    'raw': {
                        'points': '1-0-0',
                        'totalPointsFor': i,
                    },
                }
                for i in range(12)
            ],
        }

        teams, players = build_records(self.data)

        self.data['pool'] = []

        for i, p in enumerate(players):
            self.data['pool'].append(
                {
                    'fantraxId': p['Player ID'],
                    'name': f'Verified Fixture Player {i}',
                    'mlbTeam': 'TST',
                    'availability': (
                        'DESERT RATS'
                        if p['Fantasy Team ID'] == '0'
                        else 'OTHER TEAM'
                    ),
                    'positions': 'SP',
                    'teamId': p['Fantasy Team ID'],
                    'teamName': teams[i]['Team'],
                    'sourceStatus': 'T',
                }
            )

        self.data['transactions'] = None

    def build(self):
        return build_snapshot(self.data, self.now)

    def test_verified_fantrax_name_published(self):
        result = self.build()

        self.assertEqual(
            result['players'][0]['Player'],
            'Verified Fixture Player 0',
        )
        self.assertEqual(
            result['players'][0]['MLB Team'],
            'TST',
        )
        self.assertEqual(
            result['source'],
            'Fantrax REST API · getPlayerIds verified names',
        )
        self.assertEqual(
            result['generated_at'],
            self.data['generated_at'],
        )

    def test_unverified_roster_name_rejected(self):
        self.data['pool'][0]['name'] = 'Name unavailable'

        with self.assertRaises(ValueError):
            self.build()

    def test_pool_ownership_mismatch_rejected(self):
        self.data['pool'][0]['teamId'] = '1'
        self.data['pool'][0]['teamName'] = 'Test team 1'
        self.data['pool'][0]['availability'] = 'OTHER TEAM'

        with self.assertRaises(ValueError):
            self.build()

    def test_empty_roster_rejected(self):
        self.data['all_rosters'][0]['players'] = []

        with self.assertRaises(ValueError):
            self.build()

    def test_missing_standings_rejected(self):
        self.data['standings'].pop()

        with self.assertRaises(ValueError):
            self.build()

    def test_duplicate_standings_rejected(self):
        self.data['standings'][0] = self.data['standings'][1]

        with self.assertRaises(ValueError):
            self.build()

    def test_stale_and_future_rejected(self):
        for delta in (-3, 1):
            with self.subTest(delta=delta):
                self.data['generated_at'] = (
                    self.now + timedelta(hours=delta)
                ).isoformat()

                with self.assertRaises(ValueError):
                    self.build()

    def test_missing_metrics_not_carried_forward(self):
        self.data['standings'][0]['raw'] = {}

        result = self.build()

        self.assertNotIn('Points', result['teams'][0])
        self.assertNotIn('Record', result['teams'][0])

    def test_unavailable_fields_are_explicit(self):
        result = self.build()

        self.assertIn('matchup_scores', result['unavailable'])
        self.assertIn('starts_used', result['unavailable'])
        self.assertIn('injury_details', result['unavailable'])
        self.assertIn('pitcher_ratings', result['unavailable'])
        self.assertIn('transactions', result['unavailable'])


if __name__ == '__main__':
    unittest.main()
