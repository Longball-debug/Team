import {SNAPSHOT_URL} from './snapshot-contract.mjs';

function signal(item) {
  if (!item?.sample_ok || !Number.isFinite(item.ops)) return null;
  if (item.ops >= 1.000) return {label:'FIC BvP ↑', tone:'green'};
  if (item.ops <= 0.500) return {label:'FIC BvP ↓', tone:'red'};
  return null;
}

function detail(item) {
  const parts = [];
  if (Number.isFinite(item.ops)) parts.push(`${item.ops.toFixed(3)} OPS`);
  if (Number.isFinite(item.ab)) parts.push(`${item.ab} AB`);
  if (Number.isFinite(item.bb)) parts.push(`${item.bb} BB`);
  if (Number.isFinite(item.qAB_pct)) parts.push(`${Math.round(item.qAB_pct)}% qAB`);
  if (Number.isFinite(item.hard_hit_pct)) parts.push(`${Math.round(item.hard_hit_pct)}% HH`);
  return `Fantasy Info Central historical BvP: ${parts.join(' · ')}. Context only; not a start/sit recommendation.`;
}

function decorate(data) {
  const source = data?.fic_matchups;
  const days = data?.weekly_schedule?.days;
  if (!source || source.status !== 'verified' || !Array.isArray(days) || days.length !== 7) return false;
  const rows = [...document.querySelectorAll('#weekly-hitters tr')];
  if (!rows.length) return false;

  for (const row of rows) {
    const cells = row.querySelectorAll('td');
    const name = cells[0]?.dataset.playerName || cells[0]?.textContent?.trim();
    if (!name || !source.players?.[name]) continue;
    days.forEach((day, index) => {
      const item = source.players[name]?.[day];
      const mark = signal(item);
      const target = cells[index + 1]?.querySelector('.match');
      if (!item || !mark || !target || target.querySelector('[data-fic-bvp]')) return;
      const small = document.createElement('small');
      const badge = document.createElement('span');
      badge.dataset.ficBvp = '1';
      badge.className = `rating ${mark.tone}`;
      badge.textContent = mark.label;
      badge.title = detail(item);
      small.append(badge);
      target.append(small);
    });
  }
  return true;
}

async function load() {
  let data;
  try {
    const response = await fetch(`${SNAPSHOT_URL}?fic=${Date.now()}`, {cache:'no-store'});
    if (!response.ok) return;
    data = await response.json();
  } catch {
    return;
  }

  if (decorate(data)) return;
  const body = document.getElementById('weekly-hitters');
  if (!body) return;
  const observer = new MutationObserver(() => {
    if (decorate(data)) observer.disconnect();
  });
  observer.observe(body, {childList:true, subtree:true});
  setTimeout(() => observer.disconnect(), 10000);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', load, {once:true});
else load();
