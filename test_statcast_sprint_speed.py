import unittest

from add_statcast_sprint_speed import attach_sprint_speed, parse_sprint_speed_csv


class StatcastSprintSpeedTests(unittest.TestCase):
    def test_parses_player_id_and_speed_in_feet_per_second(self):
        csv_text = (
            '"last_name, first_name",player_id,team_id,sprint_speed\n'
            '"Witt Jr., Bobby",677951,118,30.1\n'
        )
        self.assertEqual(parse_sprint_speed_csv(csv_text, minimum_records=1)[0], {
            'savantId': '677951', 'name': 'Bobby Witt Jr.', 'sprintSpeed': 30.1,
        })

    def test_source_blank_is_unavailable(self):
        csv_text = (
            '"last_name, first_name",player_id,sprint_speed\n'
            '"Example, Hitter",123456,\n'
        )
        self.assertIsNone(parse_sprint_speed_csv(csv_text, minimum_records=1)[0]['sprintSpeed'])

    def test_prefers_savant_id_and_keeps_ambiguous_names_blank(self):
        snapshot = {'statcast2026': {'source': 'Baseball Savant', 'season': 2026}, 'pool': [
            {'fantraxId': '1', 'name': 'Different Name', 'positions': 'OF', 'statcast2026': {'savantId': '677951', 'exitVelocity': 92.2, 'xba': .302}},
            {'fantraxId': '2', 'name': 'Jose Ramirez', 'positions': '3B', 'statcast2026': {'savantId': 'a', 'sprintSpeed': 27.0}},
            {'fantraxId': '3', 'name': 'José Ramírez', 'positions': '3B', 'statcast2026': {'savantId': 'b', 'sprintSpeed': 28.0}},
        ]}
        records = [
            {'savantId': '677951', 'name': 'Bobby Witt Jr.', 'sprintSpeed': 30.1},
            {'savantId': '608324', 'name': 'Jose Ramirez', 'sprintSpeed': 27.8},
        ]
        attach_sprint_speed(snapshot, records, '2026-10-02T00:00:00Z')
        statcast = snapshot['pool'][0]['statcast2026']
        self.assertEqual((statcast['sprintSpeed'], statcast['exitVelocity'], statcast['xba']), (30.1, 92.2, .302))
        self.assertNotIn('sprintSpeed', snapshot['pool'][1]['statcast2026'])
        self.assertNotIn('sprintSpeed', snapshot['pool'][2]['statcast2026'])
        summary = snapshot['statcast2026']['sprint_speed']
        self.assertEqual((summary['matched_pool_players'], summary['ambiguous_name_matches']), (1, 1))


if __name__ == '__main__':
    unittest.main()
