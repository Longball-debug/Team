import test from 'node:test';
import assert from 'node:assert/strict';
import worker from './worker.mjs';
import {readFile} from 'node:fs/promises';
const digest=async password=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(password))),v=>v.toString(16).padStart(2,'0')).join('');
const password='fixture-private-token';
const env={SESSION_SIGNING_KEY:'a'.repeat(64),OWNER_LOGIN:'commish',OWNER_PASSWORD_SHA256:await digest(password),ASSETS:{fetch:async()=>new Response('PRIVATE DATA')}};
test('all pages and data paths fail closed without authentication',async()=>{
 for(const path of ['/','/public/fantasygm.json','/public/website.mjs','/index.html','/arbitrary-path']) {
  const r=await worker.fetch(new Request('https://rats.test'+path),env);
  assert.equal(r.status,401);assert.equal((await r.text()).includes('PRIVATE DATA'),false);
 }
 assert.equal((await worker.fetch(new Request('https://rats.test/'),{...env,OWNER_PASSWORD_SHA256:''})).status,503);
});
test('only the correct Basic owner credential reaches assets',async()=>{
 for(const [user,key,status] of [['commish',password,200],['other',password,401],['commish','bad',401]]) {
  const r=await worker.fetch(new Request('https://rats.test/',{headers:{Authorization:'Basic '+btoa(user+':'+key)}}),env);
  assert.equal(r.status,status);assert.equal(r.headers.get('Cache-Control'),'private, no-store');
 }
});
test('form sign-in sets secure private cookie and cross-origin sign-in fails',async()=>{
 const login=origin=>new Request('https://rats.test/login',{method:'POST',headers:{Origin:origin},body:new URLSearchParams({password})});
 assert.equal((await worker.fetch(login('https://evil.test'),env)).status,403);
 const r=await worker.fetch(login('https://rats.test'),env);assert.equal(r.status,303);
 const cookie=r.headers.get('Set-Cookie');assert.match(cookie,/HttpOnly; Secure; SameSite=Strict/);
 assert.equal((await worker.fetch(new Request('https://rats.test/public/fantasygm.json',{headers:{Cookie:cookie.split(';')[0]}}),env)).status,200);
});
test('Worker runs before static assets and previews stay disabled',async()=>{
 const config=JSON.parse(await readFile('./wrangler.jsonc','utf8'));
 assert.equal(config.assets.run_worker_first,true);assert.equal(config.assets.binding,'ASSETS');assert.equal(config.preview_urls,false);
});

test('forged and expired signed sessions cannot reach data',async()=>{
 const oldNow=Date.now;let response;
 try {Date.now=()=>oldNow()-13*3600000;response=await worker.fetch(new Request('https://rats.test/login',{method:'POST',headers:{Origin:'https://rats.test'},body:new URLSearchParams({password})}),env);}finally{Date.now=oldNow;}
 const cookie=response.headers.get('Set-Cookie').split(';')[0];
 assert.equal((await worker.fetch(new Request('https://rats.test/public/fantasygm.json',{headers:{Cookie:cookie}}),env)).status,401);
 assert.equal((await worker.fetch(new Request('https://rats.test/public/fantasygm.json',{headers:{Cookie:'dr_session='+password}}),env)).status,401);
});
