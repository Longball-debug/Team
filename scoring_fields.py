"""Source availability checks: an explicit numeric zero is not a missing field."""
import math,re

HITTER_FIELDS=('hits','doubles','triples','homeRuns','rbi','runs','stolenBases','baseOnBalls','strikeOuts','hitByPitch','sacFlies','sacBunts','groundIntoDoublePlay','caughtStealing','intentionalWalks')
PITCHER_FIELDS=('strikeOuts','earnedRuns','hits','baseOnBalls','wins','losses','saves','holds','blownSaves','completeGames','hitBatsmen','homeRuns','pickoffs','shutouts','gamesStarted')

def source_number(stat,key):
    value=stat.get(key)
    if value is None or value=='' or isinstance(value,bool): return None
    try:
        number=float(value)
        return number if math.isfinite(number) and number>=0 else None
    except (TypeError,ValueError): return None

def missing_fields(stat,group,aggregate=True):
    keys=HITTER_FIELDS if group=='hitting' else PITCHER_FIELDS
    missing=[key for key in keys if source_number(stat,key) is None]
    if group=='pitching':
        if not re.fullmatch(r'\d+(?:\.[012])?',str(stat.get('inningsPitched',''))): missing.append('inningsPitched')
        if aggregate:
            if source_number(stat,'gamesPitched') is None and source_number(stat,'gamesPlayed') is None: missing.append('gamesPitched/gamesPlayed')
            if source_number(stat,'gamesStarted') != 0 and source_number(stat,'qualityStarts') is None: missing.append('qualityStarts')
    return missing

def games_count(stat,group):
    keys=('gamesPitched','gamesPlayed') if group=='pitching' else ('gamesPlayed',)
    for key in keys:
        if key in stat:
            value=source_number(stat,key)
            return int(value) if value is not None and value.is_integer() else None
    return None
