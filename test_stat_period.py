import unittest
from unittest.mock import patch
from datetime import date
from stat_period import statistics_end
class StatisticalPeriodTests(unittest.TestCase):
    def test_historical_windows_exclude_postseason_and_cancelled_games(self):
        s={'league_id':'gxq8uqpqmg5m5edj','source':'Historical LONGBALL 2026 roster/ownership'}
        payload={'dates':[{'date':'2026-09-27','games':[{'gameType':'R','status':{'codedGameState':'F'}}]},
                          {'date':'2026-09-28','games':[{'gameType':'R','status':{'codedGameState':'C'}}]},
                          {'date':'2026-10-28','games':[{'gameType':'W','status':{'codedGameState':'F'}}]}]}
        with patch('stat_period._get',return_value=payload) as get:
            self.assertEqual(statistics_end(s,date(2026,10,30)),date(2026,9,27))
            self.assertEqual(statistics_end(s,date(2026,10,30)),date(2026,9,27))
            self.assertEqual(get.call_count,1)
    def test_live_statistics_end_yesterday(self):
        self.assertEqual(statistics_end({'league_id':'n81gfju2muo8y07b'},date(2027,4,5)),date(2027,4,4))
