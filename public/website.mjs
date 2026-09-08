import {SNAPSHOT_URL, validateSnapshot} from './snapshot-contract.mjs';
const status = document.getElementById('freshness');
function rows(id, records, columns, key) {
  const body = document.getElementById(id);
  body.replaceChildren(...records.map(record => {
    const row = document.createElement('tr');
    row.dataset.entityId = record[key];
    for (const col of columns) {
      const cell = document.createElement('td');
      cell.textContent = record[col] ?? (col === 'Player' ? `Name unavailable · ${record['Player ID']}` : 'Unavailable');
      row.append(cell);
    }
    return row;
  }));
}
async function refresh() {
  try {
    const response = await fetch(SNAPSHOT_URL+'?refresh='+Date.now(), {cache:'no-store'});
    if (!response.ok) throw Error();
    const data = validateSnapshot(await response.json());
    const team = data.teams.find(t => t.Team.trim().toLowerCase() === 'desert rats');
    rows('roster-rows', data.players.filter(p => p['Fantasy Team ID'] === team['Team ID']), ['Player','Positions','Status'], 'Player ID');
    rows('standings-rows', data.teams, ['Team','Record','Points'], 'Team ID');
    status.dataset.generatedAt = data.generated_at;
    status.textContent = `Last Updated: ${new Date(data.generated_at).toLocaleString()} · ${data.source}`;
  } catch {
    document.getElementById('roster-rows').replaceChildren();
    document.getElementById('standings-rows').replaceChildren();
    delete status.dataset.generatedAt;
    status.textContent = 'Current data unavailable: the latest complete refresh could not be verified.';
  }
}
refresh();
setInterval(refresh, 300000);
