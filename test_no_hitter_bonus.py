import unittest
from mlb_pitcher_logs import longball_points
from scoring_test_fixtures import PITCHER_ZERO

class NoHitterBonusTests(unittest.TestCase):
    def test_official_snell_game_replay_adds_configured_bonus(self):
        stat={**PITCHER_ZERO,'gamesPlayed':1,'gamesStarted':1,'inningsPitched':'9.0',
              'strikeOuts':11,'baseOnBalls':3,'wins':1,'completeGames':1,'shutouts':1}
        self.assertEqual(longball_points(stat),52)

    def test_shortened_hitless_game_does_not_receive_bonus(self):
        stat={**PITCHER_ZERO,'gamesPlayed':1,'gamesStarted':1,'inningsPitched':'7.0','completeGames':1,'shutouts':1}
        self.assertEqual(longball_points(stat),23)

    def test_combined_contribution_does_not_receive_individual_bonus(self):
        stat={**PITCHER_ZERO,'gamesPlayed':1,'gamesStarted':1,'inningsPitched':'6.0'}
        self.assertEqual(longball_points(stat),17)

    def test_missing_hit_count_withholds_total(self):
        stat={**PITCHER_ZERO,'gamesPlayed':1,'gamesStarted':1,'inningsPitched':'9.0','completeGames':1}
        del stat['hits']
        self.assertIsNone(longball_points(stat))

if __name__=='__main__':unittest.main()
