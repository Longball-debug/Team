import unittest

from add_fic_matchups import parse_fic_html


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


if __name__ == '__main__':
    unittest.main()
