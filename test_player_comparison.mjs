import test from 'node:test';
import assert from 'node:assert/strict';
import {addComparisonPlayer,comparisonPlayers,comparisonRows,metricTones} from './public/player-comparison.mjs';

const player=(id,extra={})=>({fantraxId:`fx-${id}`,mlbId:id,identityStatus:'Verified',name:'Same Name',positions:'OF',points14:id*10,ppg14:id,games14:3,seasonMetrics:{type:'hitter',pa:100,ops:.8},...extra});

test('supports 2, 3, 4 distinct IDs, rejects duplicate MLB players and fifth selection',()=>{
  let selected=[];
  for(let id=1;id<=4;id++) {
    selected=addComparisonPlayer(selected,player(id)).players;
    assert.equal(selected.length,id);
  }
  assert.match(addComparisonPlayer(selected,player(5)).error,/maximum/);
  assert.match(addComparisonPlayer(selected,player(1,{fantraxId:'other-id'})).error,/already/);
  assert.equal(addComparisonPlayer([],player(9,{identityStatus:'Not verified'})).players.length,0);
  selected=selected.filter(p=>p.mlbId!==2);
  assert.equal(addComparisonPlayer(selected,player(5)).players.length,4);
});

test('a refreshed mismatched identity cannot carry old statistics into comparison',()=>{
  const original=player(1);
  const selected=addComparisonPlayer([],original).players;
  const result=comparisonPlayers(selected,[player(2,{fantraxId:original.fantraxId})]);
  assert.equal(result[0].identityStatus,'Not verified');
  assert.equal(comparisonRows(result).find(r=>r.label.startsWith('14D FP/G')).values[0],null);
});

test('comparison keeps duplicate-name columns distinct and missing values gray',()=>{
  const players=[player(1),player(2,{ppg14:null})];
  const row=comparisonRows(players).find(r=>r.label.startsWith('14D FP/G'));
  assert.deepEqual(row.values,[1,null]);
  assert.deepEqual(row.tones,['gray','gray']); // only one comparable value
  assert.deepEqual(metricTones([player(1),player(2)],[1,2],{better:'high',window:14}),['red','green']);
  assert.deepEqual(metricTones([player(1),player(2)],[0,0],{better:'high',window:14}),['yellow','yellow']);
});

test('mixed roles and tiny samples are not ranked; lower pitcher ERA is favorable',()=>{
  const pitcher=player(2,{positions:'SP',seasonMetrics:{type:'pitcher',games:4,ip:'20.0',era:2}});
  assert.deepEqual(metricTones([player(1),pitcher],[1,2],{better:'high',window:14}),['gray','gray']);
  assert.deepEqual(metricTones([player(1),player(2,{games14:1})],[1,2],{better:'high',window:14}),['gray','gray']);
  const other=player(3,{positions:'RP',seasonMetrics:{type:'pitcher',games:8,ip:'10.0',era:4}});
  assert.deepEqual(metricTones([pitcher,other],[2,4],{better:'low',group:'pitcher'}),['green','red']);
});

test('rows include all windows, raw season stats and available Statcast without inventing a winner',()=>{
  const rows=comparisonRows([player(1),player(2)]);
  for(const days of [7,14,30]) assert.ok(rows.some(r=>r.label===`${days}D FP/G (partial model)`));
  assert.ok(rows.some(r=>r.label==='2026 season OPS'));
  assert.ok(rows.some(r=>r.label==='2026 Statcast xwOBA'));
  assert.equal(rows.some(r=>/winner/i.test(r.label)),false);
});

test('valid hitter peers retain color with missing and pitching-only selected players',()=>{
  const hitterA=player(1,{seasonMetrics:{type:'hitter',pa:100,ops:.721},statcast2026:{xwoba:.343},ppg30:3.38,games30:12});
  const hitterB=player(2,{seasonMetrics:{type:'hitter',pa:150,ops:.865},statcast2026:{xwoba:.379},ppg30:3.04,games30:13});
  const pitcher=player(3,{positions:'SP',seasonMetrics:{type:'pitcher',games:14,ip:'85.2',era:1.79},statcast2026:{xwoba:.397},ppg30:null,games30:null});
  const missing=player(4,{identityStatus:'Not verified',ppg30:null});
  const rows=comparisonRows([hitterA,hitterB,pitcher,missing]);
  assert.deepEqual(rows.find(r=>r.label==='2026 season OPS').tones,['red','green','gray','gray']);
  assert.deepEqual(rows.find(r=>r.label==='30D FP/G (partial model)').tones,['green','red','gray','gray']);
  assert.deepEqual(rows.find(r=>r.label==='2026 Statcast xwOBA').tones,['red','yellow','green','gray']);
});
test('missing statistic within a group stays gray while remaining peers compare',()=>{
  const a=player(1,{seasonMetrics:{type:'hitter',pa:100,ops:.7}});
  const b=player(2,{seasonMetrics:{type:'hitter',pa:100,ops:.9}});
  const c=player(3,{seasonMetrics:{type:'hitter',pa:100,ops:null}});
  assert.deepEqual(comparisonRows([a,b,c]).find(r=>r.label==='2026 season OPS').tones,['red','green','gray']);
});
