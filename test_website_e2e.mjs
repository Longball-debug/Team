// Run locally with PLAYWRIGHT_MODULE pointing to a bundled installation if needed.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve, extname} from 'node:path';
import {SNAPSHOT_URL,validateSnapshot} from './public/snapshot-contract.mjs';
const require = createRequire(import.meta.url);
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const live = process.env.SITE_URL;
let server;
if (!live) {
 server=createServer(async(req,res)=>{try{const path=resolve('.'+(req.url==='/'?'/index.html':req.url.split('?')[0]));if(!path.startsWith(resolve('.')+'/')&&!path.startsWith(resolve('.')+'\\'))throw Error();res.setHeader('Content-Type',extname(path)==='.mjs'?'text/javascript':'text/html');res.end(await readFile(path));}catch{res.statusCode=404;res.end();}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
}
const url=live||`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{})});
try {
 const context=await browser.newContext({extraHTTPHeaders:process.env.SITE_BYPASS?{'OAI-Sites-Authorization':process.env.SITE_BYPASS}:{}});
 const page=await context.newPage();
 const roster=live?'[data-testid="roster-rows"]':'#roster-rows';
 const standings=live?'[data-testid="standings-rows"]':'#standings-rows';
 const fresh=live?'[data-testid="freshness"]':'#freshness';
 async function check(snapshot) {
  const rats=snapshot.teams.find(t=>t.Team.trim().toLowerCase()==='desert rats');
  const players=snapshot.players.filter(p=>p['Fantasy Team ID']===rats['Team ID']);
  await page.locator(roster+' tr').first().waitFor();
  assert.deepEqual((await page.locator(roster+' tr').evaluateAll(rs=>rs.map(r=>r.dataset.entityId))).sort(),players.map(p=>p['Player ID']).sort());
  assert.deepEqual((await page.locator(standings+' tr').evaluateAll(rs=>rs.map(r=>r.dataset.entityId))).sort(),snapshot.teams.map(t=>t['Team ID']).sort());
  assert.equal(await page.locator(fresh).getAttribute('data-generated-at'),snapshot.generated_at);
  assert.match(await page.locator(fresh).textContent(),/Last Updated/);
  for(const p of players) assert.ok((await page.locator(roster).textContent()).includes(p.Player||`Name unavailable · ${p['Player ID']}`));
  for(const t of snapshot.teams) {const row=await page.locator(standings+' tr').evaluateAll((rs,id)=>rs.find(r=>r.dataset.entityId===id)?.textContent,t['Team ID']);assert.ok(row.includes(t.Record??'Unavailable'));if(t.Points!==undefined)assert.ok(row.includes(String(t.Points)));}
 }
 if(process.env.VERIFY_LATEST) {
  const response=await fetch(SNAPSHOT_URL+'?verify='+Date.now());assert.equal(response.status,200);
  const expected=validateSnapshot(await response.json());
  const api=await context.request.get(url+'/api/fantrax');assert.equal(api.status(),200);
  assert.deepEqual((await api.json()).snapshot,expected);
  await page.goto(url);await page.getByRole('button',{name:'Roster',exact:true}).click();await check(expected);
  console.log(`LIVE VERIFIED: ${expected.generated_at}; 12 standings; ${await page.locator(roster+' tr').count()} Desert Rats players; names and metrics match latest publication`);
 } else {
  const fixture=()=>({schema_version:1,league_id:'gxq8uqpqmg5m5edj',generated_at:new Date().toISOString(),teams:Array.from({length:12},(_,i)=>({'Team ID':String(i),Team:i?'Fixture team '+i:'Desert Rats',Record:'1-0-0',Points:i})),players:Array.from({length:12},(_,i)=>({'Player ID':'fixture-'+i,'Fantasy Team ID':String(i),Player:'Fixture player '+i}))});
  let data=fixture();
  await page.route(live?'**/api/fantrax':SNAPSHOT_URL+'*',route=>route.fulfill({json:live?{status:'current',message:'Test fixture',snapshot:data}:data}));
  async function visit(){await page.goto(url);if(live)await page.getByRole('button',{name:'Roster',exact:true}).click();}
  await visit();await check(data);
  data=fixture();data.players[0].Player='Updated fixture name';await visit();await check(data);
  for(const kind of ['empty','stale','standings','disconnected']) {
   data=fixture();if(kind==='empty')data.players=[];if(kind==='stale')data.generated_at='2026-01-01T00:00:00Z';if(kind==='standings')data.teams=[];if(kind==='disconnected')data=null;
   await visit();await page.getByText(/Shared Fantrax data is unavailable|Current data unavailable/,{exact:false}).waitFor();
   assert.equal(await page.locator(roster+' tr').count(),0);assert.equal(await page.locator(standings+' tr').count(),0);
  }
  console.log('BROWSER PASS: current rows, updated rows, missing source, stale data, empty roster, empty standings');
 }
} finally {await browser.close();if(server)await new Promise(r=>server.close(r));}
