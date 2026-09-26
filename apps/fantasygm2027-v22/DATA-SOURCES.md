# Shared league data — migration step 4

The website reads `https://raw.githubusercontent.com/Longball-debug/Team/main/public/fantasygm.json` with `cache: no-store`, a 20-second timeout and the existing snapshot validator. The publisher's timestamp is preserved. Invalid, failed, future-dated or over-30-hour-old publications remain unavailable; the app does not fall back to collecting Fantrax.

## Overlap with the old direct reader

| Shared fields | Previous automatic source |
| --- | --- |
| `teams`: Team ID, Team, Record, Points | getTeamRosters / getStandings |
| `players`: Player ID, Player, MLB Team, Fantasy Team ID, Positions, Status | getTeamRosters / getLeagueInfo / getPlayerIds |
| `pool`: fantraxId, name, mlbTeam, availability, positions, teamId, teamName, sourceStatus | getLeagueInfo / getTeamRosters / getPlayerIds |
| `transactions`: id, fantraxId, name, action, teamName, teamId, date | getTransactionDetailsHistory, recent executed CLAIM_DROP page |
| schema_version, league_id, generated_at | Normalized collection metadata |

All of these now come from the published snapshot. Recent transactions remain a limited history page, not complete history. Missing transactions remain null, and unknown availability remains UNKNOWN.

The Free Agent Board retains its existing manually selected candidate shortlist. The shortlist's names, eligibility and availability now come from matching snapshot IDs. A player who is rostered, unknown, absent or missing eligibility is excluded; no unavailable player is treated as a free agent. This does not expand the shortlist into thousands of MLB enrichment requests.

## Sources retained

No automatic direct Fantrax calls remain in the active reader. `fantrax-live.mjs` is retained unchanged as legacy code and has no active imports. The collector at the repository root continues to collect Fantrax independently of page requests.

Verified manual Fantrax matchup evidence in REPORTS remains necessary for weekly opponent assignment, scores, starts used/yesterday and players remaining. It retains its 24-hour expiry. Missing evidence stays unavailable. Injury details and externally verified pitcher ratings are not supplied by this snapshot. Existing locally calculated ratings and scores remain unchanged.

MLB still supplies player matching/search, team identity, schedules, probable starters, handedness when available, game logs and the inputs for existing 7/14/30-day calculations. No MLB request or calculation was changed.

## Refresh and storage

Each front-office read checks the latest published snapshot. The 15-minute derived-report cache is reused only when the source timestamp matches and the feed is current; a newer or unavailable publication rebuilds the current result. The same fetched snapshot is passed into the report builder. Manual POST refresh also uses the shared reader. No workflow dispatch or second collection path is introduced. Monday baseline persistence and manual evidence storage remain unchanged; no REPORTS data was migrated.

The five pages, layout, scoring, authentication, collector and hosting configuration are unchanged. This step does not deploy.
