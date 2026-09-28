import './fa-filters.mjs';
import {SNAPSHOT_URL, validateSnapshot} from './snapshot-contract.mjs';

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

function isStarter(player) {
  return normalizePositions(player.Positions).some(p => p.toUpperCase() === 'SP');
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

function gamesFor(player, schedule, day) {
  const key = teamKey(player['MLB Team'], schedule);
  return key && Array.isArray(schedule?.teams?.[key]?.[day]) ? schedule.teams[key][day] : [];
}

function addMetric(host, label, value, detail='') {
  const card = document.createElement('div');
  card.className = 'metric weekly-metric';
  card.innerHTML = `<div class="label">${label}</div><div class="value">${value}</div>${detail ? `<div class="subtle">${detail}</div>` : ''}`;
  host.append(card);
}

function compactNames(items, limit=3) {
  if (!items.length) return 'None';
  const first = items.slice(0, limit).join(', ');
  return items.length > limit ? `${first} +${items.length-limit}` : first;
}

function ensureWeeklySummary() {
  const weekly = document.getElementById('weekly');
  const note = document.getElementById('weekly-note');
  if (!weekly || !note || document.getElementById('weekly-glance')) return;

  const glance = document.createElement('div');
  glance.className = 'section';
  glance.innerHTML = '<h2>Week at a Glance</h2><div id="weekly-glance" class="summary weekly-summary"></div>';
  note.insertAdjacentElement('afterend', glance);

  const opp = document.createElement('div');
  opp.className = 'section';
  opp.innerHTML = '<h2>Opponent Week Snapshot</h2><div class="tablewrap"><table><thead><tr><th>Day</th><th>Roster Games</th><th>MLB Opponents Faced</th><th>Probable Opposing SPs</th><th>Our Projected SP Starts</th></tr></thead><tbody id="weekly-opponent-snapshot"></tbody></table></div><div class="note" style="margin-top:8px">This is the verified MLB opponent slate for Desert Rats players. Fantasy matchup-opponent roster/start totals will be added when that Fantrax matchup feed is available.</div>';
  glance.insertAdjacentElement('afterend', opp);
}

function renderDayRow(body, day, hitters, starters, schedule) {
  const hitterGames = hitters.flatMap(p => gamesFor(p, schedule, day));
  const opponents = [...new Set(hitterGames.map(g => g.opponent).filter(Boolean))].sort();
  const probableSPs = [...new Set(hitterGames.map(g => g.opponent_probable_pitcher).filter(Boolean))].sort();

  let projectedStarts = 0;
  const startNames = [];
  for (const pitcher of starters) {
    const games = gamesFor(pitcher, schedule, day);
    if (games.some(g => normalizedName(g.team_probable_pitcher) === normalizedName(pitcher.Player))) {
      projectedStarts += 1;
      startNames.push(pitcher.Player);
    }
  }

  const tr = document.createElement('tr');
  const label = new Date(`${day}T12:00:00`).toLocaleDateString([], {weekday:'short', month:'numeric', day:'numeric'});
  for (const value of [
    label,
    String(hitterGames.length),
    compactNames(opponents, 5),
    compactNames(probableSPs, 4),
    projectedStarts ? `${projectedStarts} · ${compactNames(startNames, 2)}` : '0'
  ]) {
    const td = document.createElement('td');
    td.textContent = value;
    tr.append(td);
  }
  body.append(tr);
}

function renderSummary(data) {
  ensureWeeklySummary();
  const host = document.getElementById('weekly-glance');
  const body = document.getElementById('weekly-opponent-snapshot');
  if (!host || !body) return;
  host.replaceChildren();
  body.replaceChildren();

  const schedule = data.weekly_schedule;
  const team = data.teams.find(t => t.Team.trim().toLowerCase() === 'desert rats');
  const roster = data.players.filter(p => p['Fantasy Team ID'] === team?.['Team ID']);
  const hitters = roster.filter(p => !isPitcher(p));
  const starters = roster.filter(p => isStarter(p));
  const days = Array.isArray(schedule?.days) ? schedule.days : [];

  if (days.length !== 7) {
    addMetric(host, 'Schedule', 'Unavailable', 'Verified weekly MLB schedule is missing.');
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 5;
    td.className = 'empty';
    td.textContent = 'Verified opponent snapshot unavailable.';
    tr.append(td);
    body.append(tr);
    return;
  }

  let hitterGames = 0;
  let probableCoverage = 0;
  let projectedStarts = 0;
  const startsByPitcher = [];
  const hitterCounts = [];

  for (const hitter of hitters) {
    let count = 0;
    for (const day of days) {
      const games = gamesFor(hitter, schedule, day);
      count += games.length;
      hitterGames += games.length;
      probableCoverage += games.filter(g => g.opponent_probable_pitcher).length;
    }
    hitterCounts.push([hitter.Player, count]);
  }

  for (const pitcher of starters) {
    let count = 0;
    for (const day of days) {
      const games = gamesFor(pitcher, schedule, day);
      if (games.some(g => normalizedName(g.team_probable_pitcher) === normalizedName(pitcher.Player))) count += 1;
    }
    if (count) {
      projectedStarts += count;
      startsByPitcher.push([pitcher.Player, count]);
    }
  }

  const twoStart = startsByPitcher.filter(([,c]) => c >= 2).map(([n,c]) => `${n} (${c})`);
  hitterCounts.sort((a,b) => b[1]-a[1] || a[0].localeCompare(b[0]));
  const maxGames = hitterCounts[0]?.[1] ?? 0;
  const minGames = hitterCounts[hitterCounts.length-1]?.[1] ?? 0;
  const busiest = hitterCounts.filter(([,c]) => c === maxGames).map(([n]) => n);
  const lightest = hitterCounts.filter(([,c]) => c === minGames).map(([n]) => n);
  const pct = hitterGames ? Math.round((probableCoverage / hitterGames) * 100) : 0;

  addMetric(host, 'Hitter Games', hitterGames, `${hitters.length} active hitters in roster feed`);
  addMetric(host, 'Projected SP Starts', projectedStarts, `${startsByPitcher.length} starters currently matched`);
  addMetric(host, 'Two-Start SPs', twoStart.length, compactNames(twoStart, 2));
  addMetric(host, 'Probable SP Coverage', `${pct}%`, `${probableCoverage}/${hitterGames} hitter-game matchups named`);
  addMetric(host, 'Busiest Hitter Slate', `${maxGames} games`, compactNames(busiest, 2));
  addMetric(host, 'Lightest Hitter Slate', `${minGames} games`, compactNames(lightest, 2));

  for (const day of days) renderDayRow(body, day, hitters, starters, schedule);
}

async function load() {
  try {
    const response = await fetch(`${SNAPSHOT_URL}?weeklySummary=${Date.now()}`, {cache:'no-store'});
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    renderSummary(validateSnapshot(await response.json()));
  } catch {
    ensureWeeklySummary();
    const host = document.getElementById('weekly-glance');
    if (host) {
      host.replaceChildren();
      addMetric(host, 'Weekly Snapshot', 'Unavailable', 'Latest complete data could not be verified.');
    }
  }
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', load, {once:true});
else load();
