"""Separate current 2027 keeper ownership from archived 2026 baseball performance."""
import argparse,json
from collections import Counter
from datetime import datetime,timezone
from pathlib import Path
from fantrax_refresh import api_get,summarize_all_rosters
from cloud_sync import build_records
from shared_snapshot import build_pool,validate_shared
from player_identity import attach_identities
from add_recent_14d_stats import fetch_json
LEAGUE='n81gfju2muo8y07b'
METRICS=[key+str(days) for days in (7,14,30) for key in ('points','games','ppg')]+['seasonMetrics','statcast2026']

def build_keeper(info,rosters,catalogue,archive,people,mlb_teams):
    if str(info.get('seasonYear'))!='2027':raise ValueError('Wrong keeper season')
    pool=build_pool(info,rosters,catalogue,allow_empty_rosters=True)
    stamp=datetime.now(timezone.utc).isoformat()
    normalized={'league':{'league_id':LEAGUE},'generated_at':stamp,'standings':[],
                'all_rosters':summarize_all_rosters(rosters,info,catalogue),'pool':pool,'transactions':None}
    teams,players=build_records(normalized,allow_empty_players=True)
    if len(teams)!=12 or len({t['Team ID'] for t in teams})!=12:raise ValueError('Incomplete keeper league')
    teams=[{k:t[k] for k in ('Team','Team ID')} for t in teams]
    players=[{k:p[k] for k in ('Player ID','Fantasy Team ID','Positions','Status') if k in p} for p in players]
    validate_shared(normalized,players,teams)
    by_id={p['fantraxId']:p for p in pool}
    for p in players:
        identity=by_id[p['Player ID']]
        if identity['name']=='Name unavailable':raise ValueError('Unverified keeper name')
        p['Player']=identity['name'];p['MLB Team']=identity['mlbTeam']
    data={'schema_version':1,'league_id':LEAGUE,'roster_phase':'keeper','research_only':True,'statistics_season':2026,
          'generated_at':stamp,'source':'Current LONGBALL 2027 keeper roster/availability; dated 2026 MLB research statistics; partial configured 2027 scoring. Fantrax REST API',
          'teams':teams,'players':players,'pool':pool,'transactions':None,
          'unavailable':['transactions','matchup_scores','starts_used','injury_details','2027_performance','applied_rp_scoring']}
    attach_identities(data,people,mlb_teams)
    source_counts=Counter(p.get('mlbId') for p in archive['pool'] if p.get('mlbId'))
    source={p['mlbId']:p for p in archive['pool'] if p.get('identityStatus')=='Verified' and source_counts[p.get('mlbId')]==1}
    for p in pool:
        previous=source.get(p.get('mlbId')) if p.get('identityStatus')=='Verified' else None
        if previous:
            for key in METRICS:
                if key in previous:p[key]=previous[key]
    for key in ('recent_14d','player_lab','historical_stats_period'):
        if archive.get(key):data[key]=dict(archive[key])
    for key in ('recent_14d','player_lab'):
        if key in data:data[key]['matched_pool_players']=sum(any(p.get(k) is not None for k in METRICS) for p in pool)
    return data

def main():
    ap=argparse.ArgumentParser();ap.add_argument('--archive',type=Path,required=True);ap.add_argument('--output',type=Path,required=True);args=ap.parse_args()
    archive=json.loads(args.archive.read_text())
    if archive.get('league_id')!='gxq8uqpqmg5m5edj':raise ValueError('Wrong archive; ownership must stay separate')
    info=api_get('getLeagueInfo',{'leagueId':LEAGUE});rosters=api_get('getTeamRosters',{'leagueId':LEAGUE});catalogue=api_get('getPlayerIds',{'sport':'MLB'})
    people=fetch_json('sports/1/players',{'season':2026,'hydrate':'currentTeam'}).get('people',[])
    teams=fetch_json('teams',{'sportId':1,'season':2026}).get('teams',[])
    if not people or not teams:raise ValueError('Official identity catalogue unavailable')
    result=build_keeper(info,rosters,catalogue,archive,people,teams)
    args.output.write_text(json.dumps(result,ensure_ascii=False,allow_nan=False)+'\n')
    rats=next(t['Team ID'] for t in result['teams'] if t['Team'].strip().lower()=='desert rats')
    print('Published separate 2027 keeper research snapshot:',sum(p['Fantasy Team ID']==rats for p in result['players']),'Desert Rats keepers; no 2026 ownership merged.')
if __name__=='__main__':main()
