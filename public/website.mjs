import {appendRbSummary} from './rb-weekly.mjs';
import {SNAPSHOT_URL, validateSnapshot} from './snapshot-contract.mjs';
import {buildDailyTrendRows, dailyTrendFor, formatDailyFpg} from './daily-trends.mjs';

let snapshot = null;

function cell(value, fallback='Unavailable') {
  const td = document.createElement('td');
  td.textContent = value ?? fallback;
  return td;
}

function replaceRows(id, records, columns, fallback='Unavailable') {
  const body = document.getElementById(id);
  if (!body) return;
  body.replaceChildren(...records.map(record => {
    const tr = document.createElement('tr');
    for (const col of columns) tr.append(cell(record[col], fallback));
    return tr;
  }));
  if (!records.length) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = columns.length;
    td.className = 'empty';
    td.textContent = 'No verified matching records.';
    tr.append(td);
    body.append(tr);
  }
}

function setStatus(text) {
  document.querySelectorAll('[data-status]').forEach(el => { el.textContent = text; });
}

function show(page) {
  document.querySelectorAll('.page').forEach(el => el.classList.toggle('active', el.id === page));
  history.replaceState(null, '', page === 'home' ? '#' : `#${page}`);
  window.scrollTo({top:0, behavior:'instant'});
}

document.querySelectorAll('[data-page]').forEach(btn => btn.addEventListener('click', () => show(btn.dataset.page)));
document.querySelectorAll('.homebtn').forEach(btn => btn.addEventListener('click', () => show('home')));
document.querySelectorAll('.reloadbtn').forEach(btn => btn.addEventListener('click', () => refresh()));

function desertRatsTeam(data) {
  return data.teams.find(t => t.Team.trim().toLowerCase() === 'desert rats');
}

function normalizePositions(value) {
  if (Array.isArray(value)) return value.map(v => String(v).trim()).filter(Boolean);
  if (!value) return [];
  return String(value).split(/[\/,|]/).map(v => v.trim()).filter(Boolean);
}

function formatPositions(value) {
  const positions = normalizePositions(value);
  return positions.length ? positions.join('/') : String(value || 'Unavailable');
}

function isPitcher(record) {
  const positions = normalizePositions(record.positions ?? record.Positions);
  return positions.some(p => ['P', 'SP', 'RP'].includes(p.toUpperCase()));
}

function isStarter(record) {
  return normalizePositions(record.Positions).some(p => p.toUpperCase() === 'SP');
}

function isReliever(record) {
  const positions = normalizePositions(record.Positions).map(p => p.toUpperCase());
  return positions.includes('RP') && !positions.includes('SP');
}

function rosterRecords(data) {
  const team = desertRatsTeam(data);
  if (!team) return [];
  return data.players
    .filter(p => p['Fantasy Team ID'] === team['Team ID'])
    .map(p => ({
      'Player ID': p['Player ID'],
      Player: p.Player,
      MLB: p['MLB Team'],
      Positions: formatPositions(p.Positions),
      Status: p.Status,
      pitcher: isPitcher(p),
    }))
    .sort((a, b) => String(a.Player).localeCompare(String(b.Player)));
}

function renderSummary(data, roster) {
  const updated = document.getElementById('home-updated');
  if (updated) updated.textContent = new Date(data.generated_at).toLocaleTimeString([], {hour:'numeric', minute:'2-digit'});
  const rc = document.getElementById('home-roster-count');
  if (rc) rc.textContent = String(roster.length);
  const faCount = (data.pool || []).filter(p => {
    const a = String(p.availability || '').toLowerCase();
    return a.includes('free') || a === 'fa';
  }).length;
  const fc = document.getElementById('home-fa-count');
  if (fc) fc.textContent = faCount.toLocaleString();
  const tx = document.getElementById('home-tx-count');
  if (tx) tx.textContent = Array.isArray(data.transactions) ? String(data.transactions.length) : 'Unavailable';
}

const TEAM_ALIASES = {
  AZ:'ARI', ARI:'ARI', CWS:'CHW', CHW:'CHW', KC:'KCR', KCR:'KCR',
  SD:'SDP', SDP:'SDP', SF:'SFG', SFG:'SFG', TB:'TBR', TBR:'TBR',
  WSH:'WSN', WSN:'WSN', OAK:'ATH', ATH:'ATH'
};

function scheduleTeamKey(team, schedule) {
  if (!team || !schedule?.teams) return null;
  const raw = String(team).trim().toUpperCase();
  if (schedule.teams[raw]) return raw;
  const aliased = TEAM_ALIASES[raw];
  return aliased && schedule.teams[aliased] ? aliased : null;
}

function normalizedName(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\b(jr|sr|ii|iii|iv)\b\.?/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function starterMatches(playerName, game) {
  return normalizedName(playerName) && normalizedName(playerName) === normalizedName(game?.team_probable_pitcher);
}

function matchupText(game, includeProbable=false) {
  if (!game) return '';
  const prefix = game.home_away === 'away' ? '@' : 'vs ';
  let text = `${prefix}${game.opponent || '?'}`;
  if (includeProbable && game.opponent_probable_pitcher) text += ` · ${game.opponent_probable_pitcher}`;
  return text;
}

function matchupBlock(games, {includeProbable=false, starterName=null}={}) {
  const wrapper = document.createElement('div');
  const selected = starterName ? games.filter(g => starterMatches(starterName, g)) : games;
  if (!selected.length) {
    wrapper.className = 'offday';
    wrapper.textContent = '—';
    return wrapper;
  }
  for (const game of selected) {
    const block = document.createElement('span');
    block.className = 'match match-unverified';
    block.textContent = matchupText(game, includeProbable);
    if (!game.opponent_probable_pitcher && includeProbable) {
      const small = document.createElement('small');
      small.textContent = 'Probable SP not verified';
      block.append(small);
    }
    wrapper.append(block);
  }
  return wrapper;
}

function renderWeeklyTable(id, records, schedule, kind, data) {
  const body = document.getElementById(id);
  if (!body) return;
  body.replaceChildren();
  const days = schedule?.days;
  if (!Array.isArray(days) || days.length !== 7) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 8;
    td.className = 'empty';
    td.textContent = 'Verified weekly MLB schedule unavailable.';
    tr.append(td);
    body.append(tr);
    return;
  }
  for (const record of records) {
    const tr = document.createElement('tr');
    const playerCell = document.createElement('td');
    playerCell.textContent = record.Player;
    playerCell.dataset.playerName = record.Player;
    appendRbSummary(playerCell, data, record, kind);
    tr.append(playerCell);
    const teamKey = scheduleTeamKey(record.MLB, schedule);
    for (const day of days) {
      const td = document.createElement('td');
      const games = teamKey && Array.isArray(schedule.teams?.[teamKey]?.[day]) ? schedule.teams[teamKey][day] : [];
      if (kind === 'hitter') td.append(matchupBlock(games, {includeProbable:true}));
      else if (isStarter(record)) td.append(matchupBlock(games, {starterName:record.Player}));
      else if (isReliever(record) || record.pitcher) td.append(matchupBlock(games));
      tr.append(td);
    }
    body.append(tr);
  }
}

function updateWeeklyHeaders(schedule) {
  const days = schedule?.days;
  if (!Array.isArray(days) || days.length !== 7) return;
  document.querySelectorAll('[data-week-day]').forEach(th => {
    const index = Number(th.dataset.weekDay);
    const d = new Date(`${days[index]}T12:00:00`);
    th.textContent = d.toLocaleDateString([], {weekday:'short', month:'numeric', day:'numeric'});
  });
}

function phoenixDateString() {
  const parts = new Intl.DateTimeFormat('en-CA', {timeZone:'America/Phoenix', year:'numeric', month:'2-digit', day:'2-digit'}).formatToParts(new Date());
  const map = Object.fromEntries(parts.map(p => [p.type, p.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

function todayGames(record, schedule) {
  const day = phoenixDateString();
  const key = scheduleTeamKey(record.MLB, schedule);
  return key && Array.isArray(schedule?.teams?.[key]?.[day]) ? schedule.teams[key][day] : [];
}

function appendRatingCell(tr, label='Not rated', tone='gray') {
  const td = document.createElement('td');
  const span = document.createElement('span');
  span.className = `rating ${tone}`;
  span.textContent = label;
  td.append(span);
  tr.append(td);
}

function renderDailyActions() {
  const host = document.getElementById('daily-actions');
  if (!host) return;
  host.replaceChildren();
  const card = document.createElement('div');
  card.className = 'actioncard';
  card.innerHTML = '<strong>No verified action calls yet</strong><span class="subtle">Opponent data is live. Action calls will return when matchup ratings and recent-form feeds are reconnected.</span>';
  host.append(card);
}

function renderDailyMatchups(hitters, schedule, pool) {
  const body = document.getElementById('daily-matchups');
  if (!body) return;
  const poolById = new Map((pool || []).map(player => [player.fantraxId, player]));
  body.replaceChildren();
  for (const player of hitters) {
    const games = todayGames(player, schedule);
    const trend = dailyTrendFor(poolById.get(player['Player ID']));
    const tr = document.createElement('tr');
    tr.append(cell(player.Player));
    tr.append(cell(games.length ? games.map(g => `${g.home_away === 'away' ? '@' : 'vs '}${g.opponent}`).join(' / ') : 'Off day'));
    tr.append(cell(games.length ? games.map(g => g.opponent_probable_pitcher || 'Not verified').join(' / ') : '—'));
    tr.append(cell(games.length ? 'Not verified' : '—'));
    appendRatingCell(tr, games.length ? 'Not rated' : '—', 'gray');
    appendRatingCell(tr, trend.label, trend.tone);
    body.append(tr);
  }
}

function renderDailyTrends(hitters, pool) {
  const body = document.getElementById('daily-trends');
  if (!body) return;
  body.replaceChildren();
  for (const player of buildDailyTrendRows(hitters, pool)) {
    const tr = document.createElement('tr');
    tr.append(cell(player.name));
    tr.append(cell(formatDailyFpg(player.metrics?.ppg7)));
    tr.append(cell(formatDailyFpg(player.metrics?.ppg14)));
    tr.append(cell(formatDailyFpg(player.metrics?.ppg30)));
    appendRatingCell(tr, player.trend.label, player.trend.tone);
    body.append(tr);
  }
}

function gameCell(game) {
  const td = document.createElement('td');
  td.className = 'gamecell';
  if (!game) {
    td.textContent = 'Not verified';
    return td;
  }
  const top = document.createElement('strong');
  const date = game.date ? new Date(`${game.date}T12:00:00`).toLocaleDateString([], {month:'numeric', day:'numeric'}) : 'Date ?';
  top.textContent = `${date} · ${game.opponent || '?'} · ${Number(game.fantasy_points).toFixed(1)} FP`;
  const detail = document.createElement('small');
  detail.textContent = `${game.innings_pitched ?? '?'} IP · ${game.strikeouts ?? '?'} K · ${game.earned_runs ?? '?'} ER · ${game.hits ?? '?'} H · ${game.walks ?? '?'} BB`;
  td.append(top, detail);
  return td;
}

function renderPitcherRecentGames(pitchers, recent) {
  const body = document.getElementById('daily-pitcher-games');
  if (!body) return;
  body.replaceChildren();
  const map = recent?.players || {};
  for (const pitcher of pitchers) {
    const item = map[pitcher.Player];
    const games = Array.isArray(item?.games) ? item.games.slice(0, 3) : [];
    const tr = document.createElement('tr');
    tr.append(cell(pitcher.Player));
    tr.append(gameCell(games[0]));
    tr.append(gameCell(games[1]));
    tr.append(gameCell(games[2]));
    body.append(tr);
  }
}

function renderCore(data) {
  const roster = rosterRecords(data);
  const hitters = roster.filter(p => !p.pitcher);
  const pitchers = roster.filter(p => p.pitcher);

  renderDailyActions();
  renderDailyMatchups(hitters, data.weekly_schedule, data.pool);
  renderDailyTrends(hitters, data.pool);
  renderPitcherRecentGames(pitchers, data.pitcher_recent_games);

  updateWeeklyHeaders(data.weekly_schedule);
  renderWeeklyTable('weekly-hitters', hitters, data.weekly_schedule, 'hitter', data);
  renderWeeklyTable('weekly-pitchers', pitchers, data.weekly_schedule, 'pitcher', data);

  const note = document.getElementById('weekly-note');
  if (note) {
    note.textContent = data.weekly_schedule
      ? `Verified MLB schedule: ${data.weekly_schedule.week_start} through ${data.weekly_schedule.week_end}. Gray means opponent verified but matchup strength is not yet rated.`
      : 'Verified weekly MLB schedule unavailable.';
  }
  renderSummary(data, roster);
}

function freeAgents(data, query='', type='all') {
  const q = query.trim().toLowerCase();
  const records = (data.pool || []).filter(p => {
    const availability = String(p.availability || '').toLowerCase();
    const isFA = availability.includes('free') || availability === 'fa';
    if (!isFA) return false;
    if (type === 'pitchers' && !isPitcher(p)) return false;
    if (type === 'hitters' && isPitcher(p)) return false;
    const haystack = [p.name,p.mlbTeam,formatPositions(p.positions),p.availability].join(' ').toLowerCase();
    return !q || haystack.includes(q);
  }).slice(0,250).map(p => ({
    Player:p.name,
    MLB:p.mlbTeam,
    Positions:formatPositions(p.positions),
    Availability:p.availability,
  }));
  replaceRows('fa-rows', records, ['Player','MLB','Positions','Availability']);
}

function playerLab(data, query='') {
  const q = query.trim().toLowerCase();
  const records = (data.pool || []).filter(p => {
    if (!q) return false;
    return [p.name,p.mlbTeam,formatPositions(p.positions),p.teamName,p.availability].join(' ').toLowerCase().includes(q);
  }).slice(0,200).map(p => ({
    Player:p.name,
    MLB:p.mlbTeam,
    Positions:formatPositions(p.positions),
    Ownership:p.teamName || p.availability || 'Unavailable',
  }));
  replaceRows('lab-rows', records, ['Player','MLB','Positions','Ownership']);
}

async function refresh() {
  try {
    setStatus('Loading verified snapshot…');
    const response = await fetch(`${SNAPSHOT_URL}?refresh=${Date.now()}`, {cache:'no-store'});
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    snapshot = validateSnapshot(await response.json());
    renderCore(snapshot);
    const faSearch = document.getElementById('fa-search');
    const faType = document.getElementById('fa-type');
    freeAgents(snapshot, faSearch?.value || '', faType?.value || 'all');
    playerLab(snapshot, document.getElementById('lab-search')?.value || '');
    const stamp = new Date(snapshot.generated_at).toLocaleString();
    setStatus(`Last Updated: ${stamp} · ${snapshot.source}`);
  } catch {
    snapshot = null;
    setStatus('Current data unavailable: the latest complete refresh could not be verified.');
    ['daily-matchups','daily-trends','daily-pitcher-games','weekly-hitters','weekly-pitchers','fa-rows','lab-rows'].forEach(id => {
      const body = document.getElementById(id);
      if (body) body.replaceChildren();
    });
  }
}

document.getElementById('fa-search').addEventListener('input', e => snapshot && freeAgents(snapshot, e.target.value, document.getElementById('fa-type').value));
document.getElementById('fa-type').addEventListener('change', e => snapshot && freeAgents(snapshot, document.getElementById('fa-search').value, e.target.value));
document.getElementById('lab-search').addEventListener('input', e => snapshot && playerLab(snapshot, e.target.value));

const initial = location.hash.replace('#','');
if (['daily','weekly','freeagents','lab'].includes(initial)) show(initial);
refresh();
setInterval(refresh, 300000);
