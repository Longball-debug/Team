export const SNAPSHOT_URL = 'https://raw.githubusercontent.com/Longball-debug/Team/main/public/fantasygm.json';

export function validateSnapshot(value, now = Date.now()) {
  const fail = () => { throw new Error('The latest complete Fantrax refresh is unavailable or overdue.'); };

  if (!value || value.schema_version !== 1 || value.league_id !== 'gxq8uqpqmg5m5edj') fail();

  const age = now - Date.parse(value.generated_at);
  if (!Number.isFinite(age) || age < -300000 || age > 30 * 3600000) fail();

  if (!Array.isArray(value.teams) || value.teams.length !== 12 || !Array.isArray(value.players) || !value.players.length) fail();

  const teams = new Set(value.teams.map(t => t['Team ID']));
  if (
    teams.size !== 12 ||
    value.teams.some(t =>
      typeof t['Team ID'] !== 'string' || !t['Team ID'] ||
      typeof t.Team !== 'string' || !t.Team.trim() ||
      (t.Record !== undefined && !/^\d+-\d+-\d+$/.test(t.Record)) ||
      (t.Points !== undefined && (typeof t.Points !== 'number' || !Number.isFinite(t.Points)))
    )
  ) fail();

  if (value.teams.filter(t => t.Team.trim().toLowerCase() === 'desert rats').length !== 1) fail();

  if (
    new Set(value.players.map(p => p['Player ID'])).size !== value.players.length ||
    value.players.some(p =>
      typeof p['Player ID'] !== 'string' || !p['Player ID'] ||
      !teams.has(p['Fantasy Team ID']) ||
      ['Player', 'Positions', 'Status', 'MLB Team'].some(k => p[k] !== undefined && p[k] !== null && typeof p[k] !== 'string')
    )
  ) fail();

  if (value.teams.some(t => !value.players.some(p => p['Fantasy Team ID'] === t['Team ID']))) fail();

  if (!Array.isArray(value.pool) || !value.pool.length) fail();
  const poolIds = new Set();
  const allowedAvailability = new Set(['DESERT RATS', 'OTHER TEAM', 'FREE AGENT', 'WAIVERS', 'UNKNOWN']);
  for (const p of value.pool) {
    if (!p || typeof p !== 'object') fail();
    if (typeof p.fantraxId !== 'string' || !p.fantraxId || poolIds.has(p.fantraxId)) fail();
    poolIds.add(p.fantraxId);
    if (typeof p.name !== 'string' || !p.name) fail();
    if (!allowedAvailability.has(p.availability)) fail();
    for (const key of ['mlbTeam', 'positions', 'teamId', 'teamName', 'sourceStatus']) {
      if (p[key] !== null && p[key] !== undefined && typeof p[key] !== 'string') fail();
    }
  }

  if (!value.players.every(p => poolIds.has(p['Player ID']))) fail();

  let transactions = null;
  if (value.transactions !== null && value.transactions !== undefined) {
    if (!Array.isArray(value.transactions)) fail();
    const txIds = new Set();
    transactions = value.transactions.map(t => {
      if (!t || typeof t !== 'object') fail();
      if (typeof t.id !== 'string' || !t.id || txIds.has(t.id)) fail();
      txIds.add(t.id);
      if (!['ADD', 'DROP'].includes(t.action)) fail();
      for (const key of ['fantraxId', 'name', 'teamName', 'date']) {
        if (typeof t[key] !== 'string' || !t[key]) fail();
      }
      if (t.teamId !== null && t.teamId !== undefined && typeof t.teamId !== 'string') fail();
      return {
        id: t.id,
        fantraxId: t.fantraxId,
        name: t.name,
        action: t.action,
        teamName: t.teamName,
        teamId: t.teamId ?? null,
        date: t.date,
      };
    });
  }

  return {
    schema_version: 1,
    league_id: value.league_id,
    generated_at: value.generated_at,
    source: typeof value.source === 'string' && value.source ? value.source : 'Fantrax verified publication',
    teams: value.teams.map(t => ({ Team: t.Team, 'Team ID': t['Team ID'], Record: t.Record, Points: t.Points })),
    players: value.players.map(p => ({
      'Player ID': p['Player ID'],
      'Fantasy Team ID': p['Fantasy Team ID'],
      Player: p.Player,
      Positions: p.Positions,
      Status: p.Status,
      'MLB Team': p['MLB Team'] ?? null,
    })),
    pool: value.pool.map(p => ({
      fantraxId: p.fantraxId,
      name: p.name,
      mlbTeam: p.mlbTeam ?? null,
      availability: p.availability,
      positions: p.positions ?? null,
      teamId: p.teamId ?? null,
      teamName: p.teamName ?? null,
      sourceStatus: p.sourceStatus ?? null,
    })),
    transactions,
    unavailable: Array.isArray(value.unavailable) ? value.unavailable.filter(x => typeof x === 'string') : [],
  };
}
