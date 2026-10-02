import unittest

from add_statcast_expected import attach_expected, parse_expected_csv


class StatcastExpectedTests(unittest.TestCase):
    def test_parses_expected_statistics_with_source_names_and_ids(self):
        csv_text = (
            '"last_name, first_name",player_id,year,est_ba,est_slg,est_woba\n'
            '"Judge, Aaron",592450,2026,0.258,0.569,0.396\n'
        )
        self.assertEqual(parse_expected_csv(csv_text, minimum_records=1)[0], {
            'savantId': '592450', 'name': 'Aaron Judge', 'xba': 0.258, 'xslg': 0.569, 'xwoba': 0.396,
        })

    def test_preserves_blank_expected_metrics(self):
        csv_text = (
            '"last_name, first_name",player_id,year,est_ba,est_slg,est_woba\n'
            '"Example, Hitter",123456,2026,,,\n'
        )
        row = parse_expected_csv(csv_text, minimum_records=1)[0]
        self.assertEqual((row['xba'], row['xslg'], row['xwoba']), (None, None, None))

    def test_stable_savant_id_preferred_and_ambiguous_name_left_blank(self):
        snapshot = {'statcast2026': {'source': 'Baseball Savant', 'season': 2026}, 'pool': [
            {'fantraxId': '1', 'name': 'Different Name', 'positions': 'OF', 'statcast2026': {'savantId': '592450', 'exitVelocity': 94.0}},
            {'fantraxId': '2', 'name': 'Jose Ramirez', 'positions': '3B', 'statcast2026': {'savantId': 'a'}},
            {'fantraxId': '3', 'name': 'José Ramírez', 'positions': '3B', 'statcast2026': {'savantId': 'b'}},
        ]}
        records = [
            {'savantId': '592450', 'name': 'Aaron Judge', 'xba': .258, 'xslg': .569, 'xwoba': .396},
            {'savantId': '608324', 'name': 'Jose Ramirez', 'xba': .270, 'xslg': .450, 'xwoba': .350},
        ]
        attach_expected(snapshot, records, '2026-10-02T00:00:00Z')
        self.assertEqual(snapshot['pool'][0]['statcast2026']['exitVelocity'], 94.0)
        self.assertEqual(snapshot['pool'][0]['statcast2026']['xwoba'], .396)
        self.assertNotIn('xba', snapshot['pool'][1]['statcast2026'])
        self.assertNotIn('xba', snapshot['pool'][2]['statcast2026'])
        summary = snapshot['statcast2026']['expected_statistics']
        self.assertEqual((summary['matched_pool_players'], summary['ambiguous_name_matches']), (1, 1))


if __name__ == '__main__':
    unittest.main()
