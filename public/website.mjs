import {SNAPSHOT_URL, validateSnapshot} from './snapshot-contract.mjs';

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

function desertRatsTeam(data) {
  return data.teams.find(t => t.Team.trim().toLowerCase() === 'desert rats');
}

function rosterRecords(data) {
  const team = desertRatsTeam(data);
  if (!team) return [];
  return data.players
    .filter(p => p['Fantasy Team ID'] === team['Team ID'])
    .map(p => ({
      Player: p.Player,
      MLB: p['MLB Team'],
      Positions: p.Positions,
      Status: p.Status,
    }));
}

function renderCore(data) {
  const roster = rosterRecords(data);
  replaceRows('daily-roster', roster, ['Player','MLB','Positions','Status']);
  replaceRows('weekly-roster', roster, ['Player','MLB','Positions','Status']);
  replaceRows('daily-standings', data.teams.map(t => ({Team:t.Team, Record:t.Record, Points:t.Points})), ['Team','Record','Points']);
}

function freeAgents(data, query='') {
  const q = query.trim().toLowerCase();
  const records = (data.pool || []).filter(p => {
    const availability = String(p.availability || '').toLowerCase();
    const isFA = availability.includes('free') || availability === 'fa';
    if (!isFA) return false;
    const haystack = [p.name,p.mlbTeam,(p.positions || []).join(' '),p.availability].join(' ').toLowerCase();
    return !q || haystack.includes(q);
  }).slice(0,250).map(p => ({
    Player:p.name,
    MLB:p.mlbTeam,
    Positions:Array.isArray(p.positions) ? p.positions.join('/') : p.positions,
    Availability:p.availability,
  }));
  replaceRows('fa-rows', records, ['Player','MLB','Positions','Availability']);
}

function playerLab(data, query='') {
  const q = query.trim().toLowerCase();
  const records = (data.pool || []).filter(p => {
    if (!q) return false;
    return [p.name,p.mlbTeam,(p.positions || []).join(' '),p.teamName,p.availability].join(' ').toLowerCase().includes(q);
  }).slice(0,200).map(p => ({
    Player:p.name,
    MLB:p.mlbTeam,
    Positions:Array.isArray(p.positions) ? p.positions.join('/') : p.positions,
    Ownership:p.teamName || p.availability || 'Unavailable',
  }));
  replaceRows('lab-rows', records, ['Player','MLB','Positions','Ownership']);
}

async function refresh() {
  try {
    const response = await fetch(`${SNAPSHOT_URL}?refresh=${Date.now()}`, {cache:'no-store'});
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    snapshot = validateSnapshot(await response.json());
    renderCore(snapshot);
    freeAgents(snapshot, document.getElementById('fa-search').value);
    playerLab(snapshot, document.getElementById('lab-search').value);
    setStatus(`Last Updated: ${new Date(snapshot.generated_at).toLocaleString()} · ${snapshot.source}`);
  } catch {
    snapshot = null;
    setStatus('Current data unavailable: the latest complete refresh could not be verified.');
    ['daily-roster','weekly-roster','daily-standings','fa-rows','lab-rows'].forEach(id => {
      const body = document.getElementById(id);
      if (body) body.replaceChildren();
    });
  }
}

document.getElementById('fa-search').addEventListener('input', e => snapshot && freeAgents(snapshot, e.target.value));
document.getElementById('lab-search').addEventListener('input', e => snapshot && playerLab(snapshot, e.target.value));

const initial = location.hash.replace('#','');
if (['daily','weekly','freeagents','lab'].includes(initial)) show(initial);
refresh();
setInterval(refresh, 300000);
