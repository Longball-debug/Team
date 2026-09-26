import { dates, pitchingPoints } from './longball';

export const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
export function fresh(value: unknown, now: Date, minutes: number) {
  const age = typeof value === 'string' ? now.getTime() - Date.parse(value) : NaN;
  return Number.isFinite(age) && age >= 0 && age <= minutes * 60000;
}
export function rate(window: any) {
  return finite(window?.points) && finite(window?.samples) && window.samples > 0
    ? window.points / window.samples : null;
}
export function hitterTrend(p: any) {
  const rates = [p.seven, p.fourteen, p.thirty].map(rate);
  if (rates.some(v => v === null) || p.seven.samples < 4 || p.fourteen.samples < 8 || p.thirty.samples < 10) return null;
  const [a, b, c] = rates as number[];
  const delta = (a - c) / Math.max(5, Math.abs(c));
  return delta > .15 && a > b ? 'up' : delta < -.15 && a < b ? 'down' : 'stable';
}
export function lastStarts(p: any, today: string) {
  const logs = (p.logs ?? []).filter((l: any) => l.date < today && Number(l.stat?.gamesStarted) > 0)
    .sort((a: any, b: any) => b.date.localeCompare(a.date) || (b.game?.gamePk ?? 0) - (a.game?.gamePk ?? 0));
  if (logs.length < 3) return { average: null, trend: null };
  const scores = logs.slice(0, 6).map((l: any) => pitchingPoints(l.stat));
  if (!scores.every(finite)) return { average: null, trend: null };
  const average = scores.slice(0, 3).reduce((a: number, b: number) => a + b, 0) / 3;
  // A directional call needs two comparable sets of three starts.
  const prior = scores.length === 6 ? scores.slice(3).reduce((a: number, b: number) => a + b, 0) / 3 : null;
  const delta = prior === null ? null : (average - prior) / Math.max(5, Math.abs(prior));
  return { average, trend: delta === null ? null : delta > .15 ? 'up' : delta < -.15 ? 'down' : 'stable' };
}
export function isInjuredReserve(p: any) {
  return /^(INJURED[ _-]?RESERVE|IR|IL|IL[ _-]?(7|10|15|60)([ _-]?DAY)?|DL|DL[ _-]?(7|10|15|60))$/i.test(String(p.rosterStatus ?? '').trim());
}
export function dailyModel(c: any, now = new Date()) {
  const today = dates(now).today;
  if (!c || c.today !== today || !fresh(c.generatedAt, now, 15) || c.feed?.status !== 'current' || !fresh(c.feed.generatedAt, now, 15)) return null;
  const allPlayers = c.roster ?? [];
  const injured = allPlayers.filter(isInjuredReserve);
  const injuredHitters = injured.filter((p: any) => !p.pitcher);
  const injuredPitchers = injured.filter((p: any) => p.pitcher);
  const reserves = allPlayers.filter((p: any) => String(p.rosterStatus ?? '').trim().toUpperCase() === 'RESERVE');
  const reserveHitters = reserves.filter((p: any) => !p.pitcher);
  const reservePitchers = reserves.filter((p: any) => p.pitcher);
  const roster = allPlayers.filter((p: any) => String(p.rosterStatus ?? '').trim().toUpperCase() === 'ACTIVE');
  const hitters = roster.filter((p: any) => !p.pitcher && p.matched);
  const pitchers = roster.filter((p: any) => p.pitcher && p.matched).map((p: any) => ({ ...p, recent: lastStarts(p, today) }));
  const hitterRows = c.scheduleVerified ? hitters.flatMap((p: any) => (c.hitterOutlook ?? []).filter((h: any) => h.name === p.name).flatMap((h: any) => h.slate.filter((g: any) => g.date === today).map((g: any) => ({
    ...p, opponent: g.opponent, opposingPitcher: g.pitcher && g.pitcher !== 'TBD' ? g.pitcher : null,
    opposingPitcherHand: /^(LHP|RHP)$/.test(g.pitcherHand ?? '') ? g.pitcherHand : null,
    matchup: finite(g.base) ? g.base >= 25 ? 'Tough' : g.base >= 15 ? 'Neutral' : 'Favorable' : null,
    trendDirection: hitterTrend(p),
  })))) : [];
  const starts = c.scheduleVerified ? (c.starts ?? []).filter((s: any) => s.date === today && !/postpon|cancel/i.test(s.status ?? '')).map((s: any) => ({ ...s, player: pitchers.find((p: any) => p.id === s.id) })).filter((s: any) => s.player) : [];
  const matchup = fresh(c.matchupCapturedAt, now, 24 * 60) ? c.matchup : null;
  // The existing market feed lacks health, role and advanced-source corroboration.
  // Its estimates can support a watch, never an automatic upgrade recommendation.
  const watch = c.marketVerified && fresh(c.matchupCapturedAt, now, 24 * 60) ? (c.market ?? []).filter((p: any) =>
    ['FA', 'WAIVERS'].includes(p.availability) && p.replacement && finite(p.gain) && p.gain > 0 && finite(p.base) &&
    (p.pitcher ? lastStarts(p, today).average !== null : p.thirty?.samples >= 10 && rate(p.seven) !== null && rate(p.fourteen) !== null)
  ).sort((a: any, b: any) => b.gain - a.gain).slice(0, 3) : [];
  return { today, hitters, pitchers, hitterRows, starts, matchup, watch, reserveHitters, reservePitchers, injuredHitters, injuredPitchers };
}
