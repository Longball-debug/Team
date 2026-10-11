import unittest
from add_recent_14d_stats import hitter_points,pitcher_points
from mlb_pitcher_logs import longball_points
from scoring_test_fixtures import HITTER_ZERO,PITCHER_ZERO

class MissingFieldsTests(unittest.TestCase):
    def test_explicit_zero_is_valid(self):
        self.assertEqual(hitter_points(HITTER_ZERO),0)
        self.assertEqual(pitcher_points(PITCHER_ZERO),0)
        self.assertEqual(longball_points(PITCHER_ZERO),0)

    def test_each_missing_hitter_event_withholds_total(self):
        for field in HITTER_ZERO:
            for absent in [None,'',float('nan'),'unknown']:
                with self.subTest(field=field,value=absent):
                    self.assertIsNone(hitter_points({**HITTER_ZERO,field:absent}))

    def test_missing_pitching_event_is_not_zero(self):
        for field in ['wins','losses','homeRuns','hitBatsmen','completeGames','pickoffs','shutouts','inningsPitched','gamesStarted']:
            value={**PITCHER_ZERO};value.pop(field)
            self.assertIsNone(pitcher_points(value))
            self.assertIsNone(longball_points(value))

    def test_starter_aggregate_requires_quality_starts(self):
        value={**PITCHER_ZERO,'gamesStarted':1};value.pop('qualityStarts')
        self.assertIsNone(pitcher_points(value))
        self.assertEqual(longball_points(value),0)

if __name__=='__main__':unittest.main()
