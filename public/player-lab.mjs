import {SNAPSHOT_URL, validateSnapshot} from './snapshot-contract.mjs';

let data = null;
let selectedId = null;

const TEAM_ALIASES = {
  AZ:'ARI', ARI:'ARI', CWS:'CHW', CHW:'CHW', KC:'KCR', KCR:'KCR',
  SD:'SDP', SDP:'SDP', SF:'SFG', SFG:'SFG', TB:'TBR', TBR:'TBR',
  WSH:'WSN', WSN:'WSN', OAK:'ATH', ATH:'ATH'
};

function normalizePositionList(value) {
  const vals = Array.isArray(value) ? value : String(value || '').split(/[\/,|]/);
  let positions = vals.map(v => String(v).trim().toUpperCase()).filter(Boolean);
  const hasHitter = positions.some(p => !['UT','P','SP','RP'].includes(p));
  const hasPitcher = positions.some(p => ['SP','RP'].includes(p));
  if (hasHitter) positions = positions.filter(p => p !== 'UT');
  if (hasPitcher) positions = positions.filter(p => p !== 'P');
  return positions;
}

function normalizePositions(value) {
  const positions = normalizePositionList(value);
  return positions.join('/') || 'Unavailable';
}

function isPitcher(player) {
  return normalizePositionList(player.positions).some(p => ['P','SP','RP'].includes(p));
}

function isFreeAgent(player) {
  const a = String(player.availability || '').toLowerCase();
  return a.includes('free') || a === 'fa';
}

function fmt(value, digits=1) {
  return Number.isFinite(value) ? Number(value).toFixed(digits) : '—';
}

function trend(player) {
  if (!Number.isFinite(player.ppg7) || !Number.isFinite(player.ppg30) || player.games7 < 2) return {label:'Not enough data', tone:'gray'};
  if (player.ppg30 === 0) return {label: player.ppg7 > 0 ? 'Rising' : 'Steady', tone: player.ppg7 > 0 ? 'green' : 'gray'};
  const change = (player.ppg7 - player.ppg30) / Math.abs(player.ppg30);
  if (change >= 0.15) return {label:'Rising', tone:'green'};
  if (change <= -0.15) return {label:'Falling', tone:'red'};
  return {label:'Steady', tone:'yellow'};
}

function ensureLayout() {
  const lab = document.getElementById('lab');
  const input = document.getElementById('lab-search');
  const table = document.getElementById('lab-rows')?.closest('table');
  if (!lab || !input || !table) return;

  const header = table.querySelector('thead tr');
  if (header) header.innerHTML = '<th>Player</th><th>MLB</th><th>Positions</th><th>Ownership</th><th>7D FP/G</th><th>14D FP/G</th><th>30D FP/G</th><th>Trend</th>';

  if (!document.getElementById('lab-note')) {
    const note = document.createElement('div');
    note.id = 'lab-note';
    note.className = 'note';
    note.style.margin = '8px 0 14px';
    input.insertAdjacentElement('afterend', note);
  }

  if (!document.getElementById('lab-detail')) {
    const detail = document.createElement('div');
    detail.id = 'lab-detail';
    detail.className = 'section';
    table.closest('.tablewrap')?.insertAdjacentElement('afterend', detail);
  }
}

function metric(label, value, detail='', tone='gray') {
  return `<div class="metric metric-${tone}"><div class="label">${label}</div><div class="value">${value}</div>${detail ? `<div class="subtle">${detail}</div>` : ''}</div>`;
}

function rankTone(rank) {
  if (!rank || !rank.total) return 'gray';
  const share = rank.rank / rank.total;
  if (share <= 0.25) return 'green';
  if (share <= 0.50) return 'yellow';
  return 'red';
}

function ppgTone(player, key) {
  const value = player?.[key];
  if (!Number.isFinite(value)) return 'gray';
  const positions = normalizePositionList(player.positions);
  const pitcher = isPitcher(player);
  const peers = (data?.pool || []).filter(p => {
    if (isPitcher(p) !== pitcher || !Number.isFinite(p[key])) return false;
    const pp = normalizePositionList(p.positions);
    return positions.length && pp.length && positions.some(pos => pp.includes(pos));
  }).map(p => p[key]).sort((a,b)=>a-b);
  if (!peers.length) return 'gray';
  const below = peers.filter(v => v < value).length;
  const pct = below / peers.length;
  if (pct >= 0.75) return 'green';
  if (pct >= 0.25) return 'yellow';
  return 'red';
}

function hitterMetricTone(label, value) {
  if (!Number.isFinite(value)) return 'gray';
  if (label === 'OPS') return value >= .800 ? 'green' : value >= .700 ? 'yellow' : 'red';
  if (label === 'ISO') return value >= .180 ? 'green' : value >= .130 ? 'yellow' : 'red';
  if (label === 'K%') return value <= 20 ? 'green' : value < 28 ? 'yellow' : 'red';
  if (label === 'BB%') return value >= 10 ? 'green' : value >= 7 ? 'yellow' : 'red';
  return 'gray';
}

function pitcherMetricTone(label, value) {
  if (!Number.isFinite(value)) return 'gray';
  if (label === 'ERA') return value <= 3.50 ? 'green' : value <= 4.50 ? 'yellow' : 'red';
  if (label === 'WHIP') return value <= 1.15 ? 'green' : value <= 1.30 ? 'yellow' : 'red';
  if (label === 'K-BB%') return value >= 18 ? 'green' : value >= 10 ? 'yellow' : 'red';
  if (label === 'Starts') return value >= 28 ? 'green' : value >= 20 ? 'yellow' : 'red';
  return 'gray';
}

function statcastTone(key, value) {
  if (!Number.isFinite(value)) return 'gray';
  if (key === 'exitVelocity') return value >= 90 ? 'green' : value >= 87.5 ? 'yellow' : 'red';
  if (key === 'hardHitPct') return value >= 45 ? 'green' : value >= 35 ? 'yellow' : 'red';
  if (key === 'barrelPct') return value >= 10 ? 'green' : value >= 6 ? 'yellow' : 'red';
  if (key === 'xba') return value >= .270 ? 'green' : value >= .240 ? 'yellow' : 'red';
  if (key === 'xslg') return value >= .450 ? 'green' : value >= .380 ? 'yellow' : 'red';
  if (key === 'xwoba') return value >= .350 ? 'green' : value >= .310 ? 'yellow' : 'red';
  if (key === 'sprintSpeed') return value >= 28.5 ? 'green' : value >= 26.5 ? 'yellow' : 'red';
  return 'gray';
}

function scheduleTeamKey(team, schedule) {
  const raw = String(team || '').trim().toUpperCase();
  if (schedule?.teams?.[raw]) return raw;
  const alias = TEAM_ALIASES[raw];
  return alias && schedule?.teams?.[alias] ? alias : null;
}

function scheduleContext(player) {
  const schedule = data?.weekly_schedule;
  const key = scheduleTeamKey(player.mlbTeam, schedule);
  const days = Array.isArray(schedule?.days) ? schedule.days : [];
  if (!key || days.length !== 7) return null;
  let games = 0;
  let home = 0;
  let road = 0;
  let probable = 0;
  const opponents = [];
  for (const day of days) {
    const list = Array.isArray(schedule.teams?.[key]?.[day]) ? schedule.teams[key][day] : [];
    games += list.length;
    for (const g of list) {
      if (g.home_away === 'home') home += 1; else if (g.home_away === 'away') road += 1;
      if (g.opponent_probable_pitcher) probable += 1;
      if (g.opponent) opponents.push(g.opponent);
    }
  }
  return {games, home, road, probable, opponents:[...new Set(opponents)]};
}

function positionRank(player) {
  const positions = normalizePositionList(player.positions);
  const pitcher = isPitcher(player);
  const peers = (data?.pool || []).filter(p => {
    if (isPitcher(p) !== pitcher || !Number.isFinite(p.ppg14)) return false;
    const pp = normalizePositionList(p.positions);
    if (!positions.length || !pp.length) return false;
    return positions.some(pos => pp.includes(pos));
  }).sort((a,b) => (b.ppg14 ?? -Infinity) - (a.ppg14 ?? -Infinity));
  const index = peers.findIndex(p => p.fantraxId === player.fantraxId);
  if (index < 0) return null;
  return {rank:index + 1, total:peers.length};
}

function bestAvailablePeers(player) {
  const positions = normalizePositionList(player.positions);
  const pitcher = isPitcher(player);
  return (data?.pool || []).filter(p => {
    if (!isFreeAgent(p) || isPitcher(p) !== pitcher || !Number.isFinite(p.ppg14)) return false;
    const pp = normalizePositionList(p.positions);
    return positions.length && pp.length && positions.some(pos => pp.includes(pos));
  }).sort((a,b) => {
    if ((b.ppg14 ?? -Infinity) !== (a.ppg14 ?? -Infinity)) return (b.ppg14 ?? -Infinity) - (a.ppg14 ?? -Infinity);
    return String(a.name || '').localeCompare(String(b.name || ''));
  }).slice(0,5);
}

function rankBand(rank) {
  if (!rank || !rank.total) return {label:'Unranked', detail:'14D FP/G peer rank unavailable'};
  const share = rank.rank / rank.total;
  if (share <= 0.10) return {label:'Top 10%', detail:`${rank.rank} of ${rank.total} eligible peers`};
  if (share <= 0.25) return {label:'Top 25%', detail:`${rank.rank} of ${rank.total} eligible peers`};
  if (share <= 0.50) return {label:'Top 50%', detail:`${rank.rank} of ${rank.total} eligible peers`};
  return {label:'Lower half', detail:`${rank.rank} of ${rank.total} eligible peers`};
}

function volumeSignal(sched) {
  if (!sched) return {label:'Unavailable', detail:'Verified weekly schedule missing'};
  if (sched.games >= 7) return {label:'Heavy slate', detail:`${sched.games} games this week`};
  if (sched.games === 6) return {label:'Normal slate', detail:'6 games this week'};
  return {label:'Light slate', detail:`${sched.games} games this week`};
}

function profileSignal(sm) {
  if (sm?.type === 'pitcher') {
    if (!Number.isFinite(sm.k_bb_pct)) return {label:'Unavailable', detail:'K-BB% not verified'};
    if (sm.k_bb_pct >= 18) return {label:'Strong K-BB profile', detail:`${fmt(sm.k_bb_pct,1)}% K-BB`};
    if (sm.k_bb_pct <= 10) return {label:'Low K-BB profile', detail:`${fmt(sm.k_bb_pct,1)}% K-BB`};
    return {label:'Middle K-BB profile', detail:`${fmt(sm.k_bb_pct,1)}% K-BB`};
  }
  if (!Number.isFinite(sm?.k_pct) || !Number.isFinite(sm?.bb_pct)) return {label:'Unavailable', detail:'K% / BB% not verified'};
  if (sm.k_pct <= 20 && sm.bb_pct >= 8) return {label:'Strong discipline', detail:`${fmt(sm.k_pct,1)}% K · ${fmt(sm.bb_pct,1)}% BB`};
  if (sm.k_pct >= 28) return {label:'High K rate', detail:`${fmt(sm.k_pct,1)}% K · ${fmt(sm.bb_pct,1)}% BB`};
  return {label:'Middle discipline', detail:`${fmt(sm.k_pct,1)}% K · ${fmt(sm.bb_pct,1)}% BB`};
}

function renderAvailablePeers(player) {
  const peers = bestAvailablePeers(player);
  if (!peers.length) return '<div class="empty">No verified free-agent peers with 14-day FP/G at the same position.</div>';
  const rows = peers.map(p => {
    const delta = Number.isFinite(player.ppg14) ? p.ppg14 - player.ppg14 : null;
    const deltaText = Number.isFinite(delta) ? `${delta >= 0 ? '+' : ''}${delta.toFixed(2)}` : '—';
    return `<tr><td>${p.name || 'Unavailable'}</td><td>${normalizePositions(p.positions)}</td><td>${fmt(p.ppg14,2)}</td><td>${fmt(p.ppg7,2)}</td><td>${deltaText}</td></tr>`;
  }).join('');
  return `<div class="tablewrap"><table><thead><tr><th>Best Available</th><th>Positions</th><th>14D FP/G</th><th>7D FP/G</th><th>vs Selected</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

function renderDetail(player) {
  const host = document.getElementById('lab-detail');
  if (!host) return;
  if (!player) {
    host.innerHTML = '<h2>Scouting Card</h2><div class="empty">Search for a player to open the scouting card.</div>';
    return;
  }
  const t = trend(player);
  const sm = player.seasonMetrics || {};
  const pitcher = sm.type === 'pitcher';
  const ownership = player.teamName || player.availability || 'Unavailable';
  const sched = scheduleContext(player);
  const rank = positionRank(player);
  const rankSignal = rankBand(rank);
  const volume = volumeSignal(sched);
  const profile = profileSignal(sm);
  let seasonCards = '';
  if (pitcher) {
    seasonCards = [
      metric('ERA', fmt(sm.era, 2), `${sm.ip ?? '—'} IP`, pitcherMetricTone('ERA', sm.era)),
      metric('WHIP', fmt(sm.whip, 2), '', pitcherMetricTone('WHIP', sm.whip)),
      metric('K-BB%', fmt(sm.k_bb_pct, 1), `${sm.k ?? '—'} K · ${sm.bb ?? '—'} BB`, pitcherMetricTone('K-BB%', sm.k_bb_pct)),
      metric('Starts', Number.isFinite(sm.starts) ? String(sm.starts) : '—', `${sm.games ?? '—'} appearances`, pitcherMetricTone('Starts', sm.starts)),
    ].join('');
  } else {
    seasonCards = [
      metric('OPS', fmt(sm.ops, 3), `${sm.pa ?? '—'} PA`, hitterMetricTone('OPS', sm.ops)),
      metric('ISO', fmt(sm.iso, 3), '', hitterMetricTone('ISO', sm.iso)),
      metric('K%', fmt(sm.k_pct, 1), '', hitterMetricTone('K%', sm.k_pct)),
      metric('BB%', fmt(sm.bb_pct, 1), '', hitterMetricTone('BB%', sm.bb_pct)),
    ].join('');
  }

  const statcast = player.statcast2026 || {};
  const statcastCard = (key, label, digits, unit='') => {
    const value = statcast[key];
    return metric(label, Number.isFinite(value) ? `${Number(value).toFixed(digits)}${unit}` : '—', Number.isFinite(value) ? '2026 Baseball Savant' : '', statcastTone(key, value));
  };
  const showStatcast = !pitcher || Boolean(player.statcast2026);
  const statcastCards = [
    statcastCard('exitVelocity','Exit Velocity',1,' mph'),
    statcastCard('hardHitPct','Hard-Hit%',1,'%'),
    statcastCard('barrelPct','Barrel%',1,'%'),
    statcastCard('xba','xBA',3),
    statcastCard('xslg','xSLG',3),
    statcastCard('xwoba','xwOBA',3),
    statcastCard('sprintSpeed','Sprint Speed',1,' ft/s'),
  ].join('');

  const signalCards = [
    metric('Recent Form', t.label, '7-day FP/G vs 30-day FP/G', t.tone),
    metric('Position Standing', rankSignal.label, rankSignal.detail, rankTone(rank)),
    metric('Weekly Volume', volume.label, volume.detail, volume.label === 'Heavy slate' ? 'green' : volume.label === 'Normal slate' ? 'yellow' : volume.label === 'Light slate' ? 'red' : 'gray'),
    metric('Skill Profile', profile.label, profile.detail, profile.label.startsWith('Strong') ? 'green' : profile.label.startsWith('Middle') ? 'yellow' : profile.label === 'Unavailable' ? 'gray' : 'red'),
  ].join('');

  const contextCards = [
    metric('14D Pos Rank', rank ? `${rank.rank}/${rank.total}` : '—', 'FP/G among players sharing eligibility', rankTone(rank)),
    metric('Week Games', sched ? String(sched.games) : '—', sched ? `${sched.home} home · ${sched.road} road` : 'Schedule unavailable', !sched ? 'gray' : sched.games >= 7 ? 'green' : sched.games === 6 ? 'yellow' : 'red'),
    metric('Probable SPs', sched ? `${sched.probable}/${sched.games}` : '—', pitcher ? 'Opponent probable-starter coverage' : 'Named opposing starters', !sched || !sched.games ? 'gray' : (sched.probable/sched.games) >= .75 ? 'green' : (sched.probable/sched.games) >= .4 ? 'yellow' : 'red'),
    metric('Opponents', sched?.opponents?.length ? sched.opponents.join(', ') : '—', '', sched?.opponents?.length ? 'yellow' : 'gray'),
  ].join('');

  host.innerHTML = `
    <h2>${player.name} — Scouting Card</h2>
    <div class="warning">${player.mlbTeam || '—'} · ${normalizePositions(player.positions)} · ${ownership}</div>
    <div class="summary">
      ${metric('7D FP/G', fmt(player.ppg7, 2), `${fmt(player.points7,1)} total · ${player.games7 ?? '—'} games`, ppgTone(player, 'ppg7'))}
      ${metric('14D FP/G', fmt(player.ppg14, 2), `${fmt(player.points14,1)} total · ${player.games14 ?? '—'} games`, ppgTone(player, 'ppg14'))}
      ${metric('30D FP/G', fmt(player.ppg30, 2), `${fmt(player.points30,1)} total · ${player.games30 ?? '—'} games`, ppgTone(player, 'ppg30'))}
      ${metric('Trend', t.label, '7-day pace vs 30-day pace', t.tone)}
    </div>
    <h2>Decision Signals</h2>
    <div class="summary">${signalCards}</div>
    <h2>Fantasy Context</h2>
    <div class="summary">${contextCards}</div>
    <h2>Best Available at Position</h2>
    ${renderAvailablePeers(player)}
    <h2>Season Performance</h2>
    <div class="summary">${seasonCards || metric('Season metrics','Unavailable')}</div>
    ${showStatcast ? `<h2>Statcast</h2><div class="summary">${statcastCards}</div>` : ''}
    <div class="note">Decision Signals and free-agent comparisons are deterministic views of the verified values shown above, not external expert rankings. Statcast values are shown only when verified from Baseball Savant.</div>`;
}

function render() {
  ensureLayout();
  if (!data) return;
  const q = String(document.getElementById('lab-search')?.value || '').trim().toLowerCase();
  const body = document.getElementById('lab-rows');
  if (!body) return;

  const matches = (data.pool || []).filter(p => {
    if (!q) return false;
    return [p.name,p.mlbTeam,normalizePositions(p.positions),p.teamName,p.availability].join(' ').toLowerCase().includes(q);
  }).sort((a,b) => {
    const aq = String(a.name || '').toLowerCase().startsWith(q) ? 0 : 1;
    const bq = String(b.name || '').toLowerCase().startsWith(q) ? 0 : 1;
    return aq - bq || String(a.name || '').localeCompare(String(b.name || ''));
  }).slice(0,50);

  body.replaceChildren();
  for (const p of matches) {
    const tr = document.createElement('tr');
    tr.style.cursor = 'pointer';
    tr.dataset.playerId = p.fantraxId || '';
    const t = trend(p);
    const values = [p.name,p.mlbTeam,normalizePositions(p.positions),p.teamName || p.availability || 'Unavailable',fmt(p.ppg7,2),fmt(p.ppg14,2),fmt(p.ppg30,2),t.label];
    for (const value of values) {
      const td = document.createElement('td');
      td.textContent = value || 'Unavailable';
      tr.append(td);
    }
    tr.addEventListener('click', () => {
      selectedId = p.fantraxId;
      renderDetail(p);
    });
    body.append(tr);
  }

  if (!matches.length) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 8;
    td.className = 'empty';
    td.textContent = q ? 'No verified matching players.' : 'Type a player name, MLB team or position.';
    tr.append(td);
    body.append(tr);
    renderDetail(null);
  } else {
    const selected = matches.find(p => p.fantraxId === selectedId) || matches[0];
    selectedId = selected.fantraxId;
    renderDetail(selected);
  }

  const note = document.getElementById('lab-note');
  if (note) {
    const meta = data.player_lab;
    note.textContent = meta?.recent_end_date
      ? `Recent form uses completed MLB games through ${meta.recent_end_date}. Click a result for the full scouting card.`
      : 'Recent-form data is not verified in the current snapshot.';
  }
}

async function load() {
  ensureLayout();
  try {
    const response = await fetch(`${SNAPSHOT_URL}?lab=${Date.now()}`, {cache:'no-store'});
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    data = validateSnapshot(await response.json());
    render();
  } catch {
    data = null;
    renderDetail(null);
  }
}

ensureLayout();
document.getElementById('lab-search')?.addEventListener('input', render);
document.querySelectorAll('.reloadbtn').forEach(btn => btn.addEventListener('click', load));
load();
