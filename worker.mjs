const REALM='Desert Rats Private';
const loginPage=`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Private Desert Rats Front Office</title><style>body{background:#0b1625;color:#edf4ff;font:18px system-ui;margin:0;display:grid;place-items:center;min-height:100vh}main{max-width:420px;padding:32px}h1{font-size:32px}label,input,button{display:block;width:100%;box-sizing:border-box}input,button{padding:14px;margin:12px 0;border-radius:8px;border:1px solid #8fa4bd;font:inherit}button{background:#f7b548;color:#111;font-weight:700;cursor:pointer}small{color:#b9c7da}</style></head><body><main><small>FANTASYGM2027 · OWNER ACCESS</small><h1>Desert Rats<br>Front Office</h1><p>This website and its data require your private password.</p><form method="post" action="/login"><label for="password">Private password</label><input id="password" name="password" type="password" autocomplete="current-password" required maxlength="256"><button>Sign in</button></form><small>Historical 2026 research · verified 2027 scoring configuration</small></main></body></html>`;
const headers={
  'Cache-Control':'private, no-store','X-Robots-Tag':'noindex, nofollow',
  'X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin',
  'Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
  'X-FantasyGM-Auth':'password-required',
};
async function matches(password,verifier) {
  if(!/^[a-f0-9]{64}$/.test(verifier||'') || !password || password.length>256)return false;
  const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(password));
  const actual=Array.from(new Uint8Array(bytes),v=>v.toString(16).padStart(2,'0')).join('');
  let difference=0;for(let i=0;i<actual.length;i++)difference|=actual.charCodeAt(i)^verifier.charCodeAt(i);
  return difference===0;
}
function basicPassword(request,owner) {
  const auth=request.headers.get('Authorization')||'';
  if(!auth.startsWith('Basic '))return '';
  try {const value=atob(auth.slice(6));const split=value.indexOf(':');return value.slice(0,split)===owner?value.slice(split+1):'';}catch{return '';}
}
async function signature(payload,secret) {
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  return Array.from(new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(payload))),v=>v.toString(16).padStart(2,'0')).join('');
}
async function sessionValid(request,secret) {
  const cookie=(request.headers.get('Cookie')||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('dr_session='));
  if(!cookie)return false;
  const [expires,nonce,provided,...extra]=cookie.slice(11).split('.');
  if(extra.length||!/^[a-f0-9]{64}$/.test(provided||'')||!Number.isSafeInteger(Number(expires))||Number(expires)<Date.now()||Number(expires)>Date.now()+43260000||!/^[a-f0-9-]{36}$/.test(nonce||''))return false;
  const expected=await signature(expires+'.'+nonce,secret);
  let difference=0;for(let i=0;i<64;i++)difference|=expected.charCodeAt(i)^provided.charCodeAt(i);
  return difference===0;
}

export default {
  async fetch(request,env) {
    if(!/^[a-f0-9]{64}$/.test(env.OWNER_PASSWORD_SHA256||'') || !/^[a-f0-9]{64}$/.test(env.SESSION_SIGNING_KEY||''))return new Response('Private access is not configured.',{status:503,headers});
    const url=new URL(request.url);
    if(url.pathname==='/logout' && request.method==='POST')return new Response(null,{status:303,headers:{Location:'/', 'Set-Cookie':'dr_session=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0','Cache-Control':'no-store'}});
    if(url.pathname==='/login' && request.method==='POST') {
      if(request.headers.get('Origin')!==url.origin)return new Response('Invalid origin',{status:403,headers});
      const length=Number(request.headers.get('Content-Length'));
      if(length>1024)return new Response('Request too large',{status:413,headers});
      const body=await request.text();
      if(body.length>1024)return new Response('Request too large',{status:413,headers});
      const password=new URLSearchParams(body).get('password')||'';
      if(await matches(password,env.OWNER_PASSWORD_SHA256)) {
        const payload=String(Date.now()+43200000)+'.'+crypto.randomUUID();
        const token=payload+'.'+await signature(payload,env.SESSION_SIGNING_KEY);
        return new Response(null,{status:303,headers:{Location:'/', 'Set-Cookie':`dr_session=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=43200`,'Cache-Control':'private, no-store'}});
      }
    }
    if(!await sessionValid(request,env.SESSION_SIGNING_KEY) && !await matches(basicPassword(request,env.OWNER_LOGIN||'commish'),env.OWNER_PASSWORD_SHA256))return new Response(loginPage,{status:401,headers:{...headers,'Content-Type':'text/html; charset=utf-8'}});
    const response=await env.ASSETS.fetch(request);
    const result=new Response(response.body,response);
    result.headers.set('Cache-Control','private, no-store');
    result.headers.set('X-Robots-Tag','noindex, nofollow');
    result.headers.set('X-Content-Type-Options','nosniff');
    result.headers.set('Referrer-Policy','same-origin');
    return result;
  }
};
