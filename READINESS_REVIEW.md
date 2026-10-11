# Final readiness review - October 11, 2026

Starting revision 48ded07ee43fade11d33101e97a4e393401c7afb. Ready for limited offseason historical research; not finished for live 2027 league decisions.

## Complete

Four-page navigation, manual snapshot reload, Free Agent search/type/position/activity filters, 100-row pagination and existing sorting/color rules. Failed reloads on Free Agent and Player Lab retain usable data with explicit stale warnings. Conservative MLBAM matching rejects unresolved/conflicting identities; representative duplicate cases and Harper/Civale were verified in Step 6. Historical 2026 ownership is preserved separately from partial configured 2027 scoring. Statcast, Baseball Monster and FIC collectors work; current-week PL/RotoBaller ratings are unavailable and stale data are suppressed.

## Critical repairs in this pass

- Landing page counts were insufficiently labeled: the existing introductory text now identifies historical LONGBALL 2026 ownership/statistics, partial Fantrax 2027 scoring and pending primary-league activation.
- Schedule collector requested/counts all game types, allowing spring-training volume to activate regular-season mode. It now requests and independently accepts only gameType R. Regression fixture includes 30 exhibition games, a postseason game and one regular game; only the regular game survives. No current matchup was fabricated.

## Remaining classification

CRITICAL before 2027 live operation: complete/confirm the primary 2027 rosters, then deliberately update collector, publication and reader league guards together. Present collector/workflow and publication/reader are pinned to the historical 2026 league ID; 2027 cannot silently replace it. Readiness inspection found Desert Rats and two other 2027 teams had only five players. Do not merge ownership across leagues.

CRITICAL for exact fantasy-point accuracy: verify Fantrax RP override application and SVH event semantics; implement cycles, hitter picked-off penalties, no-hitter bonuses and aggregate QS coverage only from supported verified fields. Missing source fields currently default to zero, so current calculations are explicitly partial rather than exact Fantrax reconciliation. Raw historical baseball statistics remain useful.

IMPORTANT: resolve remaining 198 formerly ambiguous identity records through authoritative ID crosswalks; 9,207 total pool identities lack verified MLB season-catalogue links. Valid traded/inactive/minor-league players can be withheld by conservative matching. Coordinate the independent page modules' refresh cadence and timestamps; manual reload currently does not necessarily regenerate the cloud snapshot. Validate recommendations against outcomes before treating heuristic colors as predictions.

SEASON-DEPENDENT: verify real 2027 daily probable starters, weekly grids/grades, PL/RotoBaller articles, injuries, matchup scores, starts used and future schedule changes when authentic league/source evidence becomes available. Existing fixtures cover in-season/offseason and stale-rating suppression, not live future-season behavior. Scheduled date boundaries still rely on the calendar plus a regular-game-count threshold.

OPTIONAL: reconcile older CONFIGURATION.md prose/test references and improve small-screen table ergonomics. No FanGraphs integration added; it remains absent.

Tests: 70 Python and 41 Node tests passed once. No external-source retries were performed. The Cloudflare workflow provides deployment checks; final live verification follows deployment. No rebuild, migration, scoring-weight change, identity relaxation, ownership merge or new feature was introduced.
