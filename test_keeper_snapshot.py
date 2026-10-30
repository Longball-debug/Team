import unittest
from copy import deepcopy
from keeper_snapshot import build_keeper
from shared_snapshot import build_pool
class KeeperSnapshotTests(unittest.TestCase):
    def fixtures(self):
        rosters={'rosters':{str(i):{'teamName':'Desert Rats' if i==0 else 'Team '+str(i),'rosterItems':[{'id':'p'+str(i),'position':'SP','status':'ACTIVE'}]} for i in range(12)}}
        info={'seasonYear':2027,'playerInfo':{'p'+str(i):{'status':'T','eligiblePos':'SP'} for i in range(12)}}
        catalogue={'p'+str(i):{'name':'Pitcher '+str(i),'fantraxId':'p'+str(i),'team':'TST'} for i in range(12)}
        return info,rosters,catalogue
    def test_empty_keeper_team_is_valid_without_fabricated_standings(self):
        info,rosters,catalogue=self.fixtures();rosters['rosters']['0']['rosterItems']=[]
        result=build_keeper(info,rosters,catalogue,{'pool':[]},[],[])
        self.assertEqual(result['league_id'],'n81gfju2muo8y07b');self.assertEqual(result['roster_phase'],'keeper')
        self.assertFalse(any(p['Fantasy Team ID']=='0' for p in result['players']))
        self.assertFalse(any('Record' in t or 'Points' in t for t in result['teams']))
        with self.assertRaises(ValueError):build_pool(info,rosters,catalogue)
    def test_all_zero_keepers_are_valid_only_in_explicit_keeper_contract(self):
        info,rosters,catalogue=self.fixtures()
        for team in rosters['rosters'].values():team['rosterItems']=[]
        result=build_keeper(info,rosters,catalogue,{'pool':[]},[],[])
        self.assertEqual(result['players'],[]);self.assertEqual(len(result['teams']),12)
    def test_historical_ownership_is_never_copied(self):
        info,rosters,catalogue=self.fixtures()
        archive={'pool':[{'fantraxId':'old-only','mlbId':9,'identityStatus':'Verified','teamName':'Desert Rats','ppg14':99}]}
        result=build_keeper(info,rosters,catalogue,archive,[],[])
        self.assertNotIn('old-only',[p['fantraxId'] for p in result['pool']])
        self.assertTrue(all('ppg14' not in p for p in result['pool']))
    def test_conflicting_current_ownership_fails_closed(self):
        info,rosters,catalogue=self.fixtures();rosters['rosters']['1']['rosterItems']=deepcopy(rosters['rosters']['0']['rosterItems'])
        with self.assertRaises(ValueError):build_keeper(info,rosters,catalogue,{'pool':[]},[],[])
