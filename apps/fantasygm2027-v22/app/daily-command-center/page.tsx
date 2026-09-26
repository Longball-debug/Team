'use client';
import { useEffect, useState } from 'react';
import DailyReport from '../shared/daily-report';
export default function Page() {
 const [current,setCurrent]=useState<any>(null),[busy,setBusy]=useState(true),[failed,setFailed]=useState(false);
 async function refresh(){setBusy(true);try{const r=await fetch('/api/frontoffice',{cache:'no-store'});if(!r.ok)throw Error();const data:any=await r.json();setCurrent(data.current);setFailed(false);}catch{setCurrent(null);setFailed(true);}finally{setBusy(false);}}
 useEffect(()=>{refresh();const timer=setInterval(refresh,300000);return()=>clearInterval(timer);},[]);
 return <main className="dcc"><header className="dcc-masthead"><div><p>FANTASYGM2027 / DESERT RATS</p><h1>Daily Command Center</h1></div><a href="/" style={{display:"inline-block",padding:"6px 10px",border:"1px solid #377960",borderRadius:6,color:"#b7f8df",background:"#193329",fontSize:13,fontWeight:600,textDecoration:"none",whiteSpace:"nowrap"}}>Back to Home</a><button onClick={refresh} disabled={busy}>{busy?'Refreshing…':'Refresh'}</button></header><DailyReport current={current} failed={failed}/></main>;
}

