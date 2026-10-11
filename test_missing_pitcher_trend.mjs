import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const source=(await readFile(new URL('./public/pitcher-today.mjs',import.meta.url),'utf8')).replaceAll('\r\n','\n');
const start=source.indexOf('function trendFor(');
const context=vm.createContext({});
vm.runInContext(source.slice(start,source.indexOf('\n}\n',start)+3),context);
test('null pitcher points cannot become verified zero or a trend',()=>{
    assert.equal(context.trendFor([{fantasy_points:null},{fantasy_points:null}]).label,'Not enough data');
    assert.equal(context.trendFor([{fantasy_points:0},{fantasy_points:0}]).label,'→ Steady');
});
