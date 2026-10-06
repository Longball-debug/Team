import unittest
from unittest.mock import patch

from mlb_pitcher_logs import collect_pitcher_logs


class PitcherIdentityTests(unittest.TestCase):
    def test_duplicate_mlb_names_are_rejected_not_guessed(self):
        snapshot = {
            "teams": [{"Team": "Desert Rats", "Team ID": "rats"}],
            "players": [{
                "Player ID": "fx-1",
                "Fantasy Team ID": "rats",
                "Player": "Same Name",
                "Positions": "SP",
            }],
        }
        duplicate_catalogue = {
            "samename": [
                {"id": 101, "fullName": "Same Name"},
                {"id": 202, "fullName": "Same Name"},
            ]
        }
        with patch("mlb_pitcher_logs._all_mlb_players", return_value=duplicate_catalogue):
            result = collect_pitcher_logs(snapshot)
        item = result["players"]["Same Name"]
        self.assertEqual(item["fantrax_id"], "fx-1")
        self.assertEqual(item["identity_status"], "AMBIGUOUS")
        self.assertEqual(item["source_status"], "NOT VERIFIED")
        self.assertEqual(item["games"], [])

    def test_unique_mlb_name_retains_fantrax_identity(self):
        snapshot = {
            "teams": [{"Team": "Desert Rats", "Team ID": "rats"}],
            "players": [{
                "Player ID": "fx-9",
                "Fantasy Team ID": "rats",
                "Player": "Unique Pitcher",
                "Positions": "SP",
            }],
        }
        catalogue = {"uniquepitcher": [{"id": 999, "fullName": "Unique Pitcher"}]}
        split = {
            "date": "2026-09-20",
            "opponent": {"abbreviation": "LAD"},
            "stat": {
                "gamesStarted": 1,
                "inningsPitched": "6.0",
                "strikeOuts": 7,
                "earnedRuns": 2,
                "hits": 5,
                "baseOnBalls": 1,
                "wins": 1,
                "losses": 0,
                "saves": 0,
                "holds": 0,
                "blownSaves": 0,
            },
        }
        with patch("mlb_pitcher_logs._all_mlb_players", return_value=catalogue), patch("mlb_pitcher_logs._game_log", return_value=[split]):
            result = collect_pitcher_logs(snapshot)
        item = result["players"]["Unique Pitcher"]
        self.assertEqual(item["fantrax_id"], "fx-9")
        self.assertEqual(item["identity_status"], "VERIFIED")
        self.assertEqual(item["mlb_id"], 999)
        self.assertEqual(item["source_status"], "VERIFIED")


if __name__ == "__main__":
    unittest.main()
