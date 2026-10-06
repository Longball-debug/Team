export const SNAPSHOT_URL = 'https://raw.githubusercontent.com/Longball-debug/Team/main/public/fantasygm.json';

function freshFetchedAt(value, now, maxAgeHours=36) {
  if (typeof value !== 'string') return null;
  const stamp = Date.parse(value);
  if (!Number.isFinite(stamp)) return null;
  const age = now - stamp;
  if (age < -300000 || age > maxAgeHours * 3600000) return null;
  return value;
}

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
    statcast2026:cleanStatcastPlayer(p.statcast2026),
    seasonMetrics:p.seasonMetrics && typeof p.seasonMetrics === 'object' ? {...p.seasonMetrics} : null,
  }));
}

function cleanStatcastPlayer(value) {
  if (!value || typeof value !== 'object' || !/^\d+$/.test(String(value.savantId || ''))) return null;
  const bounded = (key, max) => Number.isFinite(value[key]) && value[key] >= 0 && value[key] <= max ? value[key] : null;
  return {
    savantId:String(value.savantId),
    exitVelocity:bounded('exitVelocity',150),
    hardHitPct:bounded('hardHitPct',100),
    barrelPct:bounded('barrelPct',100),
    xba:bounded('xba',1),
    xslg:bounded('xslg',1),
    xwoba:bounded('xwoba',1),
    sprintSpeed:Number.isFinite(value.sprintSpeed) && value.sprintSpeed >= 15 && value.sprintSpeed <= 40 ? value.sprintSpeed : null,
  };
}

function cleanExpectedStatcastSummary(value) {
  if (!value || typeof value !== 'object') return null;
  if (typeof value.source_url !== 'string' || !value.source_url.startsWith('https://baseballsavant.mlb.com/leaderboard/expected_statistics?')) return null;
  const counts = ['records_received','matched_pool_players','ambiguous_name_matches','unmatched_records'];
  if (counts.some(key => !Number.isInteger(value[key]) || value[key] < 0)) return null;
  if (value.records_received === 0 || value.matched_pool_players + value.ambiguous_name_matches + value.unmatched_records !== value.records_received) return null;
  return {
    source_url:value.source_url,
    records_received:value.records_received,
    matched_pool_players:value.matched_pool_players,
    ambiguous_name_matches:value.ambiguous_name_matches,
    unmatched_records:value.unmatched_records,
    fetched_at:typeof value.fetched_at === 'string' ? value.fetched_at : null,
  };
}

function cleanSprintSpeedSummary(value) {
  if (!value || typeof value !== 'object') return null;
  if (typeof value.source_url !== 'string' || !value.source_url.startsWith('https://baseballsavant.mlb.com/leaderboard/sprint_speed?')) return null;
  const counts = ['records_received','matched_pool_players','ambiguous_name_matches','unmatched_records'];
  if (counts.some(key => !Number.isInteger(value[key]) || value[key] < 0)) return null;
  if (value.records_received === 0 || value.matched_pool_players + value.ambiguous_name_matches + value.unmatched_records !== value.records_received) return null;
  return {
    source_url:value.source_url,
    records_received:value.records_received,
    matched_pool_players:value.matched_pool_players,
    ambiguous_name_matches:value.ambiguous_name_matches,
    unmatched_records:value.unmatched_records,
    fetched_at:typeof value.fetched_at === 'string' ? value.fetched_at : null,
  };
}

function cleanStatcastSummary(value) {
  if (!value || typeof value !== 'object' || value.source !== 'Baseball Savant' || value.season !== 2026) return null;
  if (typeof value.source_url !== 'string' || !value.source_url.startsWith('https://baseballsavant.mlb.com/leaderboard/statcast?')) return null;
  const counts = ['records_received','matched_pool_players','ambiguous_name_matches','unmatched_records'];
  if (counts.some(key => !Number.isInteger(value[key]) || value[key] < 0)) return null;
  if (value.records_received === 0 || value.matched_pool_players + value.ambiguous_name_matches + value.unmatched_records !== value.records_received) return null;
  return {
    source:'Baseball Savant',
    source_url:value.source_url,
    season:2026,
    records_received:value.records_received,
    matched_pool_players:value.matched_pool_players,
    ambiguous_name_matches:value.ambiguous_name_matches,
    unmatched_records:value.unmatched_records,
    fetched_at:typeof value.fetched_at === 'string' ? value.fetched_at : null,
    expected_statistics:cleanExpectedStatcastSummary(value.expected_statistics),
    sprint_speed:cleanSprintSpeedSummary(value.sprint_speed),
  };
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

function cleanFaLookahead(value) {
  if (!value || !Array.isArray(value.weeks)) return null;
  const weeks = value.weeks.map(cleanWeeklySchedule).filter(Boolean).slice(0, 2);
  if (weeks.length !== 2) return null;
  return {
    source:typeof value.source === 'string' ? value.source : 'MLB Stats API',
    weeks,
  };
}

function cleanBaseballMonsterEase(value, now) {
  if (!value || typeof value !== 'object') return null;
  const cleanSide = side => {
    const out = {};
    if (!side || typeof side !== 'object') return out;
    for (const [team, item] of Object.entries(side)) {
      if (!item || typeof item !== 'object') continue;
      const rank = Number.isInteger(item.rank) && item.rank >= 1 && item.rank <= 30 ? item.rank : null;
      const easeValue = Number.isFinite(item.value) ? item.value : null;
      const games = Number.isInteger(item.games) && item.games >= 0 ? item.games : null;
      if (rank && easeValue !== null) out[team] = {rank, value:easeValue, games};
    }
    return out;
  };
  const hitters = cleanSide(value.hitters);
  const pitchers = cleanSide(value.pitchers);
  const fetchedAt = freshFetchedAt(value.fetched_at, now);
  return {
    source:typeof value.source === 'string' ? value.source : null,
    source_url:typeof value.source_url === 'string' && value.source_url.startsWith('https://baseballmonster.com/') ? value.source_url : null,
    fetched_at:fetchedAt,
    status:fetchedAt && value.status === 'verified' && Object.keys(hitters).length >= 28 && Object.keys(pitchers).length >= 28 ? 'verified' : 'unavailable',
    definition:typeof value.definition === 'string' ? value.definition : null,
    hitters,
    pitchers,
  };
}

function cleanPitcherRecentGames(value, now) {
  if (!value || typeof value !== 'object' || !value.players || typeof value.players !== 'object') return null;
  const fetchedAt = freshFetchedAt(value.fetched_at, now);
  const players = {};
  if (!fetchedAt) return {source:value.source, season:value.season, fetched_at:null, players};
  for (const [name, item] of Object.entries(value.players)) {
    if (!item || typeof item !== 'object') continue;
    players[name] = {
      fantrax_id:typeof item.fantrax_id === 'string' ? item.fantrax_id : null,
      mlb_id:item.mlb_id,
      identity_status:typeof item.identity_status === 'string' ? item.identity_status : null,
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
  return {source:value.source, season:value.season, fetched_at:fetchedAt, players};
}

function cleanRecent14(value, now) {
  if (!value || typeof value !== 'object') return null;
  return {
    source:typeof value.source === 'string' ? value.source : null,
    fetched_at:freshFetchedAt(value.fetched_at, now),
    start_date:typeof value.start_date === 'string' ? value.start_date : null,
    end_date:typeof value.end_date === 'string' ? value.end_date : null,
    matched_pool_players:Number.isFinite(value.matched_pool_players) ? value.matched_pool_players : null,
    ambiguous_pool_names:Number.isFinite(value.ambiguous_pool_names) ? value.ambiguous_pool_names : null,
    ambiguous_source_names:Number.isFinite(value.ambiguous_source_names) ? value.ambiguous_source_names : null,
    identity_rule:typeof value.identity_rule === 'string' ? value.identity_rule : null,
  };
}

function cleanPlayerLab(value, now) {
  if (!value || typeof value !== 'object') return null;
  return {
    source:typeof value.source === 'string' ? value.source : null,
    fetched_at:freshFetchedAt(value.fetched_at, now),
    season:Number.isFinite(value.season) ? value.season : null,
    recent_end_date:typeof value.recent_end_date === 'string' ? value.recent_end_date : null,
    window7_start:typeof value.window7_start === 'string' ? value.window7_start : null,
    window30_start:typeof value.window30_start === 'string' ? value.window30_start : null,
    matched_pool_players:Number.isFinite(value.matched_pool_players) ? value.matched_pool_players : null,
    ambiguous_pool_names:Number.isFinite(value.ambiguous_pool_names) ? value.ambiguous_pool_names : null,
    ambiguous_source_names:Number.isFinite(value.ambiguous_source_names) ? value.ambiguous_source_names : null,
    identity_rule:typeof value.identity_rule === 'string' ? value.identity_rule : null,
  };
}


function cleanFicMatchups(value, now) {
  if (!value || typeof value !== 'object' || !value.players || typeof value.players !== 'object') return null;
  const players = {};
  for (const [name, dates] of Object.entries(value.players)) {
    if (!dates || typeof dates !== 'object') continue;
    players[name] = {};
    for (const [day, item] of Object.entries(dates)) {
      if (!item || typeof item !== 'object') continue;
      const finite = key => Number.isFinite(item[key]) ? item[key] : null;
      players[name][day] = {
        pitcher:typeof item.pitcher === 'string' ? item.pitcher : null,
        qAB_pct:finite('qAB_pct'),
        hard_hit_pct:finite('hard_hit_pct'),
        ab:finite('ab'),
        h:finite('h'),
        hr:finite('hr'),
        bb:finite('bb'),
        ba:finite('ba'),
        obp:finite('obp'),
        ops:finite('ops'),
        sample_pa_proxy:finite('sample_pa_proxy'),
        sample_ok:item.sample_ok === true,
      };
    }
  }
  const fantraxIdsByName = {};
  if (value.fantrax_ids_by_name && typeof value.fantrax_ids_by_name === 'object') {
    for (const [name, id] of Object.entries(value.fantrax_ids_by_name)) {
      if (typeof name === 'string' && name && typeof id === 'string' && id) fantraxIdsByName[name] = id;
    }
  }
  const fetchedAt = freshFetchedAt(value.fetched_at, now);
  return {
    source:typeof value.source === 'string' ? value.source : null,
    fetched_at:fetchedAt,
    status:fetchedAt && value.status === 'verified' ? 'verified' : 'unavailable',
    sample_rule:typeof value.sample_rule === 'string' ? value.sample_rule : null,
    identity_rule:typeof value.identity_rule === 'string' ? value.identity_rule : null,
    fantrax_ids_by_name:fantraxIdsByName,
    players,
  };
}

function cleanPitcherList(value, now) {
  if (!value || typeof value !== 'object' || !value.days || typeof value.days !== 'object') return null;
  const days = {};
  for (const [day, rows] of Object.entries(value.days)) {
    days[day] = Array.isArray(rows) ? rows.map(item => ({
      rank:Number.isInteger(item?.rank) && item.rank > 0 ? item.rank : null,
      pitcher:typeof item?.pitcher === 'string' ? item.pitcher : null,
      pitcher_key:typeof item?.pitcher_key === 'string' ? item.pitcher_key : null,
      matchup:typeof item?.matchup === 'string' ? item.matchup : null,
      tier:typeof item?.tier === 'string' ? item.tier : 'Unverified Tier',
      source_url:typeof item?.source_url === 'string' && item.source_url.startsWith('https://pitcherlist.com/') ? item.source_url : null,
    })).filter(item => item.rank && item.pitcher && item.pitcher_key) : [];
  }
  const fetchedAt = freshFetchedAt(value.fetched_at, now);
  return {
    source:typeof value.source === 'string' ? value.source : null,
    fetched_at:fetchedAt,
    status:fetchedAt && value.status === 'verified' ? 'verified' : 'unavailable',
    days,
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
    fa_lookahead:cleanFaLookahead(value.fa_lookahead),
    baseball_monster_ease:cleanBaseballMonsterEase(value.baseball_monster_ease, now),
    rotoballer_weekly:value.rotoballer_weekly && typeof value.rotoballer_weekly === 'object' && freshFetchedAt(value.rotoballer_weekly.fetched_at, now) ? value.rotoballer_weekly : null,
    fic_matchups:cleanFicMatchups(value.fic_matchups, now),
    pitcher_list:cleanPitcherList(value.pitcher_list, now),
    pitcher_recent_games:cleanPitcherRecentGames(value.pitcher_recent_games, now),
    recent_14d:cleanRecent14(value.recent_14d, now),
    player_lab:cleanPlayerLab(value.player_lab, now),
    statcast2026:cleanStatcastSummary(value.statcast2026),
    unavailable:Array.isArray(value.unavailable) ? [...value.unavailable] : [],
  };
}
