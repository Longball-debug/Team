export type Team = { 'Team': string; 'Team ID': string; Record?: string; Points?: number };
export type Player = { 'Player ID': string; Player?: string; 'MLB Team'?: string|null; 'Fantasy Team ID': string; Positions?: string; Status?: string };
export type PoolPlayer = {fantraxId:string;name:string;mlbTeam?:string|null;availability:string;positions:string|null;teamId:string|null;teamName:string|null;sourceStatus:string|null};
export type Snapshot = { schema_version: number; league_id: string; generated_at: string; teams: Team[]; players: Player[]; pool?:PoolPlayer[]; transactions?:Array<{id:string;name:string;action:string;teamName:string;date:string}>|null; unavailable: string[] };
import { validateSnapshot } from './snapshot-contract.mjs';
import { fetchFantrax } from './fantrax-live.mjs';
export { validateSnapshot } from './snapshot-contract.mjs';
export async function readSnapshot() {
  try {
    const snapshot: Snapshot = validateSnapshot(await fetchFantrax());
    return { status: 'current', message: 'Fantrax · current rosters, ownership, free agents, waivers and eligibility', snapshot };
  } catch (error) { console.error("Fantrax read failed", error);
    return { status: 'error', message: 'Current Fantrax data is unavailable or overdue. No stale or partial refresh is shown.', snapshot: null };
  }
}

