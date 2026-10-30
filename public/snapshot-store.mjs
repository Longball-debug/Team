import {SNAPSHOT_URL, validateSnapshot} from './snapshot-contract.mjs';
let pending = null;
let selectedUrl = SNAPSHOT_URL;
let current = null;
let lastError = false;
const listeners = new Set();
export function subscribeSnapshot(listener) { listeners.add(listener); return () => listeners.delete(listener); }
export async function loadPublishedSnapshot() {
  if (pending) return pending;
  pending = (async () => {
    const response = await fetch(selectedUrl, {cache:'no-store', signal:AbortSignal.timeout(15000)});
    if (!response.ok) throw new Error(`Snapshot HTTP ${response.status}`);
    const next = validateSnapshot(await response.json(), Date.now(), {allowHistorical:true});
    if (current && next.league_id === current.league_id && Date.parse(next.generated_at) < Date.parse(current.generated_at)) throw new Error('Snapshot rollback rejected');
    current = next;
    lastError = false;
    for (const listener of listeners) { try { listener(next); } catch { /* One renderer cannot invalidate the shared publication. */ } }
    return next;
  })();
  try { return await pending; } catch (error) { lastError=true; if (typeof document!=='undefined') { const banner=document.getElementById('snapshot-health'); if(banner) banner.textContent=`RELOAD FAILED — ${snapshotNotice(current)}`; } throw error; } finally { pending = null; }
}
export async function selectDataset(value) {
  if (!['/public/fantasygm.json','/public/history-2026.json'].includes(value)) throw new Error('Unknown dataset');
  if (pending) await pending;
  const previous=selectedUrl;
  selectedUrl=value;
  try{return await loadPublishedSnapshot();}catch(error){selectedUrl=previous;throw error;}
}
export function snapshotNotice(data, now=Date.now()) {
  if (!data) return 'Data unavailable. No verified snapshot is loaded.';
  const stale = now-Date.parse(data.generated_at)>30*3600000;
  return `${stale?'STALE DATA — ':''}${data.historical?'Historical 2026 research only. Ownership is historical; add/drop and start/sit recommendations are disabled. ':data.research_only?'Current 2027 keeper ownership with historical 2026 performance. Live start/sit and predictive recommendations are disabled. ':''}Ownership collected: ${new Date(data.generated_at).toLocaleString()}. Research windows end: ${data.player_lab?.recent_end_date || data.recent_14d?.end_date || 'unavailable'}. Reload reads the published snapshot; it does not collect new data. FP is a partial 2027 model. RP decisions use an unverified appearance-role assumption; Saves + Holds is +5 per event. Cycles, hitter pickoffs and aggregate NH/QS may be unavailable.`;
}
if (typeof document !== 'undefined') {
  const banner = document.createElement('div');
  banner.id='snapshot-health'; banner.className='warning'; banner.setAttribute('role','status');
  document.querySelector('main, .container, body').prepend(banner);
  const label=document.createElement('label');label.textContent='Roster view: ';label.style.cssText='display:block;padding:12px';
  const select=document.createElement('select');select.className='select';select.setAttribute('aria-label','Roster dataset');
  for (const [value,text] of [['/public/fantasygm.json','Current 2027 keepers'],['/public/history-2026.json','Historical 2026 archive']]) { const option=document.createElement('option');option.value=value;option.textContent=text;select.append(option); }
  label.append(select);banner.before(label);
  select.addEventListener('change',()=>{selectDataset(select.value).catch(()=>{select.value=current?.historical?'/public/history-2026.json':SNAPSHOT_URL;banner.textContent='Requested dataset unavailable. The previous snapshot remains loaded.';});});
  const update=()=>{banner.textContent=(lastError?'RELOAD FAILED — ':'')+snapshotNotice(current);};
  subscribeSnapshot(update);
  update();
  setInterval(update,60000);
}
