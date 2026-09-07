# FantasyGM cloud refresh — prepared, not installed

Target repository: https://github.com/Longball-debug/Team
Base: https://airtable.com/appA7fcI1VWfwOUXq

This package adds the existing Fantrax collector and an Airtable publisher. It does not replace index.html. The workflow runs once daily at 06:17 America/Phoenix, and supports manual runs. It retrieves Fantrax once and upserts shared operational data. Raw responses remain in the temporary runner directory and are not uploaded or committed.

## Activation still required

1. Save these files in the Team repository, retaining the .github/workflows directory.
2. In repository Settings → Secrets and variables → Actions, configure FANTRAX_USER_SECRET_ID and AIRTABLE_TOKEN. Enter credentials only in secure settings, not chat or source files. AIRTABLE_TOKEN needs data.records:read and data.records:write, restricted to the selected base. Schema permissions are unnecessary for this publisher.
3. Run FantasyGM cloud refresh manually and verify the resulting Teams and Players records before relying on scheduled refreshes.
4. Configure server-side readers on the existing Sites with a separate read-only Airtable credential. Both Sites currently have no environment variables. Their existing source and access controls must be inspected before modifying and publishing them.

## Data coverage and limits

Validated against the saved September 4 export: 12 teams and 321 roster players. Fantrax's points field contains the win-loss-tie record; totalPointsFor supplies numeric fantasy points. Player names are absent in the observed roster payload. Existing manually supplied Airtable names are preserved. FAAB is not inferred from salary cap.

Only Teams and Players are populated by this initial publisher. Daily matchups, SP ratings, injuries, free-agent metrics, and league matchup scores require verified sources and mappings; those tables remain empty. This is not a completed migration of those features.

Updates are batched and keyed by league and entity ID. Players absent from a complete fresh roster lose their team membership without deleting their identity or manual fields. Newer Airtable data blocks stale writes. Failed multi-batch writes can leave a partial refresh; rerunning repairs it. Website readers must not assume atomic snapshots. Do not cut over the sites until freshness and partial-refresh handling are implemented and tested.

The local Windows refresh has not been disabled. The workflow is not active until installed in GitHub, and website connections have not been changed.
