import {SNAPSHOT_URL} from './snapshot-contract.mjs';

function norm(value) {
  return String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\([^)]*\)/g, '').replace(/\b(jr|sr|ii|iii|iv)\b\.?/g, '').replace(/[^a-z0-9]/g, '');
}

function tone(tier) {
  const t = String(tier || '').toLowerCase();
  if (t.includes('auto')) return 'green';
  if (t.includes('probably')) return 'green';
  if (t.includes('questionable')) return 'yellow';
  if (t.includes('do not')) return 'red';
  return 'gray';
}

function badge(item, prefix='PL') {
  const span = document.createElement('span');
  span.dataset.pitcherList = '1';
  span.className = `rating ${tone(item.tier)}`;
  span.textContent = `${prefix} #${item.rank} · ${item.tier}`;
  span.title = `Pitcher List public SP Streamer ranking: #${item.rank}, ${item.tier}, ${item.matchup}.`;
  return span;
}

function dayRows(data, day) {
  return Array.isArray(data?.pitcher_list?.days?.[day]) ? data.pitcher_list.days[day] : [];
}

function decorateHitters(data, days) {
  for (const row of document.querySelectorAll('#weekly-hitters tr')) {
    const cells = row.querySelectorAll('td');
    days.forEach((day, index) => {
      const target = cells[index + 1]?.querySelector('.match');
      if (!target || target.querySelector('[data-pitcher-list]')) return;
      const text = target.textContent || '';
      const candidates = dayRows(data, day);
      const match = candidates.find(item => text.includes(item.pitcher)) || candidates.find(item => norm(text).includes(item.pitcher_key));
      if (!match) return;
      const small = document.createElement('small');
      small.append(badge(match, 'Opp SP PL'));
      target.append(small);
    });
  }
}

function decoratePitchers(data, days) {
  for (const row of document.querySelectorAll('#weekly-pitchers tr')) {
    const cells = row.querySelectorAll('td');
    const player = cells[0]?.dataset.playerName || cells[0]?.textContent?.trim();
    if (!player) continue;
    days.forEach((day, index) => {
      const target = cells[index + 1]?.querySelector('.match');
      if (!target || target.querySelector('[data-pitcher-list]')) return;
      const key = norm(player);
      const match = dayRows(data, day).find(item => item.pitcher_key === key);
      if (!match) return;
      const small = document.createElement('small');
      small.append(badge(match));
      target.append(small);
    });
  }
}

function decorate(data) {
  const days = data?.weekly_schedule?.days;
  if (data?.pitcher_list?.status !== 'verified' || !Array.isArray(days) || days.length !== 7) return false;
  const hitterRows = document.querySelectorAll('#weekly-hitters tr');
  const pitcherRows = document.querySelectorAll('#weekly-pitchers tr');
  if (!hitterRows.length || !pitcherRows.length) return false;
  decorateHitters(data, days);
  decoratePitchers(data, days);
  return true;
}

async function load() {
  let data;
  try {
    const response = await fetch(`${SNAPSHOT_URL}?pl=${Date.now()}`, {cache:'no-store'});
    if (!response.ok) return;
    data = await response.json();
  } catch { return; }
  if (decorate(data)) return;
  const weekly = document.getElementById('weekly');
  if (!weekly) return;
  const observer = new MutationObserver(() => {
    if (decorate(data)) observer.disconnect();
  });
  observer.observe(weekly, {childList:true, subtree:true});
  setTimeout(() => observer.disconnect(), 10000);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', load, {once:true});
else load();
