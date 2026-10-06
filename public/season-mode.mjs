function phoenixParts(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone:'America/Phoenix', year:'numeric', month:'2-digit', day:'2-digit'
  }).formatToParts(now);
  return Object.fromEntries(parts.map(p => [p.type, p.value]));
}

export function seasonMode(data, now = new Date()) {
  const parts = phoenixParts(now);
  const month = Number(parts.month);
  const gamesSeen = Number(data?.weekly_schedule?.games_seen);
  const regularCalendarWindow = month >= 3 && month <= 9;
  const fullRegularWeek = Number.isFinite(gamesSeen) && gamesSeen >= 20;
  const inSeason = regularCalendarWindow || fullRegularWeek;
  return {
    mode: inSeason ? 'in-season' : 'offseason',
    inSeason,
    offseason: !inSeason,
    label: inSeason ? 'IN-SEASON MODE' : 'OFFSEASON MODE',
    reason: inSeason
      ? 'Regular-season calendar window or verified full MLB schedule week.'
      : 'Outside the regular-season calendar window with no verified full MLB schedule week.',
  };
}

export function applySeasonMode(data, root = document) {
  const mode = seasonMode(data);
  root.documentElement?.setAttribute('data-season-mode', mode.mode);
  root.querySelectorAll?.('[data-inseason-only]').forEach(el => { el.hidden = mode.offseason; });
  root.querySelectorAll?.('[data-offseason-only]').forEach(el => { el.hidden = mode.inSeason; });
  const badge = root.getElementById?.('season-mode');
  if (badge) {
    badge.textContent = mode.label;
    badge.className = `pill ${mode.offseason ? 'season-off' : 'season-on'}`;
    badge.title = mode.reason;
  }
  return mode;
}
