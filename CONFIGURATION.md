# FantasyGM2027 operating configuration

The existing GitHub repository and Cloudflare Worker are retained. No Airtable writes, hosting migration, public sharing expansion or new data provider is introduced.

## Ownership and statistics

The last complete historical LONGBALL 2026 publication remains the roster/ownership source. Its `generated_at` is never advanced by enriching MLB statistics, loading the browser or rebuilding the site. Historical availability is not current availability. The configured 2027 league ID is `n81gfju2muo8y07b`.

`readiness.py` reads the 2027 league configuration and all 12 roster responses, compares the configured scoring to `public/scoring-model.json`, and fails if they differ. It publishes a separate readiness summary, never merges ownership. Reduced or empty keeper rosters are expected during the offseason. Five keepers by November 1, two by February 1, and the February 15 frenzy are league procedures, not data errors.

Historical 7/14/30-day research windows end on the last completed 2026 MLB regular-season game (verified October 30 as September 27). Cancelled, exhibition and postseason games cannot set this date. Every statistical window remains explicitly dated. Season and Statcast data remain labeled 2026.

## Scoring

`public/scoring-model.json` is the complete configured Fantrax 2027 category/weight contract, checked directly October 30, 2026. `scoring_model.py` handles every normalized event, including cycles, hitter picked-off penalties, QS and no-hitters. Missing event counts yield a partial result, never an invented zero. RP decisions require a verified Fantrax scoring role for an exact normalized result. The MLB partial adapters retain their disclosed appearance-role assumption; mixed aggregate decisions are withheld.

Configured SVH is Saves + Holds at +5 per event. HR allowed is -2; shutouts +2; strikeouts +1.5. Balks, wild pitches and perfect-game bonuses are absent from the current configuration. The written earlier proposal does not override the verified configuration. MLB aggregate feeds still do not prove cycles, hitter pickoffs, QS and no-hitters; partial values must not be called exact Fantrax points. Provider-specific holds and RP/flex scoring need applied scoring examples.

## Browser behavior

All seven renderers share `snapshot-store.mjs`, with one request/validation result and a 15-second timeout. A successful reload updates every page; filters and Player Lab selections remain local. Older publications are rejected. Failures retain the previous publication and show a global warning. The browser checks snapshot age every minute. Historical data can load beyond 30 hours only through an explicit historical-research path; ordinary stale and future-dated publications remain rejected.

Website data comes from `/public/fantasygm.json` on the authenticated site origin. Browser code does not read the GitHub raw URL. Historical/stale snapshots disable live Daily/Weekly context and actionable add/drop signals. Heuristic signals have no demonstrated predictive accuracy. Missing/conflicting MLB identities withhold metrics; duplicate MLB links cannot receive statistics.

## Deployment

The existing daily 05:45 America/Phoenix schedule is retained. The workflow tests, verifies 2027 readiness, enriches a temporary historical research snapshot, builds the four pages, and tests mandatory Worker authentication before deployment. It verifies anonymous website/data requests are denied after deployment. It does not commit collected data or write external systems. Failed source checks preserve the existing deployment.

The existing Worker authenticates every request before static asset handling (`run_worker_first: true`). A strong owner password stays out of GitHub; only its SHA-256 verifier is configured. A separate random session-signing key is masked in Actions and stored as a Cloudflare Worker secret. Sessions use HMAC, a server-checked 12-hour expiration, HttpOnly/Secure/SameSite cookies, same-origin login and private cache headers. Public previews are disabled. Anonymous website/data requests must return the private sign-in gate. No Zero Trust subscription or billing activation is required.

Local verification:

```
python -m unittest discover -v
node --test test_*.mjs
python readiness.py
python build_site.py --snapshot /absolute/path/to/verified-research.json
python verify_private.py https://fantasygm2027-desert-rats.desertrat54.workers.dev
```

## Current keeper view and archive

The default view now collects current 2027 keeper ownership and availability through a separate validated contract. All 12 team responses are required, but empty keeper rosters are valid. No invented standings are displayed. Historical 2026 baseball statistics may be joined only through a unique verified MLB identity; ownership is never copied from the archive. The roster selector opens the preserved 2026 publication separately. Both datasets remain behind authentication. The keeper view stays research-only until live 2027 source contracts and applied scoring examples are verified.
