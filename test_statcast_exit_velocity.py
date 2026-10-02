import unittest

from add_statcast_exit_velocity import attach_records, parse_leaderboard_csv


class StatcastExitVelocityTests(unittest.TestCase):
    def test_parses_only_the_requested_leaderboard_fields(self):
        csv_text = (
            '"last_name, first_name",player_id,avg_hit_speed,ev95percent,brl_percent,brl_pa\n'
            '"Judge, Aaron",592450,94.0,57.5,20.9,10.0\n'
        )
        row = parse_leaderboard_csv(csv_text, minimum_records=1)[0]
        self.assertEqual(row, {
            'savantId': '592450', 'name': 'Aaron Judge', 'exitVelocity': 94.0,
            'hardHitPct': 57.5, 'barrelPct': 20.9,
        })

    def test_preserves_source_blank_metrics_as_unavailable(self):
        csv_text = (
            '"last_name, first_name",player_id,avg_hit_speed,ev95percent,brl_percent\n'
            '"Example, Hitter",123456,,,\n'
        )
        row = parse_leaderboard_csv(csv_text, minimum_records=1)[0]
        self.assertEqual((row['exitVelocity'], row['hardHitPct'], row['barrelPct']), (None, None, None))

    def test_uses_unique_normalized_name_and_leaves_ambiguous_unmatched(self):
        snapshot = {'pool': [
            {'fantraxId': '1', 'name': 'Aaron Judge', 'positions': 'OF'},
            {'fantraxId': '2', 'name': 'Jose Ramirez', 'positions': '3B'},
            {'fantraxId': '3', 'name': 'José Ramírez', 'positions': '3B'},
        ]}
        records = [
            {'savantId': '592450', 'name': 'Aaron Judge', 'exitVelocity': 94.0, 'hardHitPct': 57.5, 'barrelPct': 20.9},
            {'savantId': '608324', 'name': 'Jose Ramirez', 'exitVelocity': 92.0, 'hardHitPct': 48.0, 'barrelPct': 12.0},
        ]
        attach_records(snapshot, records, '2026-10-02T00:00:00Z')
        self.assertEqual(snapshot['pool'][0]['statcast2026']['savantId'], '592450')
        self.assertNotIn('statcast2026', snapshot['pool'][1])
        self.assertNotIn('statcast2026', snapshot['pool'][2])
        self.assertEqual(snapshot['statcast2026']['matched_pool_players'], 1)
        self.assertEqual(snapshot['statcast2026']['ambiguous_name_matches'], 1)

    def test_stable_id_is_preferred_to_a_conflicting_name(self):
        snapshot = {'pool': [
            {'fantraxId': '1', 'name': 'Other Hitter', 'positions': 'OF', 'mlbId': '592450'},
            {'fantraxId': '2', 'name': 'Aaron Judge', 'positions': 'OF'},
        ]}
        attach_records(snapshot, [
            {'savantId': '592450', 'name': 'Aaron Judge', 'exitVelocity': 94.0, 'hardHitPct': 57.5, 'barrelPct': 20.9},
        ])
        self.assertEqual(snapshot['pool'][0]['statcast2026']['savantId'], '592450')
        self.assertNotIn('statcast2026', snapshot['pool'][1])


if __name__ == '__main__':
    unittest.main()
