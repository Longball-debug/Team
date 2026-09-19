"""Allowlisted Fantrax fields shared by the two existing site readers."""
import json
import urllib.request


def build_pool(info, rosters, catalogue):
    if not isinstance(info, dict) or not isinstance(info.get('playerInfo'), dict) or not info['playerInfo']:
        raise ValueError('Missing Fantrax player pool')
    if not isinstance(catalogue, dict) or not catalogue:
        raise ValueError('Missing Fantrax player catalogue')
    teams = rosters.get('rosters') if isinstance(rosters, dict) else None
    if not isinstance(teams, dict) or len(teams) != 12:
        raise ValueError('Incomplete Fantrax rosters')
    rats = [tid for tid, team in teams.items() if team.get('teamName', '').strip().lower() == 'desert rats']
    if len(rats) != 1:
        raise ValueError('Ambiguous Desert Rats team')
    owners = {}
    for tid, team in teams.items():
        if not isinstance(team.get('rosterItems'), list) or not team['rosterItems']:
            raise ValueError('Missing team roster')
        for player in team['rosterItems']:
            pid = player.get('id')
            if not isinstance(pid, str) or not pid or pid in owners:
                raise ValueError('Missing or conflicting player ownership')
            owners[pid] = (tid, team['teamName'])
    ids = set(info['playerInfo']) | {pid for pid in catalogue if '#' not in pid} | set(owners)
    pool = []
    for pid in sorted(ids):
        c, p = catalogue.get(pid, {}), info['playerInfo'].get(pid, {})
        if not isinstance(c, dict) or not isinstance(p, dict):
            raise ValueError('Invalid player source record')
        name = c.get('name')
        verified = c.get('fantraxId') == pid and isinstance(name, str) and name.strip() and name != pid and not name.strip().isdigit()
        owner = owners.get(pid)
        status = p.get('status')
        availability = 'UNKNOWN'
        if verified and status == 'T' and owner:
            availability = 'DESERT RATS' if owner[0] == rats[0] else 'OTHER TEAM'
        elif verified and not owner and status in ('FA', 'WW'):
            availability = 'FREE AGENT' if status == 'FA' else 'WAIVERS'
        positions = p.get('eligiblePos')
        if positions is not None and not isinstance(positions, str):
            raise ValueError('Invalid player eligibility')
        pool.append(dict(fantraxId=pid, name=' '.join(reversed(name.split(', '))).strip() if verified else 'Name unavailable',
                         mlbTeam=c.get('team') if c.get('fantraxId') == pid and isinstance(c.get('team'), str) else None,
                         availability=availability, positions=positions,
                         teamId=owner[0] if owner else None, teamName=owner[1] if owner else None,
                         sourceStatus=status if isinstance(status, str) else None))
    return pool


def normalize_transactions(payload):
    try:
        rows = payload['responses'][0]['data']['table']['rows']
    except (KeyError, IndexError, TypeError):
        raise ValueError('Transaction history unavailable') from None
    if not isinstance(rows, list):
        raise ValueError('Transaction history unavailable')
    groups = {}
    for row in rows:
        if not isinstance(row, dict):
            raise ValueError('Invalid transaction row')
        cells = row.get('cells', [])
        team = next((c for c in cells if c.get('key') == 'team'), None)
        date = next((c for c in cells if c.get('key') == 'date'), None)
        if team and date:
            groups[row.get('txSetId')] = (team, date)
    result, seen = [], set()
    for row in rows:
        if not row.get('executed') or row.get('deleted') or row.get('transactionCode') not in ('CLAIM', 'DROP'):
            continue
        scorer = row.get('scorer', {})
        pid, name, txid = scorer.get('scorerId'), scorer.get('name'), row.get('txSetId')
        if not all(isinstance(v, str) and v.strip() for v in (pid, name, txid)):
            raise ValueError('Invalid transaction identity')
        key = f"{txid}:{pid}:{row['transactionCode']}"
        if key in seen:
            raise ValueError('Duplicate transaction')
        seen.add(key)
        team, date = groups.get(txid, ({}, {}))
        result.append(dict(id=key, fantraxId=pid, name=name,
                           action='ADD' if row['transactionCode'] == 'CLAIM' else 'DROP',
                           teamName=team.get('content') or 'UNKNOWN', teamId=team.get('teamId'),
                           date=date.get('content') or 'UNKNOWN'))
    return result


def fetch_transactions(league):
    """Read the same recent executed claim/drop page used by FantasyGM2027."""
    body = {'msgs': [{'method': 'getTransactionDetailsHistory', 'data': {
        'leagueId': league, 'maxResultsPerPage': '10', 'executedOnly': True, 'view': 'CLAIM_DROP'}}],
        'uiv': 3, 'dt': 0, 'at': 0, 'av': '0.0', 'tz': 'UTC'}
    request = urllib.request.Request('https://www.fantrax.com/fxpa/req?leagueId=' + league,
        data=json.dumps(body).encode(), method='POST',
        headers={'Content-Type': 'application/json', 'User-Agent': 'FantasyGM2027/1.0'})
    with urllib.request.urlopen(request, timeout=20) as response:
        return normalize_transactions(json.load(response))


def validate_shared(data, players, teams):
    pool = data.get('pool')
    if not isinstance(pool, list) or not pool:
        raise ValueError('Missing shared player pool')
    tids = {t['Team ID']: t['Team'] for t in teams}
    owners = {p['Player ID']: p['Fantasy Team ID'] for p in players}
    by_id = {}
    keys = {'fantraxId', 'name', 'mlbTeam', 'availability', 'positions', 'teamId', 'teamName', 'sourceStatus'}
    for p in pool:
        if set(p) != keys or not isinstance(p['fantraxId'], str) or not p['fantraxId'] or p['fantraxId'] in by_id:
            raise ValueError('Invalid shared pool identity or fields')
        if any(p[k] is not None and not isinstance(p[k], str) for k in keys):
            raise ValueError('Invalid shared pool field')
        pid, tid = p['fantraxId'], p['teamId']
        if tid != owners.get(pid) or (tid is not None and p['teamName'] != tids.get(tid)):
            raise ValueError('Shared pool ownership mismatch')
        expected = 'UNKNOWN'
        if p['name'] != 'Name unavailable' and p['name']:
            if tid and p['sourceStatus'] == 'T':
                expected = 'DESERT RATS' if tids[tid].strip().lower() == 'desert rats' else 'OTHER TEAM'
            elif not tid and p['sourceStatus'] in ('FA', 'WW'):
                expected = 'FREE AGENT' if p['sourceStatus'] == 'FA' else 'WAIVERS'
        if p['availability'] != expected:
            raise ValueError('Unverified shared availability')
        by_id[pid] = p
    if not set(owners) <= set(by_id):
        raise ValueError('Roster player missing from shared pool')
    transactions = data.get('transactions')
    if transactions is not None:
        if not isinstance(transactions, list):
            raise ValueError('Invalid shared transactions')
        seen = set()
        for t in transactions:
            if set(t) != {'id', 'fantraxId', 'name', 'action', 'teamName', 'teamId', 'date'}:
                raise ValueError('Invalid transaction fields')
            if any(not isinstance(t[k], str) or not t[k] for k in ('id', 'fantraxId', 'name', 'action', 'teamName', 'date')) or (t['teamId'] is not None and t['teamId'] not in tids):
                raise ValueError('Invalid transaction values')
            if t['id'] in seen or t['action'] not in ('ADD', 'DROP'):
                raise ValueError('Invalid or duplicate transaction')
            seen.add(t['id'])
    return pool, transactions
