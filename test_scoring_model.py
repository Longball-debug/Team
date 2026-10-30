import unittest
from scoring_model import score_events, WEIGHTS, cycle_from_game
class ConfiguredScoringTests(unittest.TestCase):
    def test_every_hitting_category_and_cumulative_walks(self):
        events={code:0 for code in WEIGHTS['HITTING']}
        events.update({'1B':1,'2B':1,'3B':1,'HR':1,'CYC':1,'PKO':1,'BB':1,'IBB':1})
        result=score_events(events,'HITTING')
        self.assertEqual(result['points'],19.5)
        self.assertEqual(set(result['components']),set(WEIGHTS['HITTING']))
    def test_pitcher_golden_replay_and_rp_decision(self):
        events={code:0 for code in WEIGHTS['PITCHING']}
        events.update(IP=9,K=11,BB=3,W=1,CG=1,SHO=1,QS=1,NH=1)
        self.assertEqual(score_events(events,'PITCHING','Default')['points'],52)
        self.assertIsNone(score_events(events,'PITCHING')['points'])
        events.update(IP=1,K=2,BB=0,CG=0,SHO=0,QS=0,NH=0,SVH=1)
        self.assertEqual(score_events(events,'PITCHING','RP')['points'],12)
    def test_no_invented_categories_or_missing_zeroes(self):
        self.assertNotIn('PG',WEIGHTS['PITCHING'])
        self.assertNotIn('WP',WEIGHTS['PITCHING'])
        self.assertIsNone(score_events({},'HITTING')['points'])
        for bad in [None,True,float('nan'),-1,0.5]:
            events={code:0 for code in WEIGHTS['HITTING']}; events['PKO']=bad
            self.assertIsNone(score_events(events,'HITTING')['points'])
    def test_cycle_requires_complete_single_game_line(self):
        self.assertEqual(cycle_from_game(dict(hits=4,doubles=1,triples=1,homeRuns=1)),1)
        self.assertEqual(cycle_from_game(dict(hits=4,doubles=2,triples=1,homeRuns=1)),0)
        self.assertIsNone(cycle_from_game(dict(hits=4,triples=1,homeRuns=1)))
