// Run locally with PLAYWRIGHT_MODULE pointing to a bundled installation if needed.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve, extname} from 'node:path';
import {SNAPSHOT_URL} from './public/snapshot-contract.mjs';

const require = createRequire(import.meta.url);
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
let server;
server=createServer(async(req,res)=>{try{const path=resolve('.'+(req.url==='/'?'/index.html':req.url.split('?')[0]));if(!path.startsWith(resolve('.')+'/')&&!path.startsWith(resolve('.')+'\\'))throw Error();const ext=extname(path);res.setHeader('Content-Type',ext==='.mjs'?'text/javascript':ext==='.css'?'text/css':'text/html');res.end(await readFile(path));}catch{res.statusCode=404;res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const url=`http://127.0.0.1:${server.address().port}`;

function fixture(){
 const teams=Array.from({length:12},(_,i)=>({'Team ID':String(i),Team:i?'Fixture team '+i:'Desert Rats',Record:'1-0-0',Points:i}));
 const players=Array.from({length:12},(_,i)=>({'Player ID':'fixture-'+i,'Fantasy Team ID':String(i),Player:'Fixture player '+i,Positions:i===0?'SP':'OF',Status:'T','MLB Team':'ARI'}));
 const pool=players.map((p,i)=>({fantraxId:p['Player ID'],name:p.Player,mlbTeam:'ARI',availability:i===0?'DESERT RATS':'OTHER TEAM',positions:p.Positions,teamId:p['Fantasy Team ID'],teamName:teams[i].Team,sourceStatus:'T'}));
 pool.push({fantraxId:'fa-1',name:'Fixture Free Agent',mlbTeam:'SEA',availability:'FREE AGENT',positions:'OF',teamId:null,teamName:null,sourceStatus:'FA'});
 return {schema_version:1,league_id:'gxq8uqpqmg5m5edj',generated_at:new Date().toISOString(),source:'Fixture Fantrax source',teams,players,pool,transactions:[{id:'tx-1',fantraxId:'fa-1',name:'Fixture Free Agent',action:'ADD',teamName:'Desert Rats',teamId:'0',date:'Sep 25'}],unavailable:['matchup_scores','pitcher_ratings']};
}

const browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{})});
try {
 const context=await browser.newContext();
 const page=await context.newPage();
 let data=fixture();
 await page.route(SNAPSHOT_URL+'*',route=>route.fulfill({json:data}));
 await page.goto(url);
 await page.getByText(/Last verified refresh:/).waitFor();
 assert.equal(await page.locator('#home-metrics .metric').count(),4);

 await page.getByRole('button',{name:'Daily Command Center'}).click();
 await page.locator('#daily-rows tr').first().waitFor();
 assert.equal(await page.locator('#daily-rows tr').count(),1);
 assert.match(await page.locator('#daily-rows').textContent(),/Fixture player 0/);

 await page.getByRole('button',{name:'Weekly Outlook'}).click();
 assert.equal(await page.locator('#weekly-pitchers tr').count(),1);
 assert.match(await page.locator('#weekly-pitchers').textContent(),/NOT VERIFIED/);

 await page.getByRole('button',{name:'Free Agent Board'}).click();
 await page.locator('#fa-search').fill('Fixture Free Agent');
 assert.equal(await page.locator('#fa-rows tr').count(),1);
 assert.match(await page.locator('#fa-rows').textContent(),/FREE AGENT/);
 assert.match(await page.locator('#transaction-rows').textContent(),/Fixture Free Agent/);

 await page.getByRole('button',{name:'Player Lab'}).click();
 await page.locator('#lab-search').fill('Fixture Free Agent');
 await page.getByRole('button',{name:/Fixture Free Agent/}).click();
 assert.match(await page.locator('#player-detail').textContent(),/SEA/);
 assert.match(await page.locator('#player-detail').textContent(),/FREE AGENT/);

 await page.getByRole('button',{name:/Back to Home/}).click();
 await page.locator('#view-home.active').waitFor();

 data=fixture();data.generated_at='2026-01-01T00:00:00Z';
 await page.goto(url);
 await page.getByText(/Current data unavailable/).waitFor();
 console.log('BROWSER PASS: navigation, roster, weekly split, free agents, transactions, player lab, stale-data rejection');
} finally {
 await browser.close();
 await new Promise(r=>server.close(r));
}
