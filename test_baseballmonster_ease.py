import unittest

from add_baseballmonster_ease import parse_html


class BaseballMonsterEaseTest(unittest.TestCase):
    def test_parses_and_ranks_hitter_and_pitcher_tables(self):
        teams = ["ARI","ATL","BAL","BOS","CHC","CHW","CIN","CLE","COL","DET","HOU","KC","LAA","LAD","MIA","MIL","MIN","NYM","NYY","OAK","PHI","PIT","SD","SEA","SF","STL","TB","TEX","TOR","WAS"]
        def table(mult):
            rows = ''.join(f"<tr><td>vs {t}</td><td>70</td><td>{mult * (30-i):.2f}</td></tr>" for i,t in enumerate(teams))
            return "<table><tr><th>Team</th><th>G</th><th>Value</th></tr>"+rows+"</table>"
        html = "<h3>Easiest for hitters to play against</h3>"+table(0.1)+"<h3>Easiest for pitchers to play against</h3>"+table(0.2)
        parsed = parse_html(html)
        self.assertEqual(len(parsed["hitters"]), 30)
        self.assertEqual(len(parsed["pitchers"]), 30)
        self.assertEqual(parsed["hitters"]["ARI"]["rank"], 1)
        self.assertEqual(parsed["hitters"]["WSN"]["rank"], 30)
        self.assertIn("ATH", parsed["hitters"])
        self.assertIn("KCR", parsed["hitters"])


if __name__ == "__main__":
    unittest.main()
