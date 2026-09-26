const BASE = 'https://www.fantrax.com/fxea/general/';
const LEAGUE = 'gxq8uqpqmg5m5edj';
export function normalizeFantrax(info, rosters, catalogue, standings, capturedAt = new Date().toISOString()) {
  if (!info?.playerInfo || !rosters?.rosters || !catalogue || !Array.isArray(standings)) throw Error('Incomplete Fantrax response');
  const teams = Object.entries(rosters.rosters).map(([id,t]) => {
    const s = standings.find(s => s.teamId === id);
    return {'Team ID':id,Team:t.teamName,Record:s?.points,Points:s?.totalPointsFor};
  });
  const ours = teams.find(t => t.Team?.toLowerCase() === 'desert rats')?.['Team ID'];
  if (teams.length !== 12 || !ours) throw Error('Incomplete league rosters');
  const owners = new Map();
  for (const [id,t] of Object.entries(rosters.rosters)) {
    if (!Array.isArray(t.rosterItems)) throw Error('Missing roster');
    for (const p of t.rosterItems) {
      if (owners.has(p.id)) throw Error('Conflicting roster ownership');
      owners.set(p.id,{id,name:t.teamName,slot:p.position,rosterStatus:p.status});
    }
  }
  const ids = new Set([...Object.keys(info.playerInfo),...Object.keys(catalogue).filter(id=>!id.includes('#')),...owners.keys()]);
  const pool = [...ids].map(id => {
    const c = catalogue[id], p = info.playerInfo[id], owner = owners.get(id);
    const name = c?.fantraxId === id && typeof c.name === 'string' && c.name.trim() && c.name !== id && !/^\d+$/.test(c.name.trim()) ? c.name.split(', ').reverse().join(' ').trim() : null;
    const mlbTeam = c?.fantraxId === id && typeof c.team === 'string' ? c.team : null;
    let availability = 'UNKNOWN';
    if (name && p?.status === 'T' && owner) availability = owner.id === ours ? 'DESERT RATS' : 'OTHER TEAM';
    else if (name && !owner && p?.status === 'FA') availability = 'FREE AGENT';
    else if (name && !owner && p?.status === 'WW') availability = 'WAIVERS';
    return {fantraxId:id,name:name??'Name unavailable',mlbTeam,availability,positions:p?.eligiblePos??null,teamId:owner?.id??null,teamName:owner?.name??null,sourceStatus:p?.status??null};
  });
  const players = [...owners].map(([id,o]) => {
    const p = pool.find(p=>p.fantraxId===id);
    return {'Player ID':id,Player:p.name,'MLB Team':p.mlbTeam,'Fantasy Team ID':o.id,Positions:p.positions??o.slot,Status:o.rosterStatus};
  });
  return {schema_version:1,league_id:LEAGUE,generated_at:capturedAt,teams,players,pool,unavailable:['matchup_scores','starts_used','injury_details','transactions','pitcher_ratings']};
}
export async function fetchFantrax() {
  const calls = ['getLeagueInfo?leagueId='+LEAGUE,'getTeamRosters?leagueId='+LEAGUE,'getPlayerIds?sport=MLB','getStandings?leagueId='+LEAGUE];
  const data = await Promise.all(calls.map(async path => {
    const r = await fetch(BASE+path,{headers:{'User-Agent':'FantasyGM2027/1.0','Accept':'application/json'},cache:'no-store',signal:AbortSignal.timeout(20000)});
    if (!r.ok) throw Error('Fantrax source unavailable: '+r.status+' '+path);
    return r.json();
  }));
  const snapshot = normalizeFantrax(...data);
  try {
    const r = await fetch('https://www.fantrax.com/fxpa/req?leagueId='+LEAGUE,{method:'POST',headers:{'Content-Type':'application/json','User-Agent':'FantasyGM2027/1.0'},signal:AbortSignal.timeout(15000),body:JSON.stringify({msgs:[{method:'getTransactionDetailsHistory',data:{leagueId:LEAGUE,maxResultsPerPage:'10',executedOnly:true,view:'CLAIM_DROP'}}],uiv:3,dt:0,at:0,av:'0.0',tz:'UTC'})});
    if (!r.ok) throw Error('Transaction history unavailable');
    snapshot.transactions = normalizeTransactions(await r.json());
    snapshot.unavailable = snapshot.unavailable.filter(v=>v!=='transactions');
  } catch { snapshot.transactions = null; }
  return snapshot;
}



export function normalizeTransactions(payload) {
  const rows = payload?.responses?.[0]?.data?.table?.rows;
  if (!Array.isArray(rows)) throw Error('Transaction history unavailable');
  const groups = new Map();
  return rows.filter(r=>r.executed && !r.deleted && ['CLAIM','DROP'].includes(r.transactionCode)).map(r=>{
    const cells = r.cells??[];
    const team = cells.find(c=>c.key==='team');
    const date = cells.find(c=>c.key==='date');
    if (team && date) groups.set(r.txSetId,{teamName:team.content,teamId:team.teamId,date:date.content});
    const group = groups.get(r.txSetId);
    return {id:r.txSetId+':'+r.scorer.scorerId+':'+r.transactionCode,fantraxId:r.scorer.scorerId,name:r.scorer.name,action:r.transactionCode==='CLAIM'?'ADD':'DROP',teamName:group?.teamName??'UNKNOWN',teamId:group?.teamId??null,date:group?.date??'UNKNOWN'};
  });
}
