import {SNAPSHOT_URL, validateSnapshot} from './snapshot-contract.mjs';
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

function addMetric(host, label, value, detail='', tone='gray') {
  const card = document.createElement('div');
  card.className = `metric weekly-metric metric-${tone}`;
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
  glance.id = 'weekly-glance-section';
  glance.innerHTML = '<h2>Week at a Glance</h2><div id="weekly-glance" class="summary weekly-summary"></div>';
  note.insertAdjacentElement('afterend', glance);

  const opp = document.createElement('div');
  opp.className = 'section';
  opp.id = 'weekly-opponent-snapshot-section';
  opp.innerHTML = '<h2>Opponent Week Snapshot</h2><div class="tablewrap"><table><thead><tr><th>Day</th><th>Hitter Games</th><th>MLB Opponents Faced</th><th>Probable Opposing SPs</th><th>Our Projected SP Starts</th></tr></thead><tbody id="weekly-opponent-snapshot"></tbody></table></div>';
  glance.insertAdjacentElement('afterend', opp);

  const view = document.createElement('div');
  view.className = 'section';
  view.id = 'weekly-opponent-view-section';
  view.innerHTML = '<h2>Weekly Opponent View</h2><h3>Hitter Opponents</h3><div class="tablewrap"><table><thead><tr><th>Hitter</th><th>Scheduled MLB Opponents</th></tr></thead><tbody id="weekly-opponent-hitters"></tbody></table></div><h3>Projected SP Starts</h3><div class="tablewrap"><table><thead><tr><th>Starter</th><th>Scheduled Start / Opponent</th></tr></thead><tbody id="weekly-opponent-starters"></tbody></table></div><div class="note" style="margin-top:8px">The snapshot does not identify the current fantasy matchup, so this view uses only verified Desert Rats roster and MLB schedule data.</div>';
  opp.insertAdjacentElement('afterend', view);

  const teams = document.createElement('div');
  teams.className = 'section';
  teams.id = 'weekly-team-snapshot-section';
  teams.innerHTML = '<h2>Roster Schedule by MLB Team</h2><div class="tablewrap"><table><thead><tr><th>MLB Team</th><th>Desert Rats Hitters</th><th>Games</th><th>Opponents</th><th>Home / Road</th><th>Probable SP Coverage</th></tr></thead><tbody id="weekly-team-snapshot"></tbody></table></div><div class="note" style="margin-top:8px">Opponent quality is not color-graded until a verified strength source is connected. This section shows the verified schedule only.</div>';
  opp.insertAdjacentElement('afterend', teams);
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

function renderTeamRows(body, hitters, schedule, days) {
  const byTeam = new Map();
  for (const hitter of hitters) {
    const key = teamKey(hitter['MLB Team'], schedule);
    if (!key) continue;
    if (!byTeam.has(key)) byTeam.set(key, []);
    byTeam.get(key).push(hitter.Player);
  }

  const rows = [];
  for (const [key, names] of byTeam.entries()) {
    const games = [];
    for (const day of days) {
      const list = Array.isArray(schedule?.teams?.[key]?.[day]) ? schedule.teams[key][day] : [];
      for (const game of list) games.push(game);
    }
    const opponents = [...new Set(games.map(g => g.opponent).filter(Boolean))];
    const home = games.filter(g => g.home_away === 'home').length;
    const road = games.filter(g => g.home_away === 'away').length;
    const probable = games.filter(g => g.opponent_probable_pitcher).length;
    rows.push({key, names:[...names].sort(), games:games.length, opponents, home, road, probable});
  }
  rows.sort((a,b) => b.games-a.games || a.key.localeCompare(b.key));

  body.replaceChildren();
  for (const row of rows) {
    const tr = document.createElement('tr');
    const values = [
      row.key,
      compactNames(row.names, 3),
      String(row.games),
      compactNames(row.opponents, 4),
      `${row.home} / ${row.road}`,
      row.games ? `${row.probable}/${row.games}` : '0/0'
    ];
    values.forEach((value, index) => {
      const td = document.createElement('td');
      td.textContent = value;
      if (index === 2) td.className = `tone-cell ${row.games >= 7 ? 'green' : row.games === 6 ? 'yellow' : 'red'}`;
      if (index === 5) {
        const coverage = row.games ? row.probable / row.games : 0;
        td.className = `tone-cell ${!row.games ? 'gray' : coverage >= .75 ? 'green' : coverage >= .4 ? 'yellow' : 'red'}`;
      }
      tr.append(td);
    });
    body.append(tr);
  }
}

function renderOpponentView(hitterBody, starterBody, hitters, starters, schedule, days) {
  hitterBody.replaceChildren();
  starterBody.replaceChildren();

  for (const hitter of hitters) {
    const matchups = [];
    for (const day of days) {
      for (const game of gamesFor(hitter, schedule, day)) {
        if (!game.opponent) continue;
        const date = new Date(`${day}T12:00:00`).toLocaleDateString([], {weekday:'short', month:'numeric', day:'numeric'});
        const side = game.home_away === 'away' ? '@' : 'vs';
        matchups.push(`${date} ${side} ${game.opponent}`);
      }
    }
    const tr = document.createElement('tr');
    for (const value of [hitter.Player, matchups.length ? matchups.join(' · ') : 'No scheduled MLB games']) {
      const td = document.createElement('td');
      td.textContent = value;
      tr.append(td);
    }
    hitterBody.append(tr);
  }

  let startCount = 0;
  for (const pitcher of starters) {
    for (const day of days) {
      const games = gamesFor(pitcher, schedule, day).filter(g => normalizedName(g.team_probable_pitcher) === normalizedName(pitcher.Player));
      for (const game of games) {
        if (!game.opponent) continue;
        const date = new Date(`${day}T12:00:00`).toLocaleDateString([], {weekday:'short', month:'numeric', day:'numeric'});
        const side = game.home_away === 'away' ? '@' : 'vs';
        const tr = document.createElement('tr');
        for (const value of [pitcher.Player, `${date} ${side} ${game.opponent}`]) {
          const td = document.createElement('td');
          td.textContent = value;
          tr.append(td);
        }
        starterBody.append(tr);
        startCount += 1;
      }
    }
  }

  if (!startCount) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 2;
    td.className = 'empty';
    td.textContent = 'No verified projected SP starts in the weekly schedule.';
    tr.append(td);
    starterBody.append(tr);
  }
}

function renderSummary(data) {
  ensureWeeklySummary();
  const mode = seasonMode(data);
  for (const id of ['weekly-glance-section','weekly-opponent-snapshot-section','weekly-opponent-view-section','weekly-team-snapshot-section']) {
    const section = document.getElementById(id);
    if (section) section.hidden = mode.offseason;
  }
  if (mode.offseason) return;
  const host = document.getElementById('weekly-glance');
  const body = document.getElementById('weekly-opponent-snapshot');
  const opponentHitters = document.getElementById('weekly-opponent-hitters');
  const opponentStarters = document.getElementById('weekly-opponent-starters');
  const teamBody = document.getElementById('weekly-team-snapshot');
  if (!host || !body || !teamBody || !opponentHitters || !opponentStarters) return;
  host.replaceChildren();
  body.replaceChildren();
  teamBody.replaceChildren();
  opponentHitters.replaceChildren();
  opponentStarters.replaceChildren();

  const schedule = data.weekly_schedule;
  const team = data.teams.find(t => t.Team.trim().toLowerCase() === 'desert rats');
  const roster = data.players.filter(p => p['Fantasy Team ID'] === team?.['Team ID']);
  const hitters = roster.filter(p => !isPitcher(p));
  const starters = roster.filter(p => isStarter(p));
  const days = Array.isArray(schedule?.days) ? schedule.days : [];

  if (days.length !== 7) {
    addMetric(host, 'Schedule', 'Unavailable', 'Verified weekly MLB schedule is missing.');
    for (const target of [body, teamBody, opponentHitters, opponentStarters]) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = target === body ? 5 : target === teamBody ? 6 : 2;
      td.className = 'empty';
      td.textContent = 'Verified weekly snapshot unavailable.';
      tr.append(td);
      target.append(tr);
    }
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
  const sevenGameHitters = hitterCounts.filter(([,c]) => c >= 7).map(([n]) => n);
  const shortWeekHitters = hitterCounts.filter(([,c]) => c > 0 && c <= 6).map(([n,c]) => `${n} (${c})`);
  const pct = hitterGames ? Math.round((probableCoverage / hitterGames) * 100) : 0;

  const avgGames = hitters.length ? hitterGames / hitters.length : 0;
  addMetric(host, 'Hitter Games', hitterGames, `${hitters.length} hitters in roster feed`, avgGames >= 7 ? 'green' : avgGames >= 6 ? 'yellow' : 'red');
  addMetric(host, '7+ Game Hitters', sevenGameHitters.length, compactNames(sevenGameHitters, 2), sevenGameHitters.length ? 'green' : 'yellow');
  addMetric(host, 'Short-Week Hitters', shortWeekHitters.length, compactNames(shortWeekHitters, 2), shortWeekHitters.length === 0 ? 'green' : shortWeekHitters.length <= 2 ? 'yellow' : 'red');
  addMetric(host, 'Projected SP Starts', projectedStarts, `${startsByPitcher.length} starters currently matched`, projectedStarts >= 8 ? 'green' : projectedStarts >= 5 ? 'yellow' : 'red');
  addMetric(host, 'Two-Start SPs', twoStart.length, compactNames(twoStart, 2), twoStart.length >= 2 ? 'green' : twoStart.length === 1 ? 'yellow' : 'gray');
  addMetric(host, 'Probable SP Coverage', `${pct}%`, `${probableCoverage}/${hitterGames} hitter-game matchups named`, pct >= 75 ? 'green' : pct >= 40 ? 'yellow' : 'red');

  for (const day of days) renderDayRow(body, day, hitters, starters, schedule);
  renderTeamRows(teamBody, hitters, schedule, days);
  renderOpponentView(opponentHitters, opponentStarters, hitters, starters, schedule, days);
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
