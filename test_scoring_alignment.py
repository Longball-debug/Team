import unittest
from add_recent_14d_stats import hitter_points, pitcher_points
from mlb_pitcher_logs import longball_points

class ScoringAlignmentTests(unittest.TestCase):
    def test_triple_and_additive_intentional_walk(self):
        self.assertEqual(hitter_points({'hits':1,'triples':1}),4)
        self.assertEqual(hitter_points({'baseOnBalls':1,'intentionalWalks':1}),2)

    def test_supported_pitching_categories_match_in_both_calculators(self):
        base={'inningsPitched':'1.0','gamesStarted':1,'gamesPitched':1}
        for field,weight in [('completeGames',2),('hitBatsmen',-1),('homeRuns',-2),('pickoffs',1),('shutouts',2)]:
            with self.subTest(field=field):
                value={**base,field:1}
                self.assertEqual(pitcher_points(value),2+weight)
                self.assertEqual(longball_points(value),2+weight)

    def test_combined_supported_events_do_not_replace_basic_scoring(self):
        stat={'inningsPitched':'6.0','gamesStarted':1,'gamesPitched':1,'qualityStarts':1,
              'strikeOuts':4,'earnedRuns':2,'hits':5,'baseOnBalls':1,
              'homeRuns':1,'hitBatsmen':1,'pickoffs':1,'wins':1}
        self.assertEqual(pitcher_points(stat),19)
        self.assertEqual(longball_points(stat),19)

if __name__=='__main__': unittest.main()
