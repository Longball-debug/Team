import unittest
from unittest.mock import patch
from datetime import datetime
from zoneinfo import ZoneInfo
from mlb_schedule import fetch_weekly_schedule

class RegularScheduleTests(unittest.TestCase):
    def test_exhibition_and_postseason_cannot_activate_regular_schedule(self):
        teams=[{'id':i,'abbreviation':f'T{i}'} for i in range(30)]
        def game(kind,pk):
            return {'gameType':kind,'gamePk':pk,'teams':{'home':{'team':{'id':0}},'away':{'team':{'id':1}}}}
        games=[game('S',i) for i in range(30)]+[game('D',40),game('R',41)]
        def source(path,params):
            if path=='teams': return {'teams':teams}
            self.assertEqual(params['gameTypes'],'R')
            return {'dates':[{'date':'2027-03-22','games':games}]}
        with patch('mlb_schedule._get',side_effect=source):
            schedule=fetch_weekly_schedule(datetime(2027,3,22,tzinfo=ZoneInfo('America/Phoenix')))
        self.assertEqual(schedule['games_seen'],1)
        self.assertEqual([g['game_pk'] for g in schedule['teams']['T0']['2027-03-22']],[41])

if __name__=='__main__':unittest.main()
