import { readSnapshot } from '../../shared/fantrax';
export async function GET() {
 const data = await readSnapshot();
 const lines = ['FantasyGM2027 — shared Fantrax report', '', data.message];
 if(data.snapshot) {
  lines.push('Published: '+data.snapshot.generated_at, 'Status: '+data.status, '', 'SEASON STANDINGS');
  for(const t of data.snapshot.teams) lines.push(`${t.Team}: ${t.Record??'record unavailable'}; ${t.Points??'unavailable'} season points`);
  lines.push('', 'ROSTER COUNTS');
  for(const t of data.snapshot.teams) lines.push(`${t.Team}: ${data.snapshot.players.filter(p=>p['Fantasy Team ID']===t['Team ID']).length} players`);
 }
 lines.push('', 'NOT AVAILABLE: live matchup scores, starts used, injuries, free agents, pitcher ratings.', 'This is a factual data report, not a researched daily playbook.');
 return new Response(lines.join('\n'),{headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'}});
}
