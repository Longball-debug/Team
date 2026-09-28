import {SNAPSHOT_URL, validateSnapshot} from './snapshot-contract.mjs';

let data = null;

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

function ensureStatColumns() {
  const body = document.getElementById('fa-rows');
  const table = body?.closest('table');
  const row = table?.querySelector('thead tr');
  if (!row) return;

  // Always rebuild the header so repeated loads can never accumulate columns.
  row.replaceChildren();
  for (const label of ['Player','MLB','Positions','Availability','14D Points','14D PPG']) {
    const th = document.createElement('th');
    th.textContent = label;
    row.append(th);
  }

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

function render() {
  if (!data) return;
  ensureStatColumns();
  const body = document.getElementById('fa-rows');
  if (!body) return;
  const q = String(document.getElementById('fa-search')?.value || '').trim().toLowerCase();
  const type = document.getElementById('fa-type')?.value || 'all';
  const position = document.getElementById('fa-position')?.value || 'all';

  const rows = (data.pool || []).filter(player => {
    if (!isFreeAgent(player)) return false;
    if (type === 'pitchers' && !isPitcher(player)) return false;
    if (type === 'hitters' && isPitcher(player)) return false;
    if (!matchesPosition(player, position)) return false;
    const haystack = [player.name, player.mlbTeam, displayPositions(player.positions), player.availability].join(' ').toLowerCase();
    return !q || haystack.includes(q);
  }).sort((a, b) => {
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
    for (const value of [
      player.name,
      player.mlbTeam,
      displayPositions(player.positions),
      player.availability,
      fmt(player.points14, 1),
      fmt(player.ppg14, 2),
    ]) {
      const td = document.createElement('td');
      td.textContent = value || 'Unavailable';
      tr.append(td);
    }
    body.append(tr);
  }
  if (!rows.length) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 6;
    td.className = 'empty';
    td.textContent = 'No verified matching free agents.';
    tr.append(td);
    body.append(tr);
  }

  const note = document.getElementById('fa-14d-note');
  if (note) {
    const recent = data.recent_14d;
    note.textContent = recent?.start_date && recent?.end_date
      ? `Sorted by 14-day fantasy points, high to low. Window: ${recent.start_date} through ${recent.end_date}. ${recent.source || ''}`
      : '14-day fantasy-point feed is not verified in the current snapshot.';
  }
}

async function load() {
  ensurePositionFilter();
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
ensureStatColumns();
document.getElementById('fa-search')?.addEventListener('input', render);
document.getElementById('fa-type')?.addEventListener('change', render);
document.querySelectorAll('.reloadbtn').forEach(btn => btn.addEventListener('click', load));
load();
