'use client';
import { useEffect, useState } from 'react';
import type { Snapshot } from './fantrax';
import { validateSnapshot } from './snapshot-contract.mjs';
export default function FantraxPanel({ desert = false }: { desert?: boolean }) {
  const [data, setData] = useState<{status:string;message:string;snapshot:Snapshot|null}>({status:'loading',message:'Checking shared Fantrax data…',snapshot:null});
  async function refresh() {
    try { const r = await fetch('/api/fantrax', {cache:'no-store'}); if(!r.ok) throw new Error(); const result = await r.json(); if(result.status !== 'current') throw new Error(); result.snapshot = validateSnapshot(result.snapshot); setData(result); }
    catch { setData({status:'error',message:'Shared Fantrax data is unavailable.',snapshot:null}); }
  }
  useEffect(() => { refresh(); const timer=setInterval(refresh,300000); return()=>clearInterval(timer); },[]);
  const [query,setQuery] = useState('');
  const [status,setStatus] = useState('ALL');
  const pool = data.snapshot?.pool??[];
  const matches = pool.filter(p=>(status==='ALL'||p.availability===status)&&`${p.name} ${p.fantraxId}`.toLowerCase().includes(query.trim().toLowerCase()));
  const team = data.snapshot?.teams.find(t=>t.Team.toLowerCase().includes('desert rats'));
  const players = data.snapshot?.players.filter(p=>!desert || p['Fantasy Team ID']===team?.['Team ID']);
  return <section aria-label="Shared Fantrax data" style={{margin:'20px 0',padding:24,border:'1px solid #64748b',borderRadius:12,background:desert?'#12232b':'#f8fafc',color:desert?'#f1f5f9':'#17232c'}}>
    <h2 style={{fontSize:22,fontWeight:800}}>Fantrax · shared league data</h2>
    <p role="status">{data.message}</p>
    {data.snapshot && <p data-testid="freshness" data-generated-at={data.snapshot.generated_at}>Last Updated: {new Date(data.snapshot.generated_at).toLocaleString('en-US',{timeZone:'America/Phoenix'})} Arizona time · {data.status.toUpperCase()}</p>}
    <p style={{margin:'12px 0'}}><button onClick={refresh} style={{textDecoration:'underline',marginRight:20}}>Check for updates</button><a href="/api/report" target="_blank" rel="noreferrer" style={{textDecoration:'underline'}}>Open shared data report</a></p>
    {data.snapshot && <><div style={{overflowX:'auto'}}><table style={{width:'100%',textAlign:'left'}}><caption>Season standings — these are not live matchup scores</caption><thead><tr><th>Team</th><th>Record</th><th>Season points</th></tr></thead><tbody data-testid="standings-rows">{data.snapshot.teams.map(t=><tr key={t['Team ID']} data-entity-id={t['Team ID']}><td>{t.Team}</td><td>{t.Record??'Unavailable'}</td><td>{t.Points??'Unavailable'}</td></tr>)}</tbody></table></div>
    <details open style={{marginTop:16}}><summary>{desert?'Desert Rats':'League'} roster · {players?.length??0} players</summary><div style={{overflowX:'auto'}}><table style={{width:'100%',textAlign:'left'}}><thead><tr><th>Player / MLB team</th><th>Position</th><th>Status</th></tr></thead><tbody data-testid="roster-rows">{players?.map(p=><tr key={p['Player ID']} data-entity-id={p['Player ID']}><td>{p.Player||'Name unavailable'}{p['MLB Team'] ? ` · ${p['MLB Team']}` : ''}</td><td>{p.Positions??'Unavailable'}</td><td>{p.Status??'Unavailable'}</td></tr>)}</tbody></table></div></details></>}
    {data.snapshot && <div style={{marginTop:24}}><h3>Fantrax player ownership and availability</h3>
    <p>Exact Fantrax IDs · UNKNOWN means league status or ownership cannot be verified.</p>
    <label>Search Fantrax players <input aria-label="Search Fantrax players" value={query} onChange={e=>setQuery(e.target.value)} style={{color:'#17232c',background:'white',padding:8,margin:8}}/></label>
    <label>Status <select aria-label="Fantrax availability filter" value={status} onChange={e=>setStatus(e.target.value)} style={{color:'#17232c',background:'white',padding:8}}>{['ALL','DESERT RATS','OTHER TEAM','FREE AGENT','WAIVERS','UNKNOWN'].map(s=><option key={s}>{s}</option>)}</select></label>
    <p>{matches.length} matching players · showing up to 50. Updated with the roster above.</p>
    <div style={{overflowX:'auto'}}><table style={{width:'100%',textAlign:'left'}}><thead><tr><th>Player / Fantrax ID</th><th>Availability</th><th>Fantasy team</th><th>Eligible positions</th></tr></thead><tbody data-testid="availability-rows">{matches.slice(0,50).map(p=><tr key={p.fantraxId}><td>{p.name} · {p.fantraxId}</td><td>{p.availability}</td><td>{p.teamName??'—'}</td><td>{p.positions??'UNKNOWN'}</td></tr>)}</tbody></table></div></div>}
    {data.snapshot && <details style={{marginTop:16}}><summary>Recent Fantrax adds / drops</summary>{data.snapshot.transactions?<table style={{width:'100%',textAlign:'left'}}><thead><tr><th>Player</th><th>Action</th><th>Team</th><th>Processed (EDT)</th></tr></thead><tbody>{data.snapshot.transactions.map(t=><tr key={t.id}><td>{t.name}</td><td>{t.action}</td><td>{t.teamName}</td><td>{t.date}</td></tr>)}</tbody></table>:<p>Transaction history unavailable.</p>}</details>}
    <p style={{marginTop:14,fontSize:13}}>Live matchup scores, starts used, injury details and pitcher ratings are not supplied by this feed.</p>
  </section>;
}
