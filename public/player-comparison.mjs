export function verifiedIdentity(player) {
  return player?.identityStatus === 'Verified' && Number.isInteger(player.mlbId) && player.mlbId > 0;
}

export function addComparisonPlayer(selected, player) {
  if (!verifiedIdentity(player)) return {players:selected,error:'Player identity: Not verified. Cannot add to comparison.'};
  if (selected.some(p=>p.mlbId===player.mlbId)) return {players:selected,error:'This MLB player is already selected.'};
  if (selected.length>=4) return {players:selected,error:'Four players maximum. Remove a player before adding another.'};
  return {players:[...selected,{fantraxId:player.fantraxId,mlbId:player.mlbId,name:player.name}],error:''};
}

export function comparisonPlayers(selected,pool) {
  return selected.map(id=>pool.find(p=>p.fantraxId===id.fantraxId && p.mlbId===id.mlbId && verifiedIdentity(p))
    || {fantraxId:id.fantraxId,name:id.name,identityStatus:'Not verified'});
}

function kind(p) {
  const positions=Array.isArray(p.positions)?p.positions:String(p.positions||'').split(/[,/|]/);
  return positions.some(x=>['P','SP','RP'].includes(x.trim()))?'pitcher':'hitter';
}

export function metricTones(players,values,{group=null,better=null,window=null}={}) {
  const tones=players.map(()=>'gray');
  if (!better || players.length<2) return tones;
  // Compare valid peers for this particular statistic; an unrelated or
  // unavailable fourth player must not suppress meaningful comparisons.
  const eligible=players.map((p,i)=>{
    if (!verifiedIdentity(p) || !Number.isFinite(values[i])) return false;
    if (group==='hitter' && p.seasonMetrics?.type!=='hitter') return false;
    if (group==='pitcher' && p.seasonMetrics?.type!=='pitcher') return false;
    if (window && (!Number.isFinite(p[`games${window}`]) || p[`games${window}`]<2)) return false;
    if (!window && group==='hitter' && !(p.seasonMetrics?.pa>=20)) return false;
    if (!window && group==='pitcher' && !(p.seasonMetrics?.games>=2 && parseFloat(p.seasonMetrics?.ip)>=6)) return false;
    return true;
  });
  // Fantasy points are pitching- or hitting-specific. Compare within the
  // largest same-role peer group only, not SP values against hitters.
  if (window) {
    const counts={hitter:0,pitcher:0};
    players.forEach((p,i)=>{if(eligible[i]) counts[kind(p)]++;});
    const majority=counts.hitter>=counts.pitcher?'hitter':'pitcher';
    players.forEach((p,i)=>{if(kind(p)!==majority) eligible[i]=false;});
  }
  const peerValues=values.filter((_,i)=>eligible[i]);
  if (peerValues.length<2) return tones;
  const best=better==='low'?Math.min(...peerValues):Math.max(...peerValues);
  const worst=better==='low'?Math.max(...peerValues):Math.min(...peerValues);
  return values.map((v,i)=>!eligible[i]?'gray':best===worst?'yellow':v===best?'green':v===worst?'red':'yellow');
}

export function comparisonRows(players) {
  const rows=[];
  const add=(label,get,options={})=>{
    const values=players.map(p=>verifiedIdentity(p)?get(p):null);
    rows.push({label,values,tones:metricTones(players,values,options),digits:options.digits??2,suffix:options.suffix||''});
  };
  add('Eligible positions',p=>Array.isArray(p.positions)?p.positions.join('/'):p.positions);
  add('Identity',p=>`MLBAM ${p.mlbId}`);
  for (const days of [7,14,30]) {
    add(`${days}D FP (partial model)`,p=>p[`points${days}`],{better:'high',window:days,digits:1});
    add(`${days}D FP/G (partial model)`,p=>p[`ppg${days}`],{better:'high',window:days});
    add(`${days}D games`,p=>p[`games${days}`],{digits:0});
  }
  add('Trend (7D vs 30D)',p=>{
    if (!Number.isFinite(p.ppg7)||!Number.isFinite(p.ppg30)||!Number.isFinite(p.games7)||p.games7<2) return 'Not enough data';
    if (p.ppg30===0) return p.ppg7>0?'Rising':'Steady';
    const delta=(p.ppg7-p.ppg30)/Math.abs(p.ppg30);
    return delta>=.15?'Rising':delta<=-.15?'Falling':'Steady';
  });
  const metrics=[['AVG','avg','hitter','high',3],['OBP','obp','hitter','high',3],['SLG','slg','hitter','high',3],['OPS','ops','hitter','high',3],['ISO','iso','hitter','high',3],['Hitter K%','k_pct','hitter','low',1],['Hitter BB%','bb_pct','hitter','high',1],['PA','pa','hitter',null,0],['HR','hr','hitter',null,0],['SB','sb','hitter',null,0],['ERA','era','pitcher','low',2],['WHIP','whip','pitcher','low',2],['K-BB%','k_bb_pct','pitcher','high',1],['IP','ip','pitcher',null,1],['Pitcher K','k','pitcher',null,0],['Pitcher BB','bb','pitcher',null,0],['Starts','starts','pitcher',null,0]];
  for(const [label,key,group,better,digits] of metrics) {
    if (!players.some(p=>kind(p)===group)) continue;
    add(`2026 season ${label}`,p=>p.seasonMetrics?.type===group?p.seasonMetrics[key]:null,{group,better,digits});
  }
  add('2026 season appearances/games',p=>p.seasonMetrics?.games,{digits:0});
  for(const [label,key,digits,suffix] of [['Exit velocity','exitVelocity',1,' mph'],['Hard-hit%','hardHitPct',1,'%'],['Barrel%','barrelPct',1,'%'],['xBA','xba',3,''],['xSLG','xslg',3,''],['xwOBA','xwoba',3,''],['Sprint speed','sprintSpeed',1,' ft/s']]) {
    add(`2026 Statcast ${label}`,p=>p.statcast2026?.[key],{group:'statcast',better:'high',digits,suffix});
  }
  return rows;
}
