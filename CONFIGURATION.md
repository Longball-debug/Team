# FantasyGM daily refresh and website publication

The existing Fantrax collector runs daily at 06:17 America/Phoenix and on manual workflow dispatch. Changes to the refresh workflow or publication builder also trigger a run. No enablement variable is required.

Repository secrets remain FANTRAX_USER_SECRET_ID and AIRTABLE_TOKEN. The token is used only in GitHub Actions and is never copied into browser code or the snapshot. The collector and Airtable backend safeguards are unchanged.

After Airtable sync succeeds, public_snapshot.py reads back all current teams and players, verifies stable IDs, memberships and the exact collection timestamp, and allowlists public fields. It requires all 12 standings teams, nonempty rosters, and a collection no older than two hours. Names omitted by Fantrax are preserved only by league and stable player ID. Missing metrics remain unavailable; old Airtable metrics do not fill missing source values.

Only public/fantasygm.json is committed as one atomic publication. Raw responses stay in the runner temporary directory. A failed collection, partial sync, failed readback or failed push leaves the last publication intact. Concurrent branch changes cause the push to fail safely; rerun rather than force-pushing.

The repository index.html and existing Desert Rats Sites server reader consume this sanitized publication. The Sites source is a separate repository managed by Sites; updating the legacy GitHub HTML alone does not deploy that application. The deployed reader retrieves this fixed public URL without Airtable credentials:
https://raw.githubusercontent.com/Longball-debug/Team/main/public/fantasygm.json

Both readers reject empty, invalid, future-dated or more-than-30-hour-old data. Last Updated comes from the collection timestamp, not page load. The public publication contains only league-facing IDs, names, roster positions/status, standings record and points; no private Airtable fields or credentials.

Tests: python -m unittest discover -v; node --test test_snapshot_contract.mjs; node test_website_e2e.mjs (Playwright required). Set SITE_URL to test the Sites UI with fixtures. Set VERIFY_LATEST=1 as well to compare its API and rendered rows against the latest publication. Owner-private verification accepts SITE_BYPASS through the environment; never save that value in source or logs.

No matchup, injury, ranking, free-agent, newsletter or history-site features are added by this repair.
