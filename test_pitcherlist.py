import unittest

from add_pitcherlist import parse_article


class PitcherListParserTests(unittest.TestCase):
    def test_parses_rank_tier_and_date(self):
        source = '''
        <h3>Tuesday 9/29 Starting Pitcher Streamer Rankings</h3>
        <table>
          <tr><th>Rank</th><th>Pitcher</th><th>Matchup</th></tr>
          <tr><td></td><td>Auto Start</td><td></td></tr>
          <tr><td>1</td><td>Logan Webb</td><td>vs. COL</td></tr>
          <tr><td></td><td>Questionable Start</td><td></td></tr>
          <tr><td>12</td><td>Shane Baz</td><td>@ BOS</td></tr>
        </table>
        '''
        rows = parse_article(source, 2026, 'https://pitcherlist.com/example/')
        self.assertEqual(rows[0]['date'], '2026-09-29')
        self.assertEqual(rows[0]['rank'], 1)
        self.assertEqual(rows[0]['pitcher'], 'Logan Webb')
        self.assertEqual(rows[0]['tier'], 'Auto Start')
        self.assertEqual(rows[1]['tier'], 'Questionable Start')


if __name__ == '__main__':
    unittest.main()
