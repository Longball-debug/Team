import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateSnapshot} from './public/snapshot-contract.mjs';

export function fixture() {
  const teams = Array.from({length:12},(_,i)=>({'Team ID':String(i),Team:i?'Fixture team '+i:'Desert Rats',Record:'1-0-0',Points:i}));
  const players = Array.from({length:12},(_,i)=>({'Player ID':'fixture-'+i,'Fantasy Team ID':String(i),Player:'Fixture player '+i,Positions:i%2?'OF':'SP',Status:'T','MLB Team':'ARI'}));
  const pool = players.map((p,i)=>({fantraxId:p['Player ID'],name:p.Player,mlbTeam:'ARI',availability:i===0?'DESERT RATS':'OTHER TEAM',positions:p.Positions,teamId:p['Fantasy Team ID'],teamName:teams[i].Team,sourceStatus:'T'}));
  pool.push({fantraxId:'fa-1',name:'Fixture Free Agent',mlbTeam:'SEA',availability:'FREE AGENT',positions:'OF',teamId:null,teamName:null,sourceStatus:'FA'});
  return {schema_version:1,league_id:'gxq8uqpqmg5m5edj',generated_at:new Date().toISOString(),source:'Fixture Fantrax source',teams,players,pool,transactions:[{id:'tx-1',fantraxId:'fa-1',name:'Fixture Free Agent',action:'ADD',teamName:'Desert Rats',teamId:'0',date:'Sep 25'}],unavailable:['pitcher_ratings']};
}

test('accepts complete fresh publication, preserves allowlisted shared data, strips unknown fields',()=>{
  const s=fixture();
  s.secret='SECRET';
  const out=validateSnapshot(s);
  assert.equal(out.secret,undefined);
  assert.equal(out.pool.length,13);
  assert.equal(out.transactions.length,1);
  assert.equal(out.source,'Fixture Fantrax source');
});

for(const [name,change] of Object.entries({
  empty:s=>s.players=[],
  emptyRats:s=>s.players.shift(),
  standings:s=>s.teams.pop(),
  stale:s=>s.generated_at='2026-01-01T00:00:00Z',
  future:s=>s.generated_at='2099-01-01T00:00:00Z',
  duplicate:s=>s.players.push(s.players[0]),
  membership:s=>s.players[0]['Fantasy Team ID']='missing',
  points:s=>s.teams[0].Points='unverified',
  missingRats:s=>s.teams[0].Team='other',
  missingPool:s=>s.pool=[],
  duplicatePool:s=>s.pool.push({...s.pool[0]}),
  badAvailability:s=>s.pool[0].availability='MAYBE',
  rosterMissingFromPool:s=>s.pool=s.pool.filter(p=>p.fantraxId!=='fixture-0'),
  badTransaction:s=>s.transactions[0].action='TRADE',
})) test('rejects '+name,()=>{const s=fixture();change(s);assert.throws(()=>validateSnapshot(s));});
