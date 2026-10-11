import unittest
from unittest.mock import patch
from add_pitcherlist import ArchiveParser,attach,_heading_date
from add_baseballmonster_ease import parse_html

class ExternalReliabilityTests(unittest.TestCase):
    def test_relative_pitcherlist_links_are_resolved_and_foreign_hosts_rejected(self):
        p=ArchiveParser();p.feed('<a href="/starting-pitcher-streamer-ranks-9-27/">PL</a><a href="https://evil.example/starting-pitcher-streamer-ranks-9-27/">bad</a>')
        self.assertEqual(p.links,['https://pitcherlist.com/starting-pitcher-streamer-ranks-9-27/'])

    def test_out_of_week_articles_are_not_requested(self):
        with patch('add_pitcherlist._fetch',return_value='<a href="/starting-pitcher-streamer-ranks-9-27/">PL</a>') as fetch:
            result=attach({'weekly_schedule':{'days':['2026-10-05','2026-10-06']}})
        self.assertEqual(fetch.call_count,1)
        self.assertEqual(result['pitcher_list']['status'],'unavailable')
        self.assertIn('stale articles excluded',result['pitcher_list']['reason'])

    def test_invalid_heading_dates_are_rejected(self):
        self.assertIsNone(_heading_date('9/31 Starting Pitcher Rankings',2026))

    def test_baseballmonster_nested_wrapper_and_optional_row_end_tags(self):
        teams=['ARI','ATL','BAL','BOS','CHC','CHW','CIN','CLE','COL','DET','HOU','KC','LAA','LAD','MIA','MIL','MIN','NYM','NYY','OAK','PHI','PIT','SD','SEA','SF','STL','TB','TEX','TOR','WAS']
        def table(mult):
            return '<table><tr><th>vs Team</th><th>G</th><th>Value</th></tr>'+''.join(f'<tr><td>vs {t}</td><td>162</td><td>{mult*(30-i)}</td>' for i,t in enumerate(teams))+'</table>'
        html='<table><tr><td><b>Easiest for hitters to play against</b>'+table(1)+'</td><td><b>Easiest for pitchers to play against</b>'+table(2)+'</td></tr></table>'
        result=parse_html(html)
        self.assertEqual(len(result['hitters']),30)
        self.assertEqual(len(result['pitchers']),30)
        self.assertEqual(result['hitters']['ARI']['rank'],1)
        self.assertEqual(result['pitchers']['WSN']['rank'],30)

if __name__=='__main__':unittest.main()
