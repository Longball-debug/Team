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
for(const [name,change] of Object.entries({
 empty:s=>s.players=[],emptyRats:s=>s.players.shift(),standings:s=>s.teams.pop(),
 stale:s=>s.generated_at='2026-01-01T00:00:00Z',future:s=>s.generated_at='2099-01-01T00:00:00Z',
 duplicate:s=>s.players.push(s.players[0]),membership:s=>s.players[0]['Fantasy Team ID']='missing',
 points:s=>s.teams[0].Points='unverified',missingRats:s=>s.teams[0].Team='other',
 })) test('rejects '+name,()=>{const s=fixture();change(s);assert.throws(()=>validateSnapshot(s));});
