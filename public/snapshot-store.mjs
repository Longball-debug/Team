import {SNAPSHOT_URL, validateSnapshot} from './snapshot-contract.mjs';
let pending = null;
let current = null;
let lastError = false;
const listeners = new Set();
export function subscribeSnapshot(listener) { listeners.add(listener); return () => listeners.delete(listener); }
export async function loadPublishedSnapshot() {
  if (pending) return pending;
  pending = (async () => {
    const response = await fetch(SNAPSHOT_URL, {cache:'no-store', signal:AbortSignal.timeout(15000)});
    if (!response.ok) throw new Error(`Snapshot HTTP ${response.status}`);
    const next = validateSnapshot(await response.json(), Date.now(), {allowHistorical:true});
    if (current && Date.parse(next.generated_at) < Date.parse(current.generated_at)) throw new Error('Snapshot rollback rejected');
    current = next;
    lastError = false;
    for (const listener of listeners) { try { listener(next); } catch { /* One renderer cannot invalidate the shared publication. */ } }
    return next;
  })();
  try { return await pending; } catch (error) { lastError=true; if (typeof document!=='undefined') { const banner=document.getElementById('snapshot-health'); if(banner) banner.textContent=`RELOAD FAILED — ${snapshotNotice(current)}`; } throw error; } finally { pending = null; }
}
export function snapshotNotice(data, now=Date.now()) {
  if (!data) return 'Data unavailable. No verified snapshot is loaded.';
  const stale = now-Date.parse(data.generated_at)>30*3600000;
  return `${stale?'STALE DATA — ':''}${data.historical?'Historical 2026 research only. Ownership is historical; add/drop and start/sit recommendations are disabled. ':''}Collected: ${new Date(data.generated_at).toLocaleString()}. Reload reads the published snapshot; it does not collect new data. FP is a partial 2027 model. RP decisions use an unverified appearance-role assumption; Saves + Holds is +5 per event. Cycles, hitter pickoffs and aggregate NH/QS may be unavailable.`;
}
if (typeof document !== 'undefined') {
  const banner = document.createElement('div');
  banner.id='snapshot-health'; banner.className='warning'; banner.setAttribute('role','status');
  document.querySelector('main, .container, body').prepend(banner);
  const update=()=>{banner.textContent=(lastError?'RELOAD FAILED — ':'')+snapshotNotice(current);};
  subscribeSnapshot(update);
  update();
  setInterval(update,60000);
}
