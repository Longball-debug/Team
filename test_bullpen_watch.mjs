import test from 'node:test';
import assert from 'node:assert/strict';
import {bullpenCandidates} from './public/bullpen-watch.mjs';
const rp=(name,extra={})=>({name,positions:['RP'],availability:'FA',identityStatus:'Verified',mlbId:100+name.length,ppg7:6,games7:4,ppg14:4,games14:8,ppg30:3,games30:16,...extra});
test('uses verified free-agent RP identities and excludes hitters, owned, and unresolved identities',()=>{
 const a=rp('A'); const out=bullpenCandidates([a,rp('Owned',{teamName:'Rats',availability:'ROSTERED'}),rp('Unknown',{identityStatus:'Not verified'}),rp('Hitter',{positions:['OF']})]);
 assert.equal(out.length,1);assert.equal(out[0].player.name,'A');assert.equal(out[0].opportunities,'Not verified');
});
test('rising signal requires independent valid windows and does not invent save/hold roles',()=>{
 const items=bullpenCandidates([rp('Rising'),rp('Missing',{ppg7:null,games7:null,ppg14:3}),rp('Down',{ppg7:2,ppg30:5})]);
 assert.equal(items.find(x=>x.player.name==='Rising').tone,'green');
 assert.equal(items.find(x=>x.player.name==='Missing').tone,'gray');
 assert.equal(items.find(x=>x.player.name==='Down').tone,'red');
});
test('offseason with no recent evidence displays zero candidates',()=>{
 assert.deepEqual(bullpenCandidates([rp('Old',{ppg7:null,games7:null,ppg14:null,games14:null,ppg30:null,games30:null})]),[]);
});
