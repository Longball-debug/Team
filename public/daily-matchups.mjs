function norm(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\([^)]*\)/g, '')
    .replace(/\b(jr|sr|ii|iii|iv)\b\.?/g, '')
    .replace(/[^a-z0-9]/g, '');
}

export function ficDailyRating(item) {
  if (!item?.sample_ok || !Number.isFinite(item.ops)) {
    return {label:'Not rated', tone:'gray', detail:null};
  }
  const parts = [
    `${item.ops.toFixed(3)} OPS`,
    Number.isFinite(item.ab) ? `${item.ab} AB` : null,
    Number.isFinite(item.bb) ? `${item.bb} BB` : null,
  ].filter(Boolean);
  if (Number.isFinite(item.qAB_pct)) parts.push(`${Math.round(item.qAB_pct)}% qAB`);
  if (Number.isFinite(item.hard_hit_pct)) parts.push(`${Math.round(item.hard_hit_pct)}% HH`);
  const detail = `Fantasy Info Central historical BvP: ${parts.join(' · ')}. Context only.`;
  if (item.ops >= 1.000) return {label:'FIC BvP +', tone:'green', detail};
  if (item.ops <= 0.500) return {label:'FIC BvP −', tone:'red', detail};
  return {label:'FIC BvP neutral', tone:'yellow', detail};
}

export function pitcherListTone(tier) {
  const value = String(tier || '').toLowerCase();
  if (value.includes('auto') || value.includes('probably')) return 'green';
  if (value.includes('questionable')) return 'yellow';
  if (value.includes('do not')) return 'red';
  return 'gray';
}

export function pitcherListDailyRating(pitcherList, day, playerName) {
  if (pitcherList?.status !== 'verified') return null;
  const key = norm(playerName);
  const rows = Array.isArray(pitcherList?.days?.[day]) ? pitcherList.days[day] : [];
  const exact = rows.filter(row => row?.pitcher_key === key);
  const matches = exact.length ? exact : rows.filter(row => norm(row?.pitcher) === key);
  if (matches.length !== 1) return null;
  const item = matches[0];
  if (!Number.isInteger(item.rank)) return null;
  return {
    label:`PL #${item.rank} · ${item.tier || 'Unverified Tier'}`,
    tone:pitcherListTone(item.tier),
    detail:`Pitcher List public SP Streamer ranking: #${item.rank}, ${item.tier || 'Unverified Tier'}${item.matchup ? `, ${item.matchup}` : ''}.`,
  };
}

export function pitcherHandFromFic(item) {
  const text = String(item?.pitcher || '');
  const match = text.match(/\(([LR])\)(?:\s|$)/i);
  return match ? `${match[1].toUpperCase()}HP` : null;
}
