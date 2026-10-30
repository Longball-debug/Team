"""Read-only 2027 keeper/readiness inspection. Never replaces historical ownership."""
import argparse,json
from datetime import datetime,timezone
from pathlib import Path
from fantrax_refresh import api_get
from scoring_model import CONFIG
LEAGUE='n81gfju2muo8y07b'
def inspect():
    info=api_get('getLeagueInfo',{'leagueId':LEAGUE})
    if str(info.get('seasonYear'))!='2027': raise ValueError('Wrong season')
    scoring=info.get('scoringSystem',{}).get('scoringCategories')
    if scoring!=CONFIG['categories']: raise ValueError('Fantrax scoring changed; review model before publication')
    rosters=api_get('getTeamRosters',{'leagueId':LEAGUE}).get('rosters')
    if not isinstance(rosters,dict) or len(rosters)!=12: raise ValueError('Incomplete 2027 team roster response')
    counts=[]
    for tid,roster in rosters.items():
        if not isinstance(roster,dict) or not isinstance(roster.get('rosterItems'),list):
            raise ValueError('Roster shape not verified')
        counts.append({'team_id':tid,'players':len(roster['rosterItems'])})
    return {'league_id':LEAGUE,'season':2027,'checked_at':datetime.now(timezone.utc).isoformat(),
            'scoring_configuration':'verified','teams':len(counts),'roster_counts':counts,
            'phase':'offseason keeper rosters; reduced rosters are expected',
            'activation':'historical 2026 ownership remains separate; no automatic league switch',
            'remaining':['Applied Fantrax RP/flex decision scoring and holds-provider reconciliation require scoring examples.',
                         'Live 2027 injuries, lineup slots, starts used and outcomes need authentic 2027 feeds.',
                         'Predictive recommendation validation needs dated recommendations and later outcomes.']}
def main():
    p=argparse.ArgumentParser();p.add_argument('--output',type=Path,default=Path('public/readiness.json'));args=p.parse_args()
    result=inspect();args.output.parent.mkdir(parents=True,exist_ok=True)
    temp=args.output.with_suffix('.tmp');temp.write_text(json.dumps(result,indent=2)+'\n');temp.replace(args.output)
    print('Verified 2027 scoring and 12 keeper-roster responses. Historical ownership was not replaced.')
if __name__=='__main__':main()
