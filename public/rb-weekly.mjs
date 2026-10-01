const norm = value => String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
const team = value => {
  const key = String(value || '').trim().toUpperCase();
  return ({AZ:'ARI',CWS:'CHW',KC:'KCR',SD:'SDP',SF:'SFG',TB:'TBR',WSH:'WSN',WAS:'WSN',OAK:'ATH'})[key] || key;
};
const labels = new Set(['START','SIT','LEAN START','LEAN SIT','COIN FLIP','RISKY START']);
const score = (value, kind) => typeof value === 'number' && Number.isFinite(value) && value >= 0 && (kind !== 'pitcher' || value <= 100);

export function rbSummary(data, player, kind, now = new Date()) {
  const unavailable = {label:'RB NOT VERIFIED', details:'RotoBaller: current-week advice unavailable or ambiguous.'};
  const schedule = data?.weekly_schedule;
  const source = data?.rotoballer_weekly?.[kind === 'pitcher' ? 'pitchers' : 'hitters'];
  const today = new Intl.DateTimeFormat('en-CA', {timeZone:'America/Phoenix',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
  if (!schedule || today < schedule.week_start || today > schedule.week_end || source?.status !== 'verified' ||
      source.week_start !== schedule.week_start || source.week_end !== schedule.week_end || !Array.isArray(source.ratings)) return unavailable;
  const matches = source.ratings.filter(r => norm(r.player) === norm(player.Player) && team(r.team) === team(player.MLB));
  const valid = r => r.status === 'verified' && (labels.has(r.recommendation) || score(r.rating, kind));
  const description = r => [labels.has(r.recommendation) ? r.recommendation : null, score(r.rating, kind) ? String(r.rating) : null].filter(Boolean).join(' · ');
  if (kind === 'hitter') {
    if (matches.length !== 1 || !valid(matches[0])) return unavailable;
    const r = matches[0];
    if (!schedule.days?.every(d => Object.hasOwn(r.daily_ratings || {}, d))) return unavailable;
    const daily = schedule.days.map(d => `${d.slice(5)}: ${score(r.daily_ratings[d], kind) ? r.daily_ratings[d] : 'NOT VERIFIED'}`).join('; ');
    return {label:`RB Wk ${description(r)}`, details:`RotoBaller weekly hitter recommendation / score (not the pitcher 0–100 scale). Daily scores: ${daily}. Source: ${source.url}`};
  }
  const key = Object.keys(schedule.teams || {}).find(k => team(k) === team(player.MLB));
  const starts = (schedule.days || []).flatMap(day => (schedule.teams?.[key]?.[day] || [])
    .filter(g => norm(g.team_probable_pitcher) === norm(player.Player)).map(g => ({...g, day})));
  if (!starts.length) return unavailable;
  const results = starts.map(g => {
    const found = matches.filter(r => r.date === g.day && team(r.opponent) === team(g.opponent) && r.home_away === g.home_away);
    const sameDay = starts.filter(s => s.day === g.day && team(s.opponent) === team(g.opponent));
    return {date:g.day, text:found.length === 1 && sameDay.length === 1 && valid(found[0]) ? description(found[0]) : 'NOT VERIFIED'};
  });
  if (results.every(r => r.text === 'NOT VERIFIED')) return unavailable;
  const detail = results.map(r => `${r.date.slice(5)} ${r.text}`).join('; ');
  return {label:results.length === 1 ? `RB ${results[0].text}` : `RB ${results.length} starts`,
    details:`RotoBaller pitcher recommendations / grades (0–100): ${detail}. Source: ${source.url}`};
}

export function appendRbSummary(host, data, player, kind) {
  const summary = rbSummary(data, player, kind);
  const detail = document.createElement('details');
  detail.className = 'subtle rb-weekly';
  const label = document.createElement('summary');
  label.textContent = summary.label;
  const text = document.createElement('small');
  text.textContent = summary.details;
  detail.append(label, text);
  host.append(detail);
}
