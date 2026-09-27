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
document.querySelectorAll('.reloadbtn').forEach(btn => btn.addEventListener('click', () => refresh()));

function desertRatsTeam(data) {
  return data.teams.find(t => t.Team.trim().toLowerCase() === 'desert rats');
}

function normalizePositions(value) {
  if (Array.isArray(value)) return value.map(String);
  if (!value) return [];
  return String(value).split('/').map(v => v.trim()).filter(Boolean);
}

function isPitcher(record) {
  const positions = normalizePositions(record.positions ?? record.Positions);
  return positions.some(p => ['P','SP','RP'].includes(p.toUpperCase()));
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
      pitcher: isPitcher(p),
    }))
    .sort((a,b) => String(a.Player).localeCompare(String(b.Player)));
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

function renderCore(data) {
  const roster = rosterRecords(data);
  const hitters = roster.filter(p => !p.pitcher);
  const pitchers = roster.filter(p => p.pitcher);
  replaceRows('daily-hitters', hitters, ['Player','MLB','Positions','Status']);
  replaceRows('daily-pitchers', pitchers, ['Player','MLB','Positions','Status']);
  replaceRows('weekly-hitters', hitters, ['Player','MLB','Positions','Status']);
  replaceRows('weekly-pitchers', pitchers, ['Player','MLB','Positions','Status']);
  replaceRows('daily-standings', data.teams.map(t => ({Team:t.Team, Record:t.Record, Points:t.Points})), ['Team','Record','Points']);
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
    const haystack = [p.name,p.mlbTeam,normalizePositions(p.positions).join(' '),p.availability].join(' ').toLowerCase();
    return !q || haystack.includes(q);
  }).slice(0,250).map(p => ({
    Player:p.name,
    MLB:p.mlbTeam,
    Positions:normalizePositions(p.positions).join('/'),
    Availability:p.availability,
  }));
  replaceRows('fa-rows', records, ['Player','MLB','Positions','Availability']);
}

function playerLab(data, query='') {
  const q = query.trim().toLowerCase();
  const records = (data.pool || []).filter(p => {
    if (!q) return false;
    return [p.name,p.mlbTeam,normalizePositions(p.positions).join(' '),p.teamName,p.availability].join(' ').toLowerCase().includes(q);
  }).slice(0,200).map(p => ({
    Player:p.name,
    MLB:p.mlbTeam,
    Positions:normalizePositions(p.positions).join('/'),
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
    ['daily-hitters','daily-pitchers','weekly-hitters','weekly-pitchers','daily-standings','fa-rows','lab-rows'].forEach(id => {
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
