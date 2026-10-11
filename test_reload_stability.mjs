import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

for (const name of ['fa-filters', 'player-lab']) {
  const source = (await readFile(new URL(`./public/${name}.mjs`, import.meta.url), 'utf8')).replaceAll('\r\n', '\n');
  test(`${name} retains snapshot with explicit warning on HTTP and validation failures, recovers on success`, async () => {
    const elements = new Map();
    const previous = {generated_at:'2026-10-11T17:46:57Z'};
    let failed = true;
    const context = vm.createContext({
      data:previous, Date, SNAPSHOT_URL:'snapshot',
      ensureLayout(){}, ensurePositionFilter(){}, ensureActivityFilter(){}, ensureStatColumns(){}, render(){},
      fetch: async () => ({ok:!failed,status:503,json:async()=>({generated_at:'new'})}),
      validateSnapshot:value=>value,
      document:{getElementById:id=>elements.get(id),createElement:()=>({style:{},setAttribute(){}}),querySelector:()=>({prepend:el=>elements.set(el.id,el)})}
    });
    const warning = source.slice(source.indexOf('function reloadWarning'),source.indexOf('\nfunction ',source.indexOf('function reloadWarning')+10));
    const start = source.indexOf('async function load()');
    const load = source.slice(start,source.indexOf('\n}\n',start)+3);
    vm.runInContext(warning+'\n'+load,context);
    await context.load();
    assert.equal(context.data,previous);
    const alert=elements.get(`${name}-reload-warning`);
    assert.equal(alert.hidden,false);
    assert.match(alert.textContent,/STALE DATA.*2026-10-11/);
    failed=false;
    context.validateSnapshot=()=>{throw Error('stale snapshot');};
    await context.load();
    assert.equal(context.data,previous);
    assert.equal(alert.hidden,false);
    context.validateSnapshot=value=>value;
    await context.load();
    assert.equal(context.data.generated_at,'new');
    assert.equal(alert.hidden,true);
    context.data=null; failed=true;
    await context.load();
    assert.match(alert.textContent,/DATA UNAVAILABLE/);
  });
}

