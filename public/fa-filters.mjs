import './player-lab.mjs';
import {ficDailyRating} from './daily-matchups.mjs';
import {SNAPSHOT_URL, validateSnapshot} from './snapshot-contract.mjs';

let data = null;

const TEAM_ALIASES = {
  AZ:'ARI', ARI:'ARI', CWS:'CHW', CHW:'CHW', KC:'KCR', KCR:'KCR',
  SD:'SDP', SDP:'SDP', SF:'SFG', SFG:'SFG', TB:'TBR', TBR:'TBR',
  WSH:'WSN', WSN:'WSN', OAK:'ATH', ATH:'ATH'
};

function normalizePositions(value) {
  if (Array.isArray(value)) return value.map(v => String(v).trim().toUpperCase()).filter(Boolean);
  if (!value) return [];
  return String(value).split(/[\/,|]/).map(v => v.trim().toUpperCase()).filter(Boolean);
}

function displayPositions(value) {
  let positions = normalizePositions(value);
  const hasSpecificHitter = positions.some(p => !['UT','P','SP','RP'].includes(p));
  const hasSpecificPitcher = positions.some(p => ['SP','RP'].includes(p));
  if (hasSpecificHitter) positions = positions.filter(p => p !== 'UT');
  if (hasSpecificPitcher) positions = positions.filter(p => p !== 'P');
  return positions.length ? positions.join('/') : 'Unavailable';
}

function isPitcher(player) {
  return normalizePositions(player.positions).some(p => ['P','SP','RP'].includes(p));
}

function isFreeAgent(player) {
  const a = String(player.availability || '').toLowerCase();
  return a.includes('free') || a === 'fa';
}

function hasRecentStats(player) {
  return Number.isFinite(player.points14) && Number.isFinite(player.ppg14) && Number(player.games14) > 0;
}

function matchesPosition(player, wanted) {
  if (!wanted || wanted === 'all') return true;
  const positions = normalizePositions(player.positions);
  if (wanted === 'UT') return positions.length === 1 && positions[0] === 'UT';
  if (wanted === 'OF') return positions.some(p => ['OF','LF','CF','RF'].includes(p));
  return positions.includes(wanted);
}

function ensurePositionFilter() {
  if (document.getElementById('fa-position')) return;
  const type = document.getElementById('fa-type');
  if (!type) return;
  const select = document.createElement('select');
  select.id = 'fa-position';
  select.className = 'select';
  select.setAttribute('aria-label', 'Free agent position');
  for (const [value, label] of [
    ['all','All positions'],['C','C'],['1B','1B'],['2B','2B'],['3B','3B'],['SS','SS'],['OF','OF'],['UT','UT only'],['SP','SP'],['RP','RP']
  ]) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    select.append(option);
  }
  type.insertAdjacentElement('afterend', select);
  select.addEventListener('change', render);
}

function ensureActivityFilter() {
  if (document.getElementById('fa-activity')) return;
  const position = document.getElementById('fa-position');
  if (!position) return;
  const select = document.createElement('select');
  select.id = 'fa-activity';
  select.className = 'select';
  select.setAttribute('aria-label', 'Free agent recent activity');
  for (const [value, label] of [
    ['recent','Recent MLB stats'],
    ['all','All free agents'],
    ['nostats','No recent stats']
  ]) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    select.append(option);
  }
  position.insertAdjacentElement('afterend', select);
  select.addEventListener('change', render);
}

function ensureStatColumns() {
  const body = document.getElementById('fa-rows');
  const table = body?.closest('table');
  const row = table?.querySelector('thead tr');
  if (!row) return;
  row.innerHTML = '<th>Signal</th><th>Player</th><th>MLB</th><th>Pos</th><th>14D Pts</th><th>14D PPG</th><th>Trend</th><th>Next Wk</th><th>Wk +2</th><th>FIC</th>';
  const wrap = table.closest('.tablewrap');
  if (wrap && !document.getElementById('fa-14d-note')) {
    const note = document.createElement('div');
    note.id = 'fa-14d-note';
    note.className = 'note';
    note.style.margin = '8px 0 0';
    wrap.insertAdjacentElement('afterend', note);
  }
}

function fmt(value, digits=1) {
  return Number.isFinite(value) ? Number(value).toFixed(digits) : '—';
}

function trend(player) {
  if (!Number.isFinite(player.ppg7) || !Number.isFinite(player.ppg30) || Number(player.games7) < 2) {
    return {label:'Not enough data', tone:'gray'};
  }
  if (player.ppg30 === 0) return {label:player.ppg7 > 0 ? 'Rising' : 'Steady', tone:player.ppg7 > 0 ? 'green' : 'gray'};
  const change = (player.ppg7 - player.ppg30) / Math.abs(player.ppg30);
  if (change >= 0.15) return {label:'Rising', tone:'green'};
  if (change <= -0.15) return {label:'Falling', tone:'red'};
  return {label:'Steady', tone:'yellow'};
}

function teamKey(team, schedule) {
  if (!team || !schedule?.teams) return null;
  const raw = String(team).trim().toUpperCase();
  if (schedule.teams[raw]) return raw;
  const alias = TEAM_ALIASES[raw];
  return alias && schedule.teams[alias] ? alias : null;
}

function scheduleSummary(player, week) {
  if (!week || !Array.isArray(week.days)) return {label:'Not verified', tone:'gray', title:''};
  const key = teamKey(player.mlbTeam, week);
  if (!key) return {label:'Not verified', tone:'gray', title:''};
  const games = [];
  for (const day of week.days) {
    for (const game of week.teams?.[key]?.[day] || []) {
      games.push({...game, day});
    }
  }
  const opponents = [];
  for (const game of games) {
    const label = `${game.home_away === 'away' ? '@' : ''}${game.opponent || '?'}`;
    if (!opponents.includes(label)) opponents.push(label);
  }
  const dateLabel = week.week_start && week.week_end ? `${week.week_start}–${week.week_end}` : '';
  const bm = data?.baseball_monster_ease;
  const side = isPitcher(player) ? bm?.pitchers : bm?.hitters;
  const ranks = games.map(game => side?.[game.opponent]?.rank).filter(Number.isInteger);
  if (bm?.status === 'verified' && ranks.length === games.length && games.length) {
    const avgRank = ranks.reduce((sum, rank) => sum + rank, 0) / ranks.length;
    const tone = avgRank <= 10 ? 'green' : avgRank <= 20 ? 'yellow' : 'red';
    const grade = tone === 'green' ? 'EASY' : tone === 'red' ? 'TOUGH' : 'AVG';
    return {
      label:`${games.length} G · ${grade}`,
      tone,
      title:`${dateLabel}. ${opponents.join(', ')}. Baseball Monster opponent Ease average rank #${avgRank.toFixed(1)} of 30 (1=easiest).`,
    };
  }
  return {
    label:`${games.length} G${opponents.length ? ` · ${opponents.join(', ')}` : ''}`,
    tone:'gray',
    title:`${dateLabel}. Verified MLB schedule; Baseball Monster Ease not verified for every opponent.`,
  };
}

function ficSummary(player, weeks) {
  if (isPitcher(player)) return {label:'—', tone:'gray', title:'FIC BvP applies to hitters.'};
  if (data?.fic_matchups?.status !== 'verified') return {label:'Not verified', tone:'gray', title:'FIC matchup feed unavailable.'};
  const dates = new Set((weeks || []).flatMap(week => Array.isArray(week?.days) ? week.days : []));
  const items = Object.entries(data.fic_matchups.players?.[player.name] || {})
    .filter(([day]) => dates.has(day))
    .map(([, item]) => ficDailyRating(item))
    .filter(item => item.label !== 'Not rated');
  if (!items.length) return {label:'Not rated', tone:'gray', title:'No verified FIC BvP sample for the look-ahead window.'};
  const plus = items.filter(item => item.tone === 'green').length;
  const neutral = items.filter(item => item.tone === 'yellow').length;
  const minus = items.filter(item => item.tone === 'red').length;
  const tone = plus > minus ? 'green' : minus > plus ? 'red' : 'yellow';
  return {
    label:`+${plus} / =${neutral} / −${minus}`,
    tone,
    title:`Verified FIC BvP samples across next two weeks: ${plus} favorable, ${neutral} neutral, ${minus} tough.`,
  };
}

function percentileRank(value, peers) {
  if (!Number.isFinite(value) || !peers.length) return null;
  const sorted = peers.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return null;
  let below = 0;
  let equal = 0;
  for (const v of sorted) {
    if (v < value) below += 1;
    else if (v === value) equal += 1;
  }
  return (below + equal * 0.5) / sorted.length;
}

function overallSignal(player, allFreeAgents, weeks) {
  if (!hasRecentStats(player)) return {label:'NOT ENOUGH DATA', tone:'gray', title:'Overall signal requires verified recent fantasy production.'};

  const sameType = allFreeAgents.filter(p => isPitcher(p) === isPitcher(player) && hasRecentStats(p));
  const pct = percentileRank(player.ppg14, sameType.map(p => p.ppg14));
  const t = trend(player);
  const next = scheduleSummary(player, weeks[0]);
  const later = scheduleSummary(player, weeks[1]);
  const fic = ficSummary(player, weeks);

  let score = 0;
  const reasons = [];

  if (pct !== null) {
    if (pct >= 0.75) { score += 2; reasons.push('top-quartile 14D PPG among available peers'); }
    else if (pct < 0.25) { score -= 2; reasons.push('bottom-quartile 14D PPG among available peers'); }
    else reasons.push('middle-half 14D PPG among available peers');
  }

  if (t.tone === 'green') { score += 1; reasons.push('rising trend'); }
  else if (t.tone === 'red') { score -= 1; reasons.push('falling trend'); }
  else if (t.label === 'Steady') reasons.push('steady trend');

  if (next.tone === 'green') { score += 1; reasons.push('easy next-week schedule'); }
  else if (next.tone === 'red') { score -= 1; reasons.push('tough next-week schedule'); }

  if (later.tone === 'green') { score += 0.5; reasons.push('easy week+2 schedule'); }
  else if (later.tone === 'red') { score -= 0.5; reasons.push('tough week+2 schedule'); }

  if (!isPitcher(player)) {
    if (fic.tone === 'green') { score += 0.5; reasons.push('positive verified FIC context'); }
    else if (fic.tone === 'red') { score -= 0.5; reasons.push('negative verified FIC context'); }
  }

  if (score >= 2) return {label:'LOOK', tone:'green', title:`Overall signal: ${reasons.join(' · ')}.`};
  if (score <= -2) return {label:'PASS', tone:'red', title:`Overall signal: ${reasons.join(' · ')}.`};
  return {label:'WATCH', tone:'yellow', title:`Overall signal: ${reasons.join(' · ')}.`};
}

function pillCell(label, tone='gray', title='') {
  const td = document.createElement('td');
  const span = document.createElement('span');
  span.className = `rating ${tone}`;
  span.textContent = label;
  if (title) span.title = title;
  td.append(span);
  return td;
}

function textCell(value, title='') {
  const td = document.createElement('td');
  td.textContent = value || '—';
  if (title) td.title = title;
  return td;
}

function render() {
  if (!data) return;
  ensureStatColumns();
  const body = document.getElementById('fa-rows');
  if (!body) return;
  const q = String(document.getElementById('fa-search')?.value || '').trim().toLowerCase();
  const type = document.getElementById('fa-type')?.value || 'all';
  const position = document.getElementById('fa-position')?.value || 'all';
  const activity = document.getElementById('fa-activity')?.value || 'recent';
  const weeks = Array.isArray(data.fa_lookahead?.weeks) ? data.fa_lookahead.weeks.slice(0, 2) : [];

  const allFreeAgents = (data.pool || []).filter(isFreeAgent);

  const rows = (data.pool || []).filter(player => {
    if (!isFreeAgent(player)) return false;
    if (type === 'pitchers' && !isPitcher(player)) return false;
    if (type === 'hitters' && isPitcher(player)) return false;
    if (!matchesPosition(player, position)) return false;
    if (activity === 'recent' && !hasRecentStats(player)) return false;
    if (activity === 'nostats' && hasRecentStats(player)) return false;
    const haystack = [player.name, player.mlbTeam, displayPositions(player.positions), player.availability].join(' ').toLowerCase();
    return !q || haystack.includes(q);
  }).sort((a, b) => {
    const ar = hasRecentStats(a) ? 1 : 0;
    const br = hasRecentStats(b) ? 1 : 0;
    if (br !== ar) return br - ar;
    const ap = Number.isFinite(a.points14) ? a.points14 : -Infinity;
    const bp = Number.isFinite(b.points14) ? b.points14 : -Infinity;
    if (bp !== ap) return bp - ap;
    const ag = Number.isFinite(a.ppg14) ? a.ppg14 : -Infinity;
    const bg = Number.isFinite(b.ppg14) ? b.ppg14 : -Infinity;
    if (bg !== ag) return bg - ag;
    return String(a.name || '').localeCompare(String(b.name || ''));
  }).slice(0, 250);

  body.replaceChildren();
  for (const player of rows) {
    const tr = document.createElement('tr');
    const signal = overallSignal(player, allFreeAgents, weeks);
    tr.append(pillCell(signal.label, signal.tone, signal.title));
    tr.append(textCell(player.name));
    tr.append(textCell(player.mlbTeam));
    tr.append(textCell(displayPositions(player.positions)));
    tr.append(textCell(fmt(player.points14, 1)));
    tr.append(textCell(fmt(player.ppg14, 2)));
    const t = trend(player);
    tr.append(pillCell(t.label, t.tone));
    for (const week of [weeks[0], weeks[1]]) {
      const summary = scheduleSummary(player, week);
      tr.append(pillCell(summary.label, summary.tone, summary.title));
    }
    const fic = ficSummary(player, weeks);
    tr.append(pillCell(fic.label, fic.tone, fic.title));
    body.append(tr);
  }

  if (!rows.length) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 10;
    td.className = 'empty';
    td.textContent = 'No verified matching free agents.';
    tr.append(td);
    body.append(tr);
  }

  const note = document.getElementById('fa-14d-note');
  if (note) {
    const recent = data.recent_14d;
    const activityLabel = activity === 'recent' ? 'Showing free agents with verified recent MLB stats.' : activity === 'nostats' ? 'Showing free agents without verified recent MLB stats.' : 'Showing all free agents; players with verified recent stats are listed first.';
    const dates = weeks.length === 2 ? ` Look-ahead: ${weeks[0].week_start} through ${weeks[1].week_end}.` : ' Next-two-week schedule is not verified in the current snapshot.';
    const source = recent?.start_date && recent?.end_date
      ? ` Sorted by 14-day fantasy points, high to low. Trend compares verified 7D vs 30D FP/G. 14D window: ${recent.start_date} through ${recent.end_date}.`
      : ' 14-day fantasy-point feed is not verified in the current snapshot.';
    note.textContent = `${activityLabel}${source}${dates} LOOK/WATCH/PASS combines 14D PPG rank among available peers, verified trend, next-week and week+2 Baseball Monster schedule ease, plus verified FIC context for hitters. Opponents come from MLB Stats API; no signal is based on unverified data.`;
  }
}

async function load() {
  ensurePositionFilter();
  ensureActivityFilter();
  ensureStatColumns();
  try {
    const response = await fetch(`${SNAPSHOT_URL}?fa=${Date.now()}`, {cache:'no-store'});
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    data = validateSnapshot(await response.json());
    render();
  } catch {
    data = null;
  }
}

ensurePositionFilter();
ensureActivityFilter();
ensureStatColumns();
document.getElementById('fa-search')?.addEventListener('input', render);
document.getElementById('fa-type')?.addEventListener('change', render);
document.querySelectorAll('.reloadbtn').forEach(btn => btn.addEventListener('click', load));
load();
