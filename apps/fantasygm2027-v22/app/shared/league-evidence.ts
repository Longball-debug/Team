import {validateSnapshot} from './fantrax';
import {dates} from './longball';
export function validateEvidence(input:any){
 if(!input||input.leagueId!=='gxq8uqpqmg5m5edj'||input.source!=='Fantrax')throw Error('Verified Longball Fantrax evidence is required.');
 const url=new URL(input.sourceUrl);if(url.protocol!=='https:'||!/(^|\.)fantrax\.com$/.test(url.hostname))throw Error('Fantrax source URL required.');
 const age=Date.now()-Date.parse(input.capturedAt);if(!Number.isFinite(age)||age< -300000||age>24*3600000)throw Error('Evidence must be captured within the last 24 hours.');
 const packet:any={leagueId:input.leagueId,source:'Fantrax',sourceUrl:url.href,capturedAt:input.capturedAt};
 if(input.rosterSnapshot)packet.rosterSnapshot=validateSnapshot(input.rosterSnapshot);
 if(input.matchup){const m=input.matchup;if(m.week!==dates().monday||!m.opponentTeamId)throw Error('Current matchup week and opponent team ID required.');const number=(v:any)=>typeof v==='number'&&Number.isFinite(v);for(const key of ['ourScore','opponentScore','ourStartsUsed','opponentStartsUsed','ourStartsYesterday','ourPlayersRemaining','opponentPlayersRemaining'])if(m[key]!=null&&!number(m[key]))throw Error('Invalid matchup number');for(const key of ['ourStartsUsed','opponentStartsUsed','ourStartsYesterday','ourPlayersRemaining','opponentPlayersRemaining'])if(m[key]!=null&&(!Number.isInteger(m[key])||m[key]<0))throw Error('Invalid matchup count');packet.matchup=Object.fromEntries(['week','opponentTeamId','ourScore','opponentScore','ourStartsUsed','opponentStartsUsed','ourStartsYesterday','ourPlayersRemaining','opponentPlayersRemaining'].filter(k=>m[k]!=null).map(k=>[k,m[k]]));}
 if(input.freeAgents){if(!Array.isArray(input.freeAgents)||input.freeAgents.length>100)throw Error('Maximum 100 verified free agents per snapshot.');packet.freeAgents=input.freeAgents.map((p:any)=>{if(!p.fantraxId||!p.name||!p.positions||!['FA','WAIVERS'].includes(p.availability))throw Error('Availability and eligible positions required.');return {fantraxId:String(p.fantraxId),name:String(p.name),positions:String(p.positions),availability:p.availability};});}
 return packet;
}
