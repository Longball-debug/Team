import fs from 'node:fs';
import assert from 'node:assert/strict';
import { fetchSharedSnapshot, publishedCandidates } from '../app/shared/shared-snapshot.mjs';
import { SNAPSHOT_URL, validateSnapshot } from '../app/shared/snapshot-contract.mjs';

// Inspect one saved publication without triggering collection or fetching MLB.
const raw = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const originalFetch = globalThis.fetch;
const calls = [];
try {
  globalThis.fetch = async (url, options) => {
    calls.push(String(url));
    assert.equal(url, SNAPSHOT_URL);
    assert.equal(options.cache, 'no-store');
    return new Response(JSON.stringify(raw));
  };
  const snapshot = await fetchSharedSnapshot();
  assert.equal(calls.length, 1);
  assert.equal(snapshot.generated_at, raw.generated_at);
  for (const team of raw.teams) {
    const actual = snapshot.teams.find(t => t['Team ID'] === team['Team ID']);
    for (const key of ['Team ID', 'Team', 'Record', 'Points']) assert.deepEqual(actual[key], team[key]);
  }
  const pool = new Map(snapshot.pool.map(p => [p.fantraxId, p]));
  assert.equal(pool.size, raw.pool.length);
  for (const player of raw.players) {
    const actual = snapshot.players.find(p => p['Player ID'] === player['Player ID']);
    for (const key of ['Player ID', 'Player', 'MLB Team', 'Fantasy Team ID', 'Positions', 'Status']) {
      assert.deepEqual(actual[key], player[key]);
      assert.equal(typeof actual[key], 'string', `Missing roster field ${key}`);
    }
    assert.equal(pool.get(player['Player ID'])?.teamId, player['Fantasy Team ID']);
  }
  for (const player of raw.pool) {
    const actual = pool.get(player.fantraxId);
    for (const key of ['fantraxId','name','mlbTeam','availability','positions','teamId','teamName','sourceStatus']) {
      assert.deepEqual(actual[key], player[key]);
    }
  }
  assert.deepEqual(snapshot.transactions, raw.transactions);
  for (const row of snapshot.transactions ?? []) {
    for (const key of ['id','name','action','teamName','date']) assert.equal(typeof row[key], 'string');
  }
  const available = raw.pool.find(p => p.availability === 'FREE AGENT' && p.positions && p.name !== 'Name unavailable');
  assert.ok(available);
  assert.equal(publishedCandidates(snapshot, [available])[0].availability, 'FA');
  assert.deepEqual(publishedCandidates(snapshot, [{fantraxId:raw.players[0]['Player ID']}, {fantraxId:'missing-id'}]), []);
  assert.throws(() => validateSnapshot(raw, Date.parse(raw.generated_at) + 31*3600000));
  globalThis.fetch = async () => new Response('', {status:503});
  await assert.rejects(fetchSharedSnapshot());
  console.log(JSON.stringify({compatible:true,generated_at:raw.generated_at,teams:snapshot.teams.length,
    players:snapshot.players.length,pool:snapshot.pool.length,transactions:snapshot.transactions?.length,
    unavailable:raw.unavailable,automaticFantraxCalls:0}, null, 2));
} finally { globalThis.fetch = originalFetch; }
