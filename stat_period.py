"""Historical research windows end at the last completed regular-season game.
The collection timestamp is never changed by this choice of statistical period.
"""
from datetime import datetime,timedelta,date
from zoneinfo import ZoneInfo
from mlb_schedule import _get

def statistics_end(snapshot,today=None):
    today=today or datetime.now(ZoneInfo('America/Phoenix')).date()
    previous=today-timedelta(days=1)
    if snapshot.get('league_id')!='gxq8uqpqmg5m5edj' or not str(snapshot.get('source','')).startswith('Historical LONGBALL 2026'):
        return previous
    cached=snapshot.get('historical_stats_period',{})
    if cached.get('season')==2026 and cached.get('source')=='MLB Stats API completed regular-season schedule':
        result=date.fromisoformat(cached['end_date'])
        if result<=previous and result.year==2026:return result
        raise ValueError('Invalid historical statistics date')
    payload=_get('schedule',{'sportId':1,'season':2026,'gameTypes':'R'})
    completed=[date.fromisoformat(day['date']) for day in payload.get('dates',[]) for game in day.get('games',[])
               if game.get('gameType')=='R' and game.get('status',{}).get('codedGameState')=='F' and date.fromisoformat(day['date'])<=previous]
    if not completed:raise ValueError('No verified completed 2026 regular-season games')
    end=max(completed)
    snapshot['historical_stats_period']={'season':2026,'end_date':end.isoformat(),'source':'MLB Stats API completed regular-season schedule'}
    return end
