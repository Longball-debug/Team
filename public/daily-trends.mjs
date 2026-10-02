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

export function selectDailyHitterActions(hitters, pool) {
  const rows = buildDailyTrendRows(hitters, pool)
    .filter(row => Number.isFinite(row.metrics?.ppg7) && row.metrics?.games7 >= 2);
  if (!rows.length) return {hot:null, rising:null, cold:null};

  const hot = rows[0];
  const cold = [...rows].sort((a,b) => {
    if (a.metrics.ppg7 !== b.metrics.ppg7) return a.metrics.ppg7 - b.metrics.ppg7;
    return String(a.name).localeCompare(String(b.name));
  })[0];

  const rising = rows
    .filter(row => row.trend.label === 'Rising' && Number.isFinite(row.metrics?.ppg30))
    .map(row => ({
      ...row,
      riseRate: row.metrics.ppg30 === 0
        ? (row.metrics.ppg7 > 0 ? Infinity : 0)
        : (row.metrics.ppg7 - row.metrics.ppg30) / Math.abs(row.metrics.ppg30),
    }))
    .sort((a,b) => {
      if (b.riseRate !== a.riseRate) return b.riseRate - a.riseRate;
      if (b.metrics.ppg7 !== a.metrics.ppg7) return b.metrics.ppg7 - a.metrics.ppg7;
      return String(a.name).localeCompare(String(b.name));
    })[0] || null;

  return {hot, rising, cold};
}

export function formatDailyFpg(value) {
  return Number.isFinite(value) ? Number(value).toFixed(2) : '—';
}
