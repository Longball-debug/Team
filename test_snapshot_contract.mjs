import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateSnapshot} from './public/snapshot-contract.mjs';
export function fixture() {
 return {schema_version:1,league_id:'gxq8uqpqmg5m5edj',generated_at:new Date().toISOString(),
 teams:Array.from({length:12},(_,i)=>({'Team ID':String(i),Team:i?'Fixture team '+i:'Desert Rats',Record:'1-0-0',Points:i})),
 players:Array.from({length:12},(_,i)=>({'Player ID':'fixture-'+i,'Fantasy Team ID':String(i),Player:'Fixture player '+i}))};
}
test('accepts complete fresh publication and strips unknown fields',()=>{
 const s=fixture();s.secret='SECRET';assert.equal(validateSnapshot(s).secret,undefined);
});
test('exposes verified 7D, 14D, and 30D FP/G fields from the shared pool',()=>{
 const s=fixture();s.pool=[{fantraxId:'hitter-1',name:'Corey Seager',ppg7:4,ppg14:2.67,ppg30:3.76,games7:3}];
 const player=validateSnapshot(s).pool[0];
 assert.deepEqual([player.ppg7,player.ppg14,player.ppg30,player.games7],[4,2.67,3.76,3]);
});
test('exposes only validated Statcast fields',()=>{
 const s=fixture();
 s.pool=[{fantraxId:'hitter-1',name:'Aaron Judge',positions:'OF',statcast2026:{savantId:'592450',exitVelocity:94,hardHitPct:57.5,barrelPct:20.9,xba:.258,xslg:.569,xwoba:.396,sprintSpeed:29}}];
 s.statcast2026={source:'Baseball Savant',source_url:'https://baseballsavant.mlb.com/leaderboard/statcast?type=batter&year=2026&csv=true',season:2026,records_received:658,matched_pool_players:1,ambiguous_name_matches:0,unmatched_records:657,fetched_at:'2026-10-02T00:00:00Z',expected_statistics:{source_url:'https://baseballsavant.mlb.com/leaderboard/expected_statistics?type=batter&year=2026&csv=true',records_received:658,matched_pool_players:1,ambiguous_name_matches:0,unmatched_records:657,fetched_at:'2026-10-02T00:00:00Z'},sprint_speed:{source_url:'https://baseballsavant.mlb.com/leaderboard/sprint_speed?type=player&min_season=2026&max_season=2026&csv=true',records_received:567,matched_pool_players:1,ambiguous_name_matches:0,unmatched_records:566,fetched_at:'2026-10-02T00:00:00Z'}};
 const clean=validateSnapshot(s);
 assert.deepEqual(clean.pool[0].statcast2026,{savantId:'592450',exitVelocity:94,hardHitPct:57.5,barrelPct:20.9,xba:.258,xslg:.569,xwoba:.396,sprintSpeed:29});
 assert.equal(clean.statcast2026.records_received,658);
 assert.equal(clean.statcast2026.sprint_speed.records_received,567);
 s.statcast2026.matched_pool_players=2;
 assert.equal(validateSnapshot(s).statcast2026,null);
});
for(const [name,change] of Object.entries({
 empty:s=>s.players=[],emptyRats:s=>s.players.shift(),standings:s=>s.teams.pop(),
 stale:s=>s.generated_at='2026-01-01T00:00:00Z',future:s=>s.generated_at='2099-01-01T00:00:00Z',
 duplicate:s=>s.players.push(s.players[0]),membership:s=>s.players[0]['Fantasy Team ID']='missing',
 points:s=>s.teams[0].Points='unverified',missingRats:s=>s.teams[0].Team='other',
 })) test('rejects '+name,()=>{const s=fixture();change(s);assert.throws(()=>validateSnapshot(s));});
