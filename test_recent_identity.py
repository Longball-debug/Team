import unittest
from unittest.mock import patch

from add_recent_14d_stats import build_maps
from add_player_lab_stats import recent_map, season_map


def hitter_split(name, games=3):
    return {
        "player": {"fullName": name},
        "stat": {
            "gamesPlayed": games,
            "hits": 3,
            "doubles": 1,
            "triples": 0,
            "homeRuns": 1,
            "rbi": 2,
            "runs": 2,
            "stolenBases": 0,
            "baseOnBalls": 1,
            "strikeOuts": 2,
            "hitByPitch": 0,
            "sacFlies": 0,
            "sacBunts": 0,
            "groundIntoDoublePlay": 0,
            "caughtStealing": 0,
            "plateAppearances": 12,
            "atBats": 10,
            "avg": ".300",
            "obp": ".333",
            "slg": ".600",
            "ops": ".933",
        },
    }


class RecentIdentityTests(unittest.TestCase):
    def test_recent_14d_duplicate_normalized_name_is_ambiguous(self):
        with patch("add_recent_14d_stats.splits") as source:
            source.side_effect = [
                [hitter_split("Same Name"), hitter_split("Same Name")],
                [],
            ]
            hitters, pitchers = build_maps("2026-09-01", "2026-09-14")
        self.assertIsNone(hitters["samename"])
        self.assertEqual(pitchers, {})

    def test_player_lab_recent_map_rejects_duplicate_name(self):
        with patch("add_player_lab_stats.stat_splits", return_value=[hitter_split("Same Name"), hitter_split("Same Name")]):
            result = recent_map("hitting", "2026-09-01", "2026-09-07")
        self.assertIsNone(result["samename"])

    def test_player_lab_season_map_rejects_duplicate_name(self):
        with patch("add_player_lab_stats.stat_splits", return_value=[hitter_split("Same Name"), hitter_split("Same Name")]):
            result = season_map("hitting", 2026)
        self.assertIsNone(result["samename"])


if __name__ == "__main__":
    unittest.main()
