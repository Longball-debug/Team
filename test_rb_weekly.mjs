import test from 'node:test';
import assert from 'node:assert/strict';
import {rbSummary} from './public/rb-weekly.mjs';
const now = new Date('2026-09-23T12:00:00Z');
const player = {Player:'Aaron Nola',MLB:'PHI'};
const row = {player:'Aaron Nola',team:'PHI',status:'verified',date:'2026-09-21',opponent:'NYM',home_away:'home',rating:50,recommendation:'COIN FLIP'};
function fixture() {
  return {weekly_schedule:{week_start:'2026-09-21',week_end:'2026-09-27',days:['2026-09-21'],teams:{PHI:{'2026-09-21':[{team_probable_pitcher:'Aaron Nola',opponent:'NYM',home_away:'home'}]}}},
    rotoballer_weekly:{pitchers:{status:'verified',week_start:'2026-09-21',week_end:'2026-09-27',ratings:[{...row}]}}};
}
test('pitcher grade matches scheduled date, team, opponent and starter', () => {
  assert.equal(rbSummary(fixture(),player,'pitcher',now).label,'RB COIN FLIP · 50');
  for (const change of [{team:'NYY'},{opponent:'ATL'},{date:'2026-09-22'},{status:'ambiguous'},{player:'Aaron Other'},{home_away:'away'}]) {
    const data=fixture();Object.assign(data.rotoballer_weekly.pitchers.ratings[0],change);
    assert.equal(rbSummary(data,player,'pitcher',now).label,'RB NOT VERIFIED');
  }
});
test('stale week, absent source, duplicate identity and changed probable are suppressed', () => {
  assert.equal(rbSummary(fixture(),player,'pitcher',new Date('2026-10-01T12:00Z')).label,'RB NOT VERIFIED');
  assert.equal(rbSummary({},player,'pitcher',now).label,'RB NOT VERIFIED');
  const data=fixture();data.rotoballer_weekly.pitchers.ratings.push({...row});
  assert.equal(rbSummary(data,player,'pitcher',now).label,'RB NOT VERIFIED');
  data.rotoballer_weekly.pitchers.ratings.pop();data.weekly_schedule.teams.PHI['2026-09-21'][0].team_probable_pitcher='Other';
  assert.equal(rbSummary(data,player,'pitcher',now).label,'RB NOT VERIFIED');
});
test('hitter recommendation stays weekly and scores retain their native scale', () => {
  const data=fixture();data.rotoballer_weekly.hitters={...data.rotoballer_weekly.pitchers,ratings:[{player:'CJ Abrams',team:'WSH',status:'verified',recommendation:'START',rating:115.6,daily_ratings:{'2026-09-21':123.5}}]};
  const result=rbSummary(data,{Player:'CJ Abrams',MLB:'WSN'},'hitter',now);
  assert.equal(result.label,'RB Wk START · 115.6');assert.match(result.details,/123.5/);
});
