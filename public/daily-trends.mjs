export function dailyTrendFor(player) {
  if (!Number.isFinite(player?.ppg7) || !Number.isFinite(player?.ppg30) || player.games7 < 2) {
    return {label:'Not enough data', tone:'gray'};
  }
  if (player.ppg30 === 0) return {label:player.ppg7 > 0 ? 'Rising' : 'Steady', tone:player.ppg7 > 0 ? 'green' : 'gray'};
  const change = (player.ppg7 - player.ppg30) / Math.abs(player.ppg30);
  if (change >= 0.15) return {label:'Rising', tone:'green'};
  if (change <= -0.15) return {label:'Falling', tone:'red'};
  return {label:'Steady', tone:'yellow'};
}

export function buildDailyTrendRows(hitters, pool) {
  const poolById = new Map((pool || []).map(player => [player.fantraxId, player]));
  return hitters.map(hitter => {
    const metrics = poolById.get(hitter['Player ID']) || null;
    return {name:hitter.Player, metrics, trend:dailyTrendFor(metrics)};
  }).sort((a,b) => {
    const av = a.metrics?.ppg7;
    const bv = b.metrics?.ppg7;
    const aHas = Number.isFinite(av);
    const bHas = Number.isFinite(bv);
    if (aHas !== bHas) return aHas ? -1 : 1;
    if (aHas && av !== bv) return bv - av;
    return String(a.name).localeCompare(String(b.name));
  });
}

export function formatDailyFpg(value) {
  return Number.isFinite(value) ? Number(value).toFixed(2) : '—';
}
