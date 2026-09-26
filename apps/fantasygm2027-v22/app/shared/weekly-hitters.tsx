'use client';
import { useEffect, useState } from 'react';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { dates } from './longball';

const fresh = (value: unknown, now: number) => {
  const age = typeof value === 'string' ? now - Date.parse(value) : NaN;
  return Number.isFinite(age) && age >= 0 && age <= 15 * 60000;
};
const dayLabel = (date: string) => new Date(date+'T12:00:00Z').toLocaleDateString('en-US', { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric' });
const colors = { Green: '#77e0b2', Yellow: '#e4c678', Red: '#f2ad8f' };

export default function WeeklyHitters({current:c, failed=false}:{current:any;failed?:boolean}) {
  const [now,setNow] = useState(() => Date.now());
  useEffect(() => { const timer=setInterval(() => setNow(Date.now()),30000); return () => clearInterval(timer); },[]);
  const d=dates(new Date(now));
  const verified=!failed && c?.today===d.today && c?.week===d.monday && c?.feed?.status==='current' && fresh(c.generatedAt,now) && fresh(c.feed.generatedAt,now);
  const hitters=verified ? (c.roster??[]).filter((p:any) => p.pitcher===false) : [];
  const rows=hitters.flatMap((p:any) => {
    if (!c.scheduleVerified || !p.matched) return [{name:p.name,date:null,opponent:'Unverified',pitcher:'Unverified',color:null}];
    const slate=(c.hitterOutlook??[]).find((h:any) => h.name===p.name)?.slate;
    if (!Array.isArray(slate)) return [{name:p.name,date:null,opponent:'Unverified',pitcher:'Unverified',color:null}];
    return Array.from({length:7},(_,i) => d.shift(d.monday,i)).flatMap(date => {
      const games=slate.filter((g:any) => g.date===date);
      if (!games.length) return [{name:p.name,date,opponent:'Off day',pitcher:'—',color:null}];
      return games.map((g:any) => {
        const probable=typeof g.pitcher==='string' && g.pitcher!=='TBD' && g.pitcher.trim();
        const rated=probable && typeof g.base==='number' && Number.isFinite(g.base);
        return {name:p.name,date,opponent:g.opponent,pitcher:probable?g.pitcher:'TBD',color:rated?(g.base>=25?'Red':g.base>=15?'Yellow':'Green'):null};
      });
    });
  });
  return <div aria-label="Weekly Outlook hitters">
    <h3>Desert Rats hitters · current weekly matchups</h3>
    {!verified ? <p className="load-status" role="status">{c||failed?'Refresh to load current hitter evidence.':'Loading current hitter evidence…'}</p> : <>
      <p className="quiet">Current roster · {d.monday}–{d.sunday} · Updated {new Date(c.generatedAt).toLocaleString('en-US',{timeZone:'America/Phoenix',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})} AZ</p>
      <div className="board"><Table><TableHeader><TableRow>{['Desert Rats hitter','Day / date','Opponent','Opposing probable SP','Pitcher List rating','Matchup color'].map(h=><TableHead key={h}>{h}</TableHead>)}</TableRow></TableHeader><TableBody>
        {rows.length?rows.map((r:any,i:number)=><TableRow key={i}><TableCell>{r.name}</TableCell><TableCell>{r.date?dayLabel(r.date):'Unverified'}</TableCell><TableCell>{r.opponent}</TableCell><TableCell>{r.pitcher}</TableCell><TableCell>{r.opponent==='Off day'?'—':'Unverified'}</TableCell><TableCell>{r.color?<span style={{color:colors[r.color as keyof typeof colors],fontWeight:700}}>{r.color}</span>:r.opponent==='Off day'?'—':'Unverified'}</TableCell></TableRow>):<TableRow><TableCell colSpan={6}>No current Desert Rats hitters available.</TableCell></TableRow>}
      </TableBody></Table></div>
      <p className="quiet">Green: favorable · Yellow: balanced · Red: difficult. Colors use the existing opposing starter’s 30-day Longball points per start: below 15 / 15–24.9 / 25+. Unrated starters remain unverified. Pitcher List ratings are not currently verified. Probable starters may change.</p>
    </>}
  </div>;
}
