import copy
import unittest
from datetime import datetime, timezone, timedelta
from public_snapshot import LEAGUE, build_snapshot
from cloud_sync import build_records
from test_cloud_sync import FakeClient

class PublicationTests(unittest.TestCase):
    def setUp(self):
        self.now = datetime.now(timezone.utc)
        self.data = {'league': {'league_id': LEAGUE}, 'generated_at': self.now.isoformat(),
            'all_rosters': [{'team_id': str(i), 'team_name': 'Desert Rats' if i == 0 else f'Test team {i}',
                'players': [{'player_id': f'fixture-{i}', 'name': None, 'eligible_positions': ['SP'], 'roster_status': 'ACTIVE'}]} for i in range(12)],
            'standings': [{'team_id': str(i), 'raw': {'points': '1-0-0', 'totalPointsFor': i}} for i in range(12)]}
        teams, players = build_records(self.data)
        self.client = FakeClient({'Teams': [{'fields': t} for t in teams], 'Players': [{'fields': p} for p in players]})
        self.client.old['Players'][0]['fields'].update({'Player': 'Verified fixture name', 'Private notes': 'SECRET_SENTINEL'})

    def build(self):
        return build_snapshot(self.data, self.client, self.now)

    def test_allowlist_and_stable_id_name(self):
        result = self.build()
        self.assertEqual(result['players'][0]['Player'], 'Verified fixture name')
        self.assertNotIn('Player', result['players'][1])
        self.assertNotIn('SECRET_SENTINEL', str(result))
        self.assertEqual(result['generated_at'], self.data['generated_at'])

    def test_partial_refresh_rejected(self):
        self.client.old['Players'][3]['fields']['Updated At'] = (self.now-timedelta(days=1)).isoformat()
        with self.assertRaises(ValueError): self.build()

    def test_readback_membership_mismatch_rejected(self):
        self.client.old['Players'][0]['fields']['Fantasy Team ID'] = '1'
        with self.assertRaises(ValueError): self.build()

    def test_empty_roster_rejected(self):
        self.data['all_rosters'][0]['players'] = []
        with self.assertRaises(ValueError): self.build()

    def test_missing_standings_rejected(self):
        self.data['standings'].pop()
        with self.assertRaises(ValueError): self.build()

    def test_duplicate_standings_rejected(self):
        self.data['standings'][0] = self.data['standings'][1]
        with self.assertRaises(ValueError): self.build()

    def test_stale_and_future_rejected(self):
        for delta in (-3, 1):
            with self.subTest(delta=delta):
                self.data['generated_at'] = (self.now+timedelta(hours=delta)).isoformat()
                with self.assertRaises(ValueError): self.build()

    def test_duplicate_airtable_identity_rejected(self):
        self.client.old['Players'].append(copy.deepcopy(self.client.old['Players'][0]))
        with self.assertRaises(ValueError): self.build()

    def test_departed_membership_rejected(self):
        self.client.old['Players'].append({'fields': {'League ID': LEAGUE, 'Player ID': 'departed', 'Fantasy Team ID': '0'}})
        with self.assertRaises(ValueError): self.build()

    def test_missing_metrics_not_carried_from_airtable(self):
        self.data['standings'][0]['raw'] = {}
        result = self.build()
        self.assertNotIn('Points', result['teams'][0])
        self.assertNotIn('Record', result['teams'][0])

if __name__ == '__main__': unittest.main()
