import unittest
from unittest.mock import patch
from add_rotoballer_weekly import attach, discover, inspect_article
from rotoballer_ratings import parse_ratings, sheet_csv_url

START, END = '2026-09-21', '2026-09-27'
URL = 'https://www.rotoballer.com/start-sit-pitchers-fantasy-baseball-matchups-for-9-21-9-27-2026/1'
SHEET = 'https://docs.google.com/spreadsheets/d/e/example/pubhtml?gid=123&single=true'
PITCHERS = 'Date,Game,Team,Pitcher,Grade,Start/Sit,2 Starts\n9/21,NYM@PHI,PHI,Aaron Nola,50,COIN FLIP,N\n'
HITTERS = 'Player Name ▾,Start/Sit,Weekly Score,9/21 Score,9/22 Score,9/23 Score,9/24 Score,9/25 Score,9/26 Score,9/27 Score,Team,Position\nCJ Abrams,Start,115.6,123.5,122.8,101,0,102.9,121,122.3,WSH,SS\n'


class RotoBallerTests(unittest.TestCase):
    def test_published_pitcher_format(self):
        r = parse_ratings(PITCHERS, 'pitchers', START, END)[0]
        self.assertEqual((r['date'], r['opponent'], r['rating'], r['recommendation']),
                         (START, 'NYM', 50, 'COIN FLIP'))

    def test_published_hitter_format_and_scale(self):
        r = parse_ratings(HITTERS, 'hitters', START, END)[0]
        self.assertEqual((r['team'], r['rating'], r['daily_ratings']['2026-09-24']), ('WSN', 115.6, 0))

    def test_html_table(self):
        table = '<table><tr><th>Date</th><th>Game</th><th>Team</th><th>Pitcher</th><th>Grade</th></tr><tr><td>9/21</td><td>NYM@PHI</td><td>PHI</td><td>Aaron Nola</td><td>75</td></tr></table>'
        self.assertEqual(parse_ratings(table, 'pitchers', START, END)[0]['rating'], 75)

    def test_stale_and_undated_sheets(self):
        self.assertEqual(parse_ratings(PITCHERS.replace('9/21', '9/14'), 'pitchers', START, END), [])
        self.assertEqual(parse_ratings(HITTERS.replace('9/21 Score', '9/14 Score'), 'hitters', START, END), [])
        self.assertEqual(parse_ratings(HITTERS.replace('9/21 Score', 'Monday'), 'hitters', START, END), [])

    def test_conflicts_and_invalid_scores(self):
        rows = parse_ratings(PITCHERS + '9/21,NYM@PHI,PHI,Aaron Nola,20,SIT,N\n', 'pitchers', START, END)
        self.assertEqual(rows[0]['status'], 'ambiguous')
        self.assertIsNone(rows[0]['rating'])
        for score in ('NaN', 'Infinity', '-1', '101'):
            self.assertEqual(parse_ratings(PITCHERS.replace('50,COIN FLIP', score + ',Unknown'), 'pitchers', START, END), [])

    def test_discovery_prefers_current_over_first_link(self):
        old = URL.replace('9-21-9-27', '9-14-9-20')
        self.assertEqual(discover(f'<a href="{old}"></a><a href="{URL}">', START, END)['pitchers'], URL)

    def test_stale_article_never_fetched(self):
        with patch('add_rotoballer_weekly._fetch') as fetch:
            self.assertEqual(inspect_article(URL, '2026-09-28', '2026-10-04')['status'], 'stale')
            fetch.assert_not_called()

    def test_sheet_collection(self):
        with patch('add_rotoballer_weekly._fetch', side_effect=[f'<iframe src="{SHEET}"></iframe>', PITCHERS]):
            self.assertEqual(inspect_article(URL, START, END)['ratings'][0]['rating'], 50)
        self.assertIn('/pub?', sheet_csv_url(SHEET))
        self.assertIsNone(sheet_csv_url(SHEET.replace('docs.google.com', 'evil.example')))

    def test_unavailable_and_previous_advice_cleared(self):
        data = {'weekly_schedule': {'week_start': START, 'week_end': END}, 'rotoballer_weekly': {'status': 'verified'}}
        with patch('add_rotoballer_weekly._fetch', side_effect=OSError):
            attach(data)
        self.assertEqual(data['rotoballer_weekly']['status'], 'unavailable')
        with patch('add_rotoballer_weekly._fetch', return_value='<p>No chart</p>'):
            self.assertEqual(inspect_article(URL, START, END)['status'], 'unavailable')


if __name__ == '__main__':
    unittest.main()
