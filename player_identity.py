"""Verified MLBAM links; vendor IDs are never interpreted as MLBAM IDs."""
import argparse,json,re,unicodedata
from collections import defaultdict
from pathlib import Path
from add_recent_14d_stats import fetch_json

def exact_name(value):
    text=unicodedata.normalize('NFD',str(value or '')).lower()
    return re.sub(r'[^a-z0-9]','', ''.join(c for c in text if unicodedata.category(c)!='Mn'))

ALIASES={'AZ':'ARI','CWS':'CHW','KC':'KCR','SD':'SDP','SF':'SFG','TB':'TBR','WSH':'WSN','OAK':'ATH'}
def team_key(value):
    value=str(value or '').upper()
    return ALIASES.get(value,value)

def attach_identities(snapshot,people,teams):
    abbreviations={t['id']:team_key(t.get('abbreviation')) for t in teams}
    sources=defaultdict(list); targets=defaultdict(list)
    pool=snapshot.get('pool',[])
    for person in people:
        team=abbreviations.get(person.get('currentTeam',{}).get('id'))
        if team and isinstance(person.get('id'),int):
            sources[(exact_name(person.get('fullName')),team)].append(person)
    for player in pool:
        key=(exact_name(player.get('name')),team_key(player.get('mlbTeam')))
        targets[key].append(player)
        player.pop('mlbId',None)
        player['identityStatus']='Not verified'
    matched=0
    for key,players in targets.items():
        candidates=sources.get(key,[])
        if len(players)==1 and len(candidates)==1:
            player=players[0]
            player['mlbId']=candidates[0]['id']
            player['identityStatus']='Verified'
            player['identityMethod']='unique exact name and official current team'
            matched+=1
    snapshot['player_identity']={'source':'Fantrax names/teams + official MLB player catalogue',
        'season':2026,'matched':matched,'unresolved':len(pool)-matched,
        'rule':'Unique full name (suffix retained) and matching team on both sides. No vendor-ID conversion or ambiguous-name fallback.'}
    return snapshot

def main():
    ap=argparse.ArgumentParser();ap.add_argument('--snapshot',type=Path,default=Path('public/fantasygm.json'));args=ap.parse_args()
    snapshot=json.loads(args.snapshot.read_text(encoding='utf-8'))
    people=fetch_json('sports/1/players',{'season':2026,'hydrate':'currentTeam'}).get('people',[])
    teams=fetch_json('teams',{'sportId':1,'season':2026}).get('teams',[])
    if not people or not teams: raise ValueError('Official MLB identity catalogue unavailable')
    attach_identities(snapshot,people,teams)
    args.snapshot.write_text(json.dumps(snapshot,ensure_ascii=False,separators=(',',':')),encoding='utf-8')

if __name__=='__main__':main()
