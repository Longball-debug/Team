"""Exact normalized-event scorer for every configured Fantrax 2027 category.
Adapters may supply only supported events. Missing events never mean zero.
The legacy MLB calculators remain explicitly partial models.
"""
import json
import math
from pathlib import Path
CONFIG = json.loads((Path(__file__).parent/'public/scoring-model.json').read_text())
WEIGHTS = {group:{code:{role:float(value.removeprefix('points')) for role,value in roles.items()}
                  for code,roles in categories.items()} for group,categories in CONFIG['categories'].items()}

def score_events(events, group, decision_role=None):
    """All counts must be verified; IP is actual innings (outs/3), not baseball .1/.2.

    decision_role must be 'Default' or 'RP' for a nonzero W/L event. It is
    provided by verified Fantrax lineup/scoring evidence, never eligibility.
    """
    rules=WEIGHTS[group]
    missing=[]; total=0.0; components={}
    for code,roles in rules.items():
        count=events.get(code)
        if isinstance(count,bool) or not isinstance(count,(int,float)) or not math.isfinite(count) or count<0:
            missing.append(code); continue
        if (code!='IP' and count!=int(count)) or (code=='IP' and abs(count*3-round(count*3))>1e-8):
            missing.append(code); continue
        role='Default'
        if len(roles)>1 and count:
            if decision_role not in roles:
                missing.append(code+': Fantrax decision role'); continue
            role=decision_role
        components[code]=count*roles[role]; total+=components[code]
    return {'points':round(total,4) if not missing else None,
            'supported_subtotal':round(total,4),'missing':missing,'components':components,
            'status':'complete configured model' if not missing else 'partial model'}

def cycle_from_game(stat):
    fields=('hits','doubles','triples','homeRuns')
    values=[stat.get(k) for k in fields]
    if any(isinstance(x,bool) or not isinstance(x,int) or x<0 for x in values): return None
    hits,doubles,triples,homers=values
    singles=hits-doubles-triples-homers
    if singles<0: return None
    return int(singles>=1 and doubles>=1 and triples>=1 and homers>=1)
