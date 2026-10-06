import {SNAPSHOT_URL, validateSnapshot} from './snapshot-contract.mjs';
import {pitcherListDailyRating} from './daily-matchups.mjs';
import {seasonMode} from './season-mode.mjs';

const TEAM_ALIASES = {
  AZ:'ARI', ARI:'ARI', CWS:'CHW', CHW:'CHW', KC:'KCR', KCR:'KCR',
  SD:'SDP', SDP:'SDP', SF:'SFG', SFG:'SFG', TB:'TBR', TBR:'TBR',
  WSH:'WSN', WSN:'WSN', OAK:'ATH', ATH:'ATH'
};

function normalizePositions(value) {
  if (Array.isArray(value)) return value.map(v => String(v).trim()).filter(Boolean);
  if (!value) return [];
  return String(value).split(/[\/,|]/).map(v => v.trim()).filter(Boolean);
}

function isPitcher(player) {
  return normalizePositions(player.Positions).some(p => ['P','SP','RP'].includes(p.toUpperCase()));
}

function phoenixDateString() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone:'America/Phoenix', year:'numeric', month:'2-digit', day:'2-digit'
  }).formatToParts(new Date());
  const map = Object.fromEntries(parts.map(p => [p.type, p.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

function normalizedName(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\b(jr|sr|ii|iii|iv)\b\.?/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function teamKey(team, schedule) {
  const raw = String(team || '').trim().toUpperCase();
  if (schedule?.teams?.[raw]) return raw;
  const alias = TEAM_ALIASES[raw];
  return alias && schedule?.teams?.[alias] ? alias : null;
}

function todayGames(player, schedule) {
  const key = teamKey(player['MLB Team'], schedule);
  const day = phoenixDateString();
  return key && Array.isArray(schedule?.teams?.[key]?.[day]) ? schedule.teams[key][day] : [];
}

function roleLabel(player, games) {
  const pos = normalizePositions(player.Positions).map(p => p.toUpperCase());
  const isSP = pos.includes('SP');
  const isRP = pos.includes('RP');
  const starting = games.some(g => normalizedName(g.team_probable_pitcher) === normalizedName(player.Player));
  if (isSP && starting) return 'SP — START';
  if (isSP && isRP) return 'SP/RP — bullpen';
  if (isSP) return 'SP — no start';
  if (isRP) return 'RP — bullpen';
  return 'P — bullpen';
}

function opponentLabel(games) {
  if (!games.length) return 'Off day';
  return games.map(g => `${g.home_away === 'away' ? '@' : 'vs '}${g.opponent || '?'}`).join(' / ');
}

function recentGamesFor(player, recent) {
  const item = recent?.players?.[player.Player];
  if (item?.identity_status !== 'VERIFIED' || item?.fantrax_id !== player['Player ID']) return [];
  return Array.isArray(item.games) ? item.games.slice(0, 3) : [];
}

function trendFor(games) {
  const values = games.map(g => Number(g.fantasy_points)).filter(Number.isFinite);
  if (values.length < 2) return {label:'Not enough data', tone:'gray'};
  if (values.length >= 3 && values[0] > values[1] && values[1] >= values[2]) return {label:'↑ Rising', tone:'green'};
  if (values.length >= 3 && values[0] < values[1] && values[1] <= values[2]) return {label:'↓ Falling', tone:'red'};
  if (values[0] > values[1]) return {label:'↑ Improving', tone:'green'};
  if (values[0] < values[1]) return {label:'↓ Cooling', tone:'red'};
  return {label:'→ Steady', tone:'yellow'};
}

function td(text) {
  const el = document.createElement('td');
  el.textContent = text;
  return el;
}

function ratingCell(label, tone='gray', title='') {
  const cell = document.createElement('td');
  const span = document.createElement('span');
  span.className = `rating ${tone}`;
  span.textContent = label;
  if (title) span.title = title;
  cell.append(span);
  return cell;
}

function todayCell(games, role) {
  const cell = document.createElement('td');
  cell.className = 'daily-matchup';
  const top = document.createElement('strong');
  top.textContent = opponentLabel(games);
  const detail = document.createElement('small');
  detail.className = 'daily-role';
  detail.textContent = role;
  cell.append(top, detail);
  return cell;
}

function ensureSection() {
  if (document.getElementById('daily-pitcher-matchups')) return;
  const hitterBody = document.getElementById('daily-matchups');
  const hitterSection = hitterBody?.closest('.section');
  if (!hitterSection) return;
  const section = document.createElement('div');
  section.className = 'section';
  section.id = 'daily-pitcher-section';
  section.innerHTML = '<h2 id="daily-pitcher-title">Pitchers — Today\'s Matchups</h2><div class="tablewrap"><table class="daily-compact"><thead id="daily-pitcher-head"><tr><th>Player</th><th>Today</th><th>PL Rating</th><th>Last 3 FP</th><th>Trend</th></tr></thead><tbody id="daily-pitcher-matchups"></tbody></table></div><div id="daily-pitcher-note" class="note" style="margin-top:8px">SP starts are matched to MLB probable starters. Verified Pitcher List rankings appear for today’s starter; RP/P rows stay ungraded.</div>';
  hitterSection.insertAdjacentElement('afterend', section);
}

async function render() {
  ensureSection();
  const body = document.getElementById('daily-pitcher-matchups');
  if (!body) return;
  try {
    const response = await fetch(`${SNAPSHOT_URL}?pitchers=${Date.now()}`, {cache:'no-store'});
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = validateSnapshot(await response.json());
    const mode = seasonMode(data);
    const title = document.getElementById('daily-pitcher-title');
    const head = document.getElementById('daily-pitcher-head');
    const note = document.getElementById('daily-pitcher-note');
    if (title) title.textContent = mode.offseason ? 'Pitchers — Recent Form' : 'Pitchers — Today\'s Matchups';
    if (head) head.innerHTML = mode.offseason
      ? '<tr><th>Player</th><th>Last 3 FP</th><th>Trend</th></tr>'
      : '<tr><th>Player</th><th>Today</th><th>PL Rating</th><th>Last 3 FP</th><th>Trend</th></tr>';
    if (note) note.textContent = mode.offseason
      ? 'OFFSEASON MODE: last-three verified pitching results remain available; daily opponent and Pitcher List matchup fields are hidden.'
      : 'SP starts are matched to MLB probable starters. Verified Pitcher List rankings appear for today’s starter; RP/P rows stay ungraded.';
    const team = data.teams.find(t => t.Team.trim().toLowerCase() === 'desert rats');
    const pitchers = data.players
      .filter(p => p['Fantasy Team ID'] === team?.['Team ID'] && isPitcher(p))
      .sort((a,b) => String(a.Player).localeCompare(String(b.Player)));
    body.replaceChildren();
    for (const player of pitchers) {
      const games = todayGames(player, data.weekly_schedule);
      const recent = recentGamesFor(player, data.pitcher_recent_games);
      const trend = trendFor(recent);
      const row = document.createElement('tr');
      row.append(td(player.Player));
      if (!mode.offseason) {
        const role = roleLabel(player, games);
        row.append(todayCell(games, role));
        const pl = role === 'SP — START' ? pitcherListDailyRating(data.pitcher_list, phoenixDateString(), player.Player) : null;
        row.append(ratingCell(pl?.label || (games.length ? 'Not rated' : '—'), pl?.tone || 'gray', pl?.detail || ''));
      }
      row.append(td(recent.length ? recent.map(g => Number(g.fantasy_points).toFixed(1)).join(' / ') : 'Not verified'));
      row.append(ratingCell(trend.label, trend.tone));
      body.append(row);
    }
  } catch {
    body.replaceChildren();
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.colSpan = 5;
    cell.className = 'empty';
    cell.textContent = 'Current pitcher matchup data unavailable.';
    row.append(cell);
    body.append(row);
  }
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', render, {once:true});
else render();
