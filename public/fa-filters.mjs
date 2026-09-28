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

function render() {
  if (!data) return;
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
  }).slice(0, 250);

  body.replaceChildren();
  for (const player of rows) {
    const tr = document.createElement('tr');
    for (const value of [player.name, player.mlbTeam, displayPositions(player.positions), player.availability]) {
      const td = document.createElement('td');
      td.textContent = value || 'Unavailable';
      tr.append(td);
    }
    body.append(tr);
  }
  if (!rows.length) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 4;
    td.className = 'empty';
    td.textContent = 'No verified matching free agents.';
    tr.append(td);
    body.append(tr);
  }
}

async function load() {
  ensurePositionFilter();
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
document.getElementById('fa-search')?.addEventListener('input', render);
document.getElementById('fa-type')?.addEventListener('change', render);
document.querySelectorAll('.reloadbtn').forEach(btn => btn.addEventListener('click', load));
load();
