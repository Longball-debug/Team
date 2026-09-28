export const SNAPSHOT_URL = 'https://raw.githubusercontent.com/Longball-debug/Team/main/public/fantasygm.json';

function cleanPool(pool) {
  if (!Array.isArray(pool)) return [];
  return pool.map(p => ({
    fantraxId:p.fantraxId,
    name:p.name,
    mlbTeam:p.mlbTeam,
    availability:p.availability,
    positions:p.positions,
    teamId:p.teamId,
    teamName:p.teamName,
    sourceStatus:p.sourceStatus,
    points7:Number.isFinite(p.points7) ? p.points7 : null,
    games7:Number.isFinite(p.games7) ? p.games7 : null,
    ppg7:Number.isFinite(p.ppg7) ? p.ppg7 : null,
    points14:Number.isFinite(p.points14) ? p.points14 : null,
    games14:Number.isFinite(p.games14) ? p.games14 : null,
    ppg14:Number.isFinite(p.ppg14) ? p.ppg14 : null,
    points30:Number.isFinite(p.points30) ? p.points30 : null,
    games30:Number.isFinite(p.games30) ? p.games30 : null,
    ppg30:Number.isFinite(p.ppg30) ? p.ppg30 : null,
    seasonMetrics:p.seasonMetrics && typeof p.seasonMetrics === 'object' ? {...p.seasonMetrics} : null,
  }));
}

function cleanWeeklySchedule(schedule) {
  if (!schedule || !Array.isArray(schedule.days) || schedule.days.length !== 7 || !schedule.teams || typeof schedule.teams !== 'object') return null;
  const teams = {};
  for (const [abbr, dates] of Object.entries(schedule.teams)) {
    if (typeof abbr !== 'string' || !dates || typeof dates !== 'object') continue;
    teams[abbr] = {};
    for (const [day, games] of Object.entries(dates)) {
      if (!Array.isArray(games)) continue;
      teams[abbr][day] = games.map(g => ({
        opponent:g.opponent,
        home_away:g.home_away,
        game_pk:g.game_pk,
        team_probable_pitcher:g.team_probable_pitcher,
        opponent_probable_pitcher:g.opponent_probable_pitcher,
        status:g.status,
      }));
    }
  }
  return {
    source:schedule.source,
    week_start:schedule.week_start,
    week_end:schedule.week_end,
    days:[...schedule.days],
    games_seen:schedule.games_seen,
    teams,
  };
}

function cleanPitcherRecentGames(value) {
  if (!value || typeof value !== 'object' || !value.players || typeof value.players !== 'object') return null;
  const players = {};
  for (const [name, item] of Object.entries(value.players)) {
    if (!item || typeof item !== 'object') continue;
    players[name] = {
      mlb_id:item.mlb_id,
      mode:item.mode,
      source_status:item.source_status,
      games:Array.isArray(item.games) ? item.games.slice(0,3).map(g => ({
        date:g.date,
        opponent:g.opponent,
        innings_pitched:g.innings_pitched,
        strikeouts:g.strikeouts,
        earned_runs:g.earned_runs,
        hits:g.hits,
        walks:g.walks,
        wins:g.wins,
        losses:g.losses,
        saves:g.saves,
        holds:g.holds,
        blown_saves:g.blown_saves,
        fantasy_points:g.fantasy_points,
      })) : [],
    };
  }
  return {source:value.source, season:value.season, players};
}

function cleanRecent14(value) {
  if (!value || typeof value !== 'object') return null;
  return {
    source:typeof value.source === 'string' ? value.source : null,
    start_date:typeof value.start_date === 'string' ? value.start_date : null,
    end_date:typeof value.end_date === 'string' ? value.end_date : null,
    matched_pool_players:Number.isFinite(value.matched_pool_players) ? value.matched_pool_players : null,
  };
}

function cleanPlayerLab(value) {
  if (!value || typeof value !== 'object') return null;
  return {
    source:typeof value.source === 'string' ? value.source : null,
    season:Number.isFinite(value.season) ? value.season : null,
    recent_end_date:typeof value.recent_end_date === 'string' ? value.recent_end_date : null,
    window7_start:typeof value.window7_start === 'string' ? value.window7_start : null,
    window30_start:typeof value.window30_start === 'string' ? value.window30_start : null,
    matched_pool_players:Number.isFinite(value.matched_pool_players) ? value.matched_pool_players : null,
  };
}

export function validateSnapshot(value, now = Date.now()) {
  const fail = () => { throw new Error('The latest complete Fantrax refresh is unavailable or overdue.'); };
  if (!value || value.schema_version !== 1 || value.league_id !== 'gxq8uqpqmg5m5edj') fail();
  const age = now - Date.parse(value.generated_at);
  if (!Number.isFinite(age) || age < -300000 || age > 30*3600000) fail();
  if (!Array.isArray(value.teams) || value.teams.length !== 12 || !Array.isArray(value.players) || !value.players.length) fail();
  const teams = new Set(value.teams.map(t => t['Team ID']));
  if (teams.size !== 12 || value.teams.some(t => typeof t['Team ID'] !== 'string' || !t['Team ID'] || typeof t.Team !== 'string' || !t.Team.trim() || (t.Record !== undefined && !/^\d+-\d+-\d+$/.test(t.Record)) || (t.Points !== undefined && (typeof t.Points !== 'number' || !Number.isFinite(t.Points))))) fail();
  if (value.teams.filter(t => t.Team.trim().toLowerCase() === 'desert rats').length !== 1) fail();
  if (new Set(value.players.map(p => p['Player ID'])).size !== value.players.length || value.players.some(p => typeof p['Player ID'] !== 'string' || !p['Player ID'] || !teams.has(p['Fantasy Team ID']) || ['Player','Positions','Status','MLB Team'].some(k => p[k] !== undefined && p[k] !== null && typeof p[k] !== 'string'))) fail();
  if (value.teams.some(t => !value.players.some(p => p['Fantasy Team ID'] === t['Team ID']))) fail();

  return {
    schema_version:1,
    league_id:value.league_id,
    generated_at:value.generated_at,
    source:typeof value.source === 'string' ? value.source : 'Fantrax REST API',
    teams:value.teams.map(t => ({Team:t.Team,'Team ID':t['Team ID'],Record:t.Record,Points:t.Points})),
    players:value.players.map(p => ({'Player ID':p['Player ID'],'Fantasy Team ID':p['Fantasy Team ID'],Player:p.Player,'MLB Team':p['MLB Team'],Positions:p.Positions,Status:p.Status})),
    pool:cleanPool(value.pool),
    transactions:Array.isArray(value.transactions) ? value.transactions.map(t => ({...t})) : null,
    weekly_schedule:cleanWeeklySchedule(value.weekly_schedule),
    pitcher_recent_games:cleanPitcherRecentGames(value.pitcher_recent_games),
    recent_14d:cleanRecent14(value.recent_14d),
    player_lab:cleanPlayerLab(value.player_lab),
    unavailable:Array.isArray(value.unavailable) ? [...value.unavailable] : [],
  };
}
