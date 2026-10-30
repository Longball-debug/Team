import test from 'node:test';
import assert from 'node:assert/strict';
import {validateSnapshot} from './public/snapshot-contract.mjs';
const fixture=()=>({schema_version:1,league_id:'gxq8uqpqmg5m5edj',generated_at:new Date().toISOString(),source:'Historical LONGBALL 2026 roster/ownership',
 teams:Array.from({length:12},(_,i)=>({'Team ID':String(i),Team:i?'Team '+i:'Desert Rats'})),
 players:Array.from({length:12},(_,i)=>({'Player ID':'fx-'+i,'Fantasy Team ID':String(i)}))});
test('historical data load explicitly retains age and disables decisions; ordinary stale data fail',()=>{
 const s=fixture();s.generated_at='2026-09-01T00:00:00Z';
 assert.throws(()=>validateSnapshot(s));
 const clean=validateSnapshot(s,Date.now(),{allowHistorical:true});
 assert.equal(clean.stale,true);assert.equal(clean.historical,true);assert.equal(clean.decisions_enabled,false);
 assert.equal(clean.generated_at,s.generated_at);
 s.source='Fantrax REST API';assert.throws(()=>validateSnapshot(s,Date.now(),{allowHistorical:true}));
});
test('duplicate MLB links and unverified identities cannot expose metrics',()=>{
 const s=fixture();s.pool=[1,2].map(i=>({fantraxId:'p'+i,mlbId:42,identityStatus:'Verified',ppg14:99,seasonMetrics:{ops:1},statcast2026:{savantId:'42',exitVelocity:100}}));
 const pool=validateSnapshot(s).pool;
 for(const p of pool){assert.equal(p.mlbId,null);assert.equal(p.ppg14,null);assert.equal(p.seasonMetrics,null);assert.equal(p.statcast2026,null);}
 s.pool=[{fantraxId:'p1',mlbId:42,identityStatus:'Not verified',ppg7:9}];assert.equal(validateSnapshot(s).pool[0].ppg7,null);
});
test('one shared fetch feeds all pages; failed and older reloads retain last good publication',async()=>{
 const oldFetch=globalThis.fetch;let calls=0;let value=fixture();let failed=false;
 globalThis.fetch=async(url)=>{assert.equal(url,'/public/fantasygm.json');calls++;await Promise.resolve();return {ok:!failed,status:503,json:async()=>value};};
 try {
  const store=await import('./public/snapshot-store.mjs?store-test');let notified=0;store.subscribeSnapshot(()=>notified++);
  const [a,b]=await Promise.all([store.loadPublishedSnapshot(),store.loadPublishedSnapshot()]);assert.equal(a,b);assert.equal(calls,1);assert.equal(notified,1);
  failed=true;await assert.rejects(store.loadPublishedSnapshot());assert.equal(notified,1);
  failed=false;value={...value,generated_at:'2026-08-01T00:00:00Z'};await assert.rejects(store.loadPublishedSnapshot(),/rollback/);assert.equal(notified,1);
  value=fixture();await store.loadPublishedSnapshot();assert.equal(notified,2);
  assert.match(store.snapshotNotice(a),/Historical 2026 research only/);
 } finally {globalThis.fetch=oldFetch;}
});

test('explicit 2027 keeper contract permits empty teams, keeps stats historical and disables live decisions',()=>{
 const s=fixture();s.league_id='n81gfju2muo8y07b';s.roster_phase='keeper';s.research_only=true;s.statistics_season=2026;s.source='Current LONGBALL 2027 keeper research';s.players=[];
 const result=validateSnapshot(s);assert.equal(result.historical,false);assert.equal(result.roster_phase,'keeper');assert.equal(result.research_only,true);assert.equal(result.decisions_enabled,false);assert.equal(result.statistics_season,2026);
 s.roster_phase='live';assert.throws(()=>validateSnapshot(s));
});
