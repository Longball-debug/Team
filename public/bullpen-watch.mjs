// Bullpen Opportunity Watch — research signals only, no inferred saves/holds or bullpen roles.
const positions = p => (Array.isArray(p.positions) ? p.positions : String(p.positions || '').split(/[,/|]/)).map(v=>String(v).trim().toUpperCase());
const free = p => /free|^fa$/i.test(String(p.availability || ''));
const valid = (p,w) => Number.isFinite(p['ppg'+w]) && Number.isFinite(p['games'+w]) && p['games'+w]>=2;
export function bullpenCandidates(pool, limit=8) {
  return (pool || []).filter(p=>free(p) && positions(p).includes('RP') && p.identityStatus==='Verified' && Number.isInteger(p.mlbId) && p.mlbId>0)
    .map(p=>{
      const seven=valid(p,7), fourteen=valid(p,14), thirty=valid(p,30);
      const rising=seven && thirty && p.ppg30!==0 ? (p.ppg7-p.ppg30)/Math.abs(p.ppg30) : null;
      const label=rising!==null && rising>=.15?'Rising':rising!==null && rising<=-.15?'Falling':rising!==null?'Steady':'Not enough data';
      const tone=label==='Rising'?'green':label==='Falling'?'red':label==='Steady'?'yellow':'gray';
      return {player:p,seven,fourteen,thirty,label,tone,rising,opportunities:'Not verified'};
    }).filter(x=>x.seven || x.fourteen || x.thirty)
    .sort((a,b)=>Number(b.seven)-Number(a.seven) || (Number.isFinite(b.player.ppg7)?b.player.ppg7:-Infinity)-(Number.isFinite(a.player.ppg7)?a.player.ppg7:-Infinity) || (Number.isFinite(b.player.ppg14)?b.player.ppg14:-Infinity)-(Number.isFinite(a.player.ppg14)?a.player.ppg14:-Infinity) || String(a.player.name||'').localeCompare(String(b.player.name||'')))
    .slice(0,limit);
}
