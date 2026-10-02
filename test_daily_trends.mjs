import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildDailyTrendRows,formatDailyFpg,dailyTrendFor,selectDailyHitterActions} from './public/daily-trends.mjs';

test('sorts Desert Rats hitter trend rows by verified 7D FP/G and keeps missing values last',()=>{
 const hitters=[
  {'Player ID':'stable',Player:'Stable'},
  {'Player ID':'rising',Player:'Rising'},
  {'Player ID':'missing',Player:'Missing'},
 ];
 const pool=[
  {fantraxId:'stable',ppg7:4,ppg14:3.5,ppg30:4,games7:3},
  {fantraxId:'rising',ppg7:6,ppg14:4,ppg30:3,games7:2},
  {fantraxId:'missing',ppg7:null,ppg14:null,ppg30:2,games7:null},
 ];
 const rows=buildDailyTrendRows(hitters,pool);
 assert.deepEqual(rows.map(row=>row.name),['Rising','Stable','Missing']);
 assert.deepEqual(rows.map(row=>row.trend.label),['Rising','Steady','Not enough data']);
 assert.equal(rows.length,3);
 assert.equal(formatDailyFpg(rows[2].metrics.ppg7),'—');
 assert.equal(formatDailyFpg(rows[0].metrics.ppg14),'4.00');
 assert.equal(dailyTrendFor({ppg7:1,ppg30:4,games7:3}).label,'Falling');
});

test('selects hot, strongest rising, and cold hitters from verified recent form only',()=>{
 const hitters=[
  {'Player ID':'hot',Player:'Hot'},
  {'Player ID':'rise',Player:'Rise'},
  {'Player ID':'cold',Player:'Cold'},
  {'Player ID':'thin',Player:'Thin Sample'},
 ];
 const pool=[
  {fantraxId:'hot',ppg7:8,ppg30:7,games7:4},
  {fantraxId:'rise',ppg7:7,ppg30:3,games7:3},
  {fantraxId:'cold',ppg7:1,ppg30:3,games7:4},
  {fantraxId:'thin',ppg7:10,ppg30:2,games7:1},
 ];
 const actions=selectDailyHitterActions(hitters,pool);
 assert.equal(actions.hot.name,'Hot');
 assert.equal(actions.rising.name,'Rise');
 assert.equal(actions.cold.name,'Cold');
});
