# FantasyGM daily refresh and website publication

The existing Fantrax collector is scheduled daily at 05:45 America/Phoenix (12:45 UTC) and on manual workflow dispatch. GitHub may start scheduled runs later. Changes to the refresh workflow or publication builder also trigger a run. No enablement variable is required.

Repository secrets remain FANTRAX_USER_SECRET_ID and AIRTABLE_TOKEN. The token is used only in GitHub Actions and is never copied into browser code or the snapshot. The collector and Airtable backend safeguards are unchanged.

After Airtable sync succeeds, public_snapshot.py reads back all current teams and players, verifies stable IDs, memberships and the exact collection timestamp, and allowlists public fields. It requires all 12 standings teams, nonempty rosters, and a collection no older than two hours. Names omitted by Fantrax are preserved only by league and stable player ID. Missing metrics remain unavailable; old Airtable metrics do not fill missing source values.

Only public/fantasygm.json is committed as one atomic publication. Raw responses stay in the runner temporary directory. A failed collection, partial sync, failed readback or failed push leaves the last publication intact. Concurrent branch changes cause the push to fail safely; rerun rather than force-pushing.

The repository index.html consumes this sanitized publication. Phase 1 extends the collector only; neither Sites website is changed or switched to the publication. The Sites source repositories are separate, and the future shared reader can use this fixed public URL without Airtable credentials:
https://raw.githubusercontent.com/Longball-debug/Team/main/public/fantasygm.json

Both readers reject empty, invalid, future-dated or more-than-30-hour-old data. Last Updated comes from the collection timestamp, not page load. The public publication contains only league-facing IDs, names, roster positions/status, standings record and points; no private Airtable fields or credentials.

Tests: python -m unittest discover -v; node --test test_snapshot_contract.mjs; node test_website_e2e.mjs (Playwright required). Set SITE_URL to test the Sites UI with fixtures. Set VERIFY_LATEST=1 as well to compare its API and rendered rows against the latest publication. Owner-private verification accepts SITE_BYPASS through the environment; never save that value in source or logs.

Phase 1 adds `pool` using the already-collected league info, roster and player catalogue responses. Its fields match the current FantasyGM live reader: `fantraxId`, `name`, `mlbTeam`, `availability`, `positions`, `teamId`, `teamName`, and `sourceStatus`. Missing or conflicting identity/status evidence stays `UNKNOWN`; an unowned player is never assumed to be a free agent. Roster `players` also include `MLB Team`. All existing roster/standings validation and Airtable readback checks remain in place, and pool ownership is checked against that verified roster before publication.

One additional read-only Fantrax POST retrieves the same recent executed CLAIM_DROP history page as FantasyGM2027. `transactions` contains `id`, `fantraxId`, `name`, `action` (ADD/DROP), `teamName`, `teamId`, and the original Fantrax `date` display text. `transaction_scope` explicitly records that this is one recent page (maxResultsPerPage 10), not full history; paired adds/drops can yield more than 10 rows. If unavailable, `transactions` is null and `unavailable` includes transactions; a verified empty response is an empty list. No credentials, raw responses, or private Airtable fields enter the publication.

The existing `schema_version: 1`, league ID and collection `generated_at` timestamp remain compatible. Matchup scores, starts used, injury details and pitcher ratings remain unavailable. MLB schedules, projections, frozen reports and manually observed matchup evidence remain outside this Fantrax snapshot. No website, newsletter or history-site features are changed.
