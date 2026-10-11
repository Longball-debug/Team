import unittest
from unittest.mock import patch
from player_identity import attach_identities
from add_player_lab_stats import recent_map,season_map
from add_statcast_exit_velocity import attach_records

class IdentityTests(unittest.TestCase):
    def test_duplicate_name_resolves_only_unique_verified_team(self):
        pool=[{'fantraxId':'a','name':'Max Muncy','mlbTeam':'LAD'}, {'fantraxId':'b','name':'Max Muncy','mlbTeam':'ATH'}, {'fantraxId':'c','name':'Max Muncy','mlbTeam':'(N/A)'}]
        people=[{'id':1,'fullName':'Max Muncy','currentTeam':{'id':10}}, {'id':2,'fullName':'Max Muncy','currentTeam':{'id':20}}]
        attach_identities({'pool':pool},people,[{'id':10,'abbreviation':'LAD'},{'id':20,'abbreviation':'ATH'}])
        self.assertEqual([p.get('mlbId') for p in pool],[1,2,None])
        self.assertEqual(pool[2]['identityStatus'],'Not verified')

    def test_same_team_duplicate_stays_unverified(self):
        pool=[{'fantraxId':x,'name':'Same Name','mlbTeam':'LAD','mlbId':999} for x in ['a','b']]
        attach_identities({'pool':pool},[{'id':1,'fullName':'Same Name','currentTeam':{'id':10}}],[{'id':10,'abbreviation':'LAD'}])
        self.assertTrue(all('mlbId' not in p for p in pool))

    def test_duplicate_mlb_names_keep_distinct_id_statistics(self):
        splits=[{'player':{'id':i,'fullName':'Max Muncy'},'stat':{'gamesPlayed':1,'hits':i,'atBats':4}} for i in [1,2]]
        with patch('add_player_lab_stats.stat_splits',return_value=splits):
            result=recent_map('hitting','2026-01-01','2026-01-02')
        self.assertIsNone(result['maxmuncy'])
        self.assertEqual(result['mlb:1']['points'],1.5)
        self.assertEqual(result['mlb:2']['points'],3)

    def test_statcast_does_not_override_conflicting_mlb_id_by_name(self):
        player={'fantraxId':'a','name':'Max Muncy','positions':'3B','mlbId':1,'identityStatus':'Verified'}
        record={'savantId':'2','name':'Max Muncy','exitVelocity':90,'hardHitPct':40,'barrelPct':10}
        attach_records({'pool':[player]},[record])
        self.assertNotIn('statcast2026',player)

if __name__=='__main__':unittest.main()
