import { SNAPSHOT_URL, validateSnapshot } from './snapshot-contract.mjs';

const state = { data: null, team: null };
const $ = (id) => document.getElementById(id);

function text(value, fallback='Unavailable') { return value === null || value === undefined || value === '' ? fallback : String(value); }
function esc(value='') { return String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function badge(value) {
  const v = text(value, 'UNKNOWN');
  let cls='muted';
  if (v === 'FREE AGENT') cls='good'; else if (v === 'WAIVERS') cls='warn'; else if (v === 'DESERT RATS') cls='blue'; else if (v === 'OTHER TEAM') cls='bad';
  return `<span class="badge ${cls}">${esc(v)}</span>`;
}
function rows(records, cols) {
  if (!records.length) return `<tr><td colspan="${cols.length}" class="empty">No verified records available.</td></tr>`;
  return records.map(r => `<tr>${cols.map(c => `<td>${c.render ? c.render(r) : esc(text(r[c.key]))}</td>`).join('')}</tr>`).join('');
}
function unavailable(name) { return state.data?.unavailable?.includes(name); }

function show(view) {
  document.querySelectorAll('.view').forEach(el => el.classList.toggle('active', el.id === `view-${view}`));
  document.querySelectorAll('.nav button').forEach(el => el.classList.toggle('active', el.dataset.view === view));
  history.replaceState(null, '', `#${view}`);
  window.scrollTo({top:0, behavior:'instant'});
}

function renderHome() {
  const roster = state.data.players.filter(p => p['Fantasy Team ID'] === state.team['Team ID']);
  const free = state.data.pool.filter(p => p.availability === 'FREE AGENT').length;
  const waivers = state.data.pool.filter(p => p.availability === 'WAIVERS').length;
  $('home-metrics').innerHTML = `
    <div class="metric"><div class="label">Desert Rats roster</div><div class="value">${roster.length}</div></div>
    <div class="metric"><div class="label">League teams</div><div class="value">${state.data.teams.length}</div></div>
    <div class="metric"><div class="label">Free agents</div><div class="value">${free}</div></div>
    <div class="metric"><div class="label">Waivers</div><div class="value">${waivers}</div></div>`;
}

function renderDaily() {
  const roster = state.data.players.filter(p => p['Fantasy Team ID'] === state.team['Team ID'])
    .slice().sort((a,b) => text(a.Player).localeCompare(text(b.Player)));
  $('daily-rows').innerHTML = rows(roster, [
    {key:'Player', render:r=>`<strong>${esc(text(r.Player))}</strong><div class="sub">${esc(text(r['MLB Team'],'MLB team unverified'))}</div>`},
    {key:'Positions'}, {key:'Status', render:r=>badge(r.Status || 'ACTIVE')}
  ]);
  $('daily-note').textContent = unavailable('matchup_scores')
    ? 'Matchup scores and daily advanced ratings are not yet present in the verified shared snapshot. No rating is being guessed.'
    : 'Verified matchup data available.';
}

function renderWeekly() {
  const roster = state.data.players.filter(p => p['Fantasy Team ID'] === state.team['Team ID']);
  const pitchers = roster.filter(p => /(^|,|\s)(SP|RP|P)(,|\s|$)/i.test(text(p.Positions,'')));
  const hitters = roster.filter(p => !pitchers.includes(p));
  $('weekly-hitters').innerHTML = rows(hitters, [
    {key:'Player', render:r=>`<strong>${esc(text(r.Player))}</strong>`}, {key:'Positions'}, {key:'MLB Team'}
  ]);
  $('weekly-pitchers').innerHTML = rows(pitchers, [
    {key:'Player', render:r=>`<strong>${esc(text(r.Player))}</strong>`}, {key:'Positions'},
    {key:'Start 1', render:()=>'<span class="sub">NOT VERIFIED</span>'},
    {key:'Start 2', render:()=>'<span class="sub">NOT VERIFIED</span>'},
    {key:'Rating', render:()=>'<span class="badge muted">NOT VERIFIED</span>'}
  ]);
  $('weekly-note').textContent = unavailable('pitcher_ratings')
    ? 'Weekly opponents, probable starts and Pitcher List ratings are not in the current verified snapshot, so this page deliberately marks them NOT VERIFIED.'
    : 'Verified weekly pitcher data available.';
}

function freeAgentRecords() {
  const q = $('fa-search').value.trim().toLowerCase();
  const pos = $('fa-pos').value;
  return state.data.pool.filter(p => ['FREE AGENT','WAIVERS'].includes(p.availability))
    .filter(p => !q || text(p.name,'').toLowerCase().includes(q))
    .filter(p => !pos || text(p.positions,'').toUpperCase().includes(pos))
    .slice().sort((a,b) => text(a.name).localeCompare(text(b.name))).slice(0,300);
}
function renderFA() {
  $('fa-rows').innerHTML = rows(freeAgentRecords(), [
    {key:'name', render:r=>`<strong>${esc(text(r.name))}</strong><div class="sub">${esc(text(r.mlbTeam,'MLB team unverified'))}</div>`},
    {key:'positions'}, {key:'availability', render:r=>badge(r.availability)},
    {key:'Decision', render:()=>'<span class="badge muted">NOT RATED</span>'}
  ]);
  $('fa-note').textContent = 'This board currently verifies ownership/availability and eligibility only. Statcast, FanGraphs and Baseball Monster decision inputs will be added as separate verified data sources.';
}

function renderTransactions() {
  const tx = Array.isArray(state.data.transactions) ? state.data.transactions : [];
  $('transaction-rows').innerHTML = rows(tx, [
    {key:'date'}, {key:'teamName'}, {key:'action', render:r=>`<span class="badge ${r.action==='ADD'?'good':'bad'}">${esc(r.action)}</span>`}, {key:'name'}
  ]);
}

function labRecords() {
  const q = $('lab-search').value.trim().toLowerCase();
  if (!q) return [];
  return state.data.pool.filter(p => text(p.name,'').toLowerCase().includes(q)).slice(0,25);
}
function renderLab() {
  const matches = labRecords();
  $('lab-results').innerHTML = matches.length ? matches.map(p => `
    <button class="action" data-player="${esc(p.fantraxId)}">${esc(p.name)} · ${esc(text(p.positions,'No position'))}</button>`).join('') : '<div class="empty">Search a player name.</div>';
  $('lab-results').querySelectorAll('[data-player]').forEach(btn => btn.addEventListener('click', () => renderPlayer(btn.dataset.player)));
}
function renderPlayer(id) {
  const p = state.data.pool.find(x => x.fantraxId === id);
  if (!p) return;
  $('player-detail').innerHTML = `
    <div class="panelhead"><div><h3>${esc(p.name)}</h3><div class="sub">Fantrax ID ${esc(p.fantraxId)}</div></div>${badge(p.availability)}</div>
    <div class="playercard">
      <div class="pcell"><div class="k">MLB Team</div><div class="v">${esc(text(p.mlbTeam))}</div></div>
      <div class="pcell"><div class="k">Eligibility</div><div class="v">${esc(text(p.positions))}</div></div>
      <div class="pcell"><div class="k">Fantasy Team</div><div class="v">${esc(text(p.teamName,'Unrostered'))}</div></div>
      <div class="pcell"><div class="k">Source Status</div><div class="v">${esc(text(p.sourceStatus))}</div></div>
    </div>
    <div class="notice" style="margin-top:12px">Advanced performance analysis is intentionally blank until Statcast/FanGraphs/Baseball Monster inputs are connected and verified.</div>`;
}

async function load() {
  const status = $('freshness');
  try {
    const response = await fetch(`${SNAPSHOT_URL}?v=${Date.now()}`, {cache:'no-store'});
    if (!response.ok) throw new Error('snapshot fetch failed');
    state.data = validateSnapshot(await response.json());
    state.team = state.data.teams.find(t => t.Team.trim().toLowerCase() === 'desert rats');
    if (!state.team) throw new Error('Desert Rats not found');
    status.textContent = `Last verified refresh: ${new Date(state.data.generated_at).toLocaleString()} · ${state.data.source}`;
    renderHome(); renderDaily(); renderWeekly(); renderFA(); renderTransactions(); renderLab();
    const initial = ['home','daily','weekly','free-agents','player-lab'].includes(location.hash.slice(1)) ? location.hash.slice(1) : 'home';
    show(initial);
  } catch (err) {
    status.textContent = 'Current data unavailable: latest complete refresh could not be verified.';
    document.querySelectorAll('[data-requires-data]').forEach(el => el.innerHTML = '<div class="empty">Verified data unavailable.</div>');
    console.error(err);
  }
}

document.querySelectorAll('[data-view]').forEach(btn => btn.addEventListener('click', () => show(btn.dataset.view)));
document.querySelectorAll('.back').forEach(btn => btn.addEventListener('click', () => show('home')));
$('fa-search').addEventListener('input', renderFA); $('fa-pos').addEventListener('change', renderFA); $('lab-search').addEventListener('input', renderLab);
load();
