import copy
import unittest
from cloud_sync import build_records, sync

DATA = {"league": {"league_id": "league"}, "generated_at": "2026-09-07T12:00:00+00:00",
    "standings": [{"team_id": "team", "raw": {"points": "14-5-0", "totalPointsFor": 8371.33}}],
    "all_rosters": [{"team_id": "team", "team_name": "Desert Rats", "players": [
        {"player_id": "player", "name": None, "eligible_positions": ["SP"], "roster_status": "ACTIVE"}]}]}

class FakeClient:
    def __init__(self, old=None):
        self.old = old or {}
        self.writes = []
    def records(self, table):
        return self.old.get(table, [])
    def upsert(self, table, rows, key):
        self.writes.append((table, rows, key))

class SyncTests(unittest.TestCase):
    def test_record_is_not_numeric_points(self):
        teams, players = build_records(DATA)
        self.assertEqual(teams[0]["Points"], 8371.33)
        self.assertEqual(teams[0]["Record"], "14-5-0")
        self.assertNotIn("Player", players[0])
        self.assertNotIn("FAAB", teams[0])

    def test_duplicate_player_fails_before_writes(self):
        data = copy.deepcopy(DATA)
        data["all_rosters"][0]["players"] *= 2
        client = FakeClient()
        with self.assertRaises(ValueError):
            sync(client, data)
        self.assertEqual(client.writes, [])

    def test_departed_player_clears_membership_only(self):
        client = FakeClient({"Players": [{"fields": {"League ID": "league", "Player ID": "departed"}}]})
        sync(client, DATA)
        departed = client.writes[1][1][-1]
        self.assertEqual(departed["Fantasy Team ID"], "")
        self.assertEqual(departed["Status"], "Not rostered")
        self.assertNotIn("Player", departed)

    def test_newer_airtable_snapshot_blocks_all_writes(self):
        client = FakeClient({"Teams": [{"fields": {"League ID": "league", "Updated At": "2026-09-08T00:00:00+00:00"}}]})
        with self.assertRaises(ValueError):
            sync(client, DATA)
        self.assertEqual(client.writes, [])

if __name__ == "__main__":
    unittest.main()
