import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source=await readFile('./public/fa-filters.mjs','utf8');
const start=source.indexOf('function overallSignal(');const stop=source.indexOf('\nfunction pillCell',start);
const context=vm.createContext({data:{historical:true},verifiedIdentity:p=>p.identityStatus==='Verified',hasRecentStats:p=>Number.isFinite(p.ppg14),Number});
vm.runInContext(source.slice(start,stop),context);
const player={ppg14:99,games14:10,identityStatus:'Verified'};
test('historical ownership never generates actionable LOOK or PASS',()=>{assert.equal(context.overallSignal(player,[player],[]).label,'RESEARCH ONLY');});
test('stale data and missing identity fail closed',()=>{
 context.data={stale:true};assert.equal(context.overallSignal(player,[player],[]).tone,'gray');
 context.data={};assert.equal(context.overallSignal({...player,identityStatus:'Not verified'},[player],[]).tone,'gray');
});
test('one appearance cannot become actionable recent production',()=>{
 context.data={};assert.equal(context.overallSignal({...player,games14:1},[player],[]).label,'NOT ENOUGH DATA');
});
