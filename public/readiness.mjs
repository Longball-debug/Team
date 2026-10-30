const box=document.createElement('details');
box.className='warning';
const summary=document.createElement('summary');summary.textContent='2027 readiness and scoring coverage';box.append(summary);
const text=document.createElement('p');text.textContent='Historical 2026 ownership is separate from 2027 keeper rosters. Current recommendations are disabled. Predictive performance has not been established.';box.append(text);
document.getElementById('home')?.append(box);
try {
  const response=await fetch('/public/readiness.json',{cache:'no-store',signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw Error('Unavailable');const r=await response.json();
  if(r.league_id!=='n81gfju2muo8y07b'||r.teams!==12||!Number.isFinite(Date.parse(r.checked_at)))throw Error('Invalid');
  const p=document.createElement('p');p.textContent=`2027 configuration checked ${new Date(r.checked_at).toLocaleString()}. ${r.teams} team responses verified. Reduced offseason keeper rosters are expected. This does not activate live 2027 recommendations.`;box.append(p);
} catch {const p=document.createElement('p');p.textContent='Current 2027 readiness check unavailable. Data insufficient to answer current 2027 roster readiness.';box.append(p);}

try {
  const response=await fetch('/public/scoring-model.json',{cache:'no-store',signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw Error('Unavailable');const model=await response.json();
  if(model.league_id!=='n81gfju2muo8y07b')throw Error('Wrong league');
  const p=document.createElement('p');p.textContent=`Scoring configuration verified ${model.verified_at}. HR allowed −2; shutout +2; K +1.5; Saves + Holds +5. Every configured category has a normalized-event calculator; MLB source coverage remains partial. RP slot/flex scoring still needs applied Fantrax examples. No perfect-game, balk or wild-pitch category is configured.`;box.append(p);
} catch {const p=document.createElement('p');p.textContent='Scoring configuration unavailable.';box.append(p);}
