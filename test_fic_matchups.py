import unittest
from unittest.mock import patch

from add_fic_matchups import attach, parse_fic_html


class FicParserTests(unittest.TestCase):
    def test_parses_matchup_table_and_sample_rule(self):
        source = '''
        <table>
          <tr><th>Batter</th><th></th><th>Pitcher</th><th>Game</th><th>HRF</th><th>qAB</th><th>HH%</th><th>AB</th><th>H</th><th>2B/3B</th><th>HR</th><th>BB</th><th>BA</th><th>OBP</th><th>OPS</th></tr>
          <tr><td>A. Bregman, 3B (R)</td><td>L5</td><td>M. King (R) ERA 3.10</td><td>CHN SDN</td><td>1.4</td><td>90%</td><td>60%</td><td>8</td><td>7</td><td>2</td><td>0</td><td>2</td><td>.875</td><td>.900</td><td>2.025</td></tr>
        </table>
        '''
        rows = parse_fic_html(source)
        self.assertEqual(len(rows), 1)
        row = rows[0]
        self.assertEqual(row['batter_key'], 'abregman')
        self.assertEqual(row['pitcher_key'], 'mking')
        self.assertEqual(row['ab'], 8)
        self.assertEqual(row['bb'], 2)
        self.assertEqual(row['sample_pa_proxy'], 10)
        self.assertTrue(row['sample_ok'])
        self.assertAlmostEqual(row['ops'], 2.025)
        self.assertAlmostEqual(row['qAB_pct'], 90.0)
        self.assertAlmostEqual(row['hard_hit_pct'], 60.0)

    def test_ignores_non_matchup_tables(self):
        self.assertEqual(parse_fic_html('<table><tr><th>Name</th></tr><tr><td>x</td></tr></table>'), [])


    def test_attach_records_fantrax_identity_for_unique_match(self):
        snapshot = {
            "teams": [{"Team": "Desert Rats", "Team ID": "rats"}],
            "pool": [
                {"fantraxId": "fx-1", "name": "Alex Bregman", "teamId": "rats", "availability": "Rostered", "positions": ["3B"]},
            ],
        }
        source = '''
        <table>
          <tr><th>Batter</th><th>Pitcher</th><th>AB</th><th>BB</th><th>OPS</th></tr>
          <tr><td>A. Bregman, 3B (R)</td><td>M. King (R)</td><td>8</td><td>2</td><td>1.025</td></tr>
        </table>
        '''
        with patch("add_fic_matchups._lookahead_days", return_value=["2026-10-05"]), patch("add_fic_matchups._fetch_day", return_value=source):
            attach(snapshot)
        fic = snapshot["fic_matchups"]
        self.assertEqual(fic["fantrax_ids_by_name"]["Alex Bregman"], "fx-1")
        self.assertIn("Alex Bregman", fic["players"])

    def test_attach_rejects_ambiguous_duplicate_name_identity(self):
        snapshot = {
            "teams": [{"Team": "Desert Rats", "Team ID": "rats"}],
            "pool": [
                {"fantraxId": "fx-1", "name": "Alex Bregman", "teamId": "rats", "availability": "Rostered", "positions": ["3B"]},
                {"fantraxId": "fx-2", "name": "Alex Bregman", "teamId": None, "availability": "Free Agent", "positions": ["3B"]},
            ],
        }
        source = '''
        <table>
          <tr><th>Batter</th><th>Pitcher</th><th>AB</th><th>BB</th><th>OPS</th></tr>
          <tr><td>A. Bregman, 3B (R)</td><td>M. King (R)</td><td>8</td><td>2</td><td>1.025</td></tr>
        </table>
        '''
        with patch("add_fic_matchups._lookahead_days", return_value=["2026-10-05"]), patch("add_fic_matchups._fetch_day", return_value=source):
            attach(snapshot)
        fic = snapshot["fic_matchups"]
        self.assertNotIn("Alex Bregman", fic["players"])
        self.assertEqual(fic["days"]["2026-10-05"]["ambiguous_target_matches"], 1)


if __name__ == '__main__':
    unittest.main()
