export const SNAPSHOT_URL = 'https://raw.githubusercontent.com/Longball-debug/Team/main/public/fantasygm.json';
export function validateSnapshot(value, now = Date.now()) {
  const fail = () => { throw new Error('The latest complete Fantrax refresh is unavailable or overdue.'); };
  if (!value || value.schema_version !== 1 || value.league_id !== 'gxq8uqpqmg5m5edj') fail();
  const age = now - Date.parse(value.generated_at);
  if (!Number.isFinite(age) || age < -300000 || age > 30*3600000) fail();
  if (!Array.isArray(value.teams) || value.teams.length !== 12 || !Array.isArray(value.players) || !value.players.length) fail();
  const teams = new Set(value.teams.map(t => t['Team ID']));
  if (teams.size !== 12 || value.teams.some(t => typeof t['Team ID'] !== 'string' || !t['Team ID'] || typeof t.Team !== 'string' || !t.Team.trim() || (t.Record !== undefined && !/^\d+-\d+-\d+$/.test(t.Record)) || (t.Points !== undefined && (typeof t.Points !== 'number' || !Number.isFinite(t.Points))))) fail();
  if (value.teams.filter(t => t.Team.trim().toLowerCase() === 'desert rats').length !== 1) fail();
  if (new Set(value.players.map(p => p['Player ID'])).size !== value.players.length || value.players.some(p => typeof p['Player ID'] !== 'string' || !p['Player ID'] || !teams.has(p['Fantasy Team ID']) || ['Player','Positions','Status'].some(k => p[k] !== undefined && typeof p[k] !== 'string'))) fail();
  if (value.teams.some(t => !value.players.some(p => p['Fantasy Team ID'] === t['Team ID']))) fail();
  return {schema_version:1, league_id:value.league_id, generated_at:value.generated_at,
    source:'Fantrax REST API · Airtable verified names',
    teams:value.teams.map(t => ({Team:t.Team,'Team ID':t['Team ID'],Record:t.Record,Points:t.Points})),
    players:value.players.map(p => ({'Player ID':p['Player ID'],'Fantasy Team ID':p['Fantasy Team ID'],Player:p.Player,Positions:p.Positions,Status:p.Status})),
    unavailable:['matchup_scores','starts_used','injury_details','free_agents','pitcher_ratings']};
}
