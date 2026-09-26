import { SNAPSHOT_URL, validateSnapshot } from './snapshot-contract.mjs';

export async function fetchSharedSnapshot() {
  const response = await fetch(SNAPSHOT_URL, {
    cache: 'no-store',
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error(`Shared snapshot unavailable: ${response.status}`);
  return validateSnapshot(await response.json());
}

// Preserve the manually selected shortlist, but take its overlapping league
// fields from the publication. Never infer free agency from a missing player.
export function publishedCandidates(snapshot, shortlist = []) {
  const pool = new Map((snapshot?.pool ?? []).map(player => [player.fantraxId, player]));
  return shortlist.flatMap(candidate => {
    const player = pool.get(candidate.fantraxId);
    if (!player || !['FREE AGENT', 'WAIVERS'].includes(player.availability)
      || !player.name || player.name === 'Name unavailable' || !player.positions) return [];
    return [{ fantraxId: player.fantraxId, name: player.name, positions: player.positions,
      availability: player.availability === 'FREE AGENT' ? 'FA' : 'WAIVERS' }];
  });
}
