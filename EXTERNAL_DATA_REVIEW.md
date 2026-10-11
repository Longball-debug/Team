# External data reliability - October 11, 2026

Starting revision d4105b1ea03dfef707026827b76bca3a84715572. One audit request per existing external index/page; cached responses reused for diagnosis. No FanGraphs collector was found or added.

| Source | Result | Evidence |
|---|---|---|
| Pitcher List | REPAIRED; current ratings OFFSEASON UNAVAILABLE | Archive HTTP success, but article links are now relative. Old parser discovered zero. Repaired parser discovers five streamer articles, newest September 27. Requested week October 5-11 has no matching published streamer date in the inspected archive. Stale slugs are skipped before article requests; missing ratings remain unavailable. Invalid calendar headings are rejected. No access restriction observed. |
| Statcast | WORKING | Current published 2026 CSV collectors received 658 EV/expected rows and matched 618; sprint speed received 567 and matched 547. Forty EV/expected and twenty sprint rows remain safely unmatched under conservative MLBAM identity rules. Historical-season labels preserved; no parser repair needed. |
| RotoBaller | OFFSEASON UNAVAILABLE | Index HTTP success; no current-week Start/Sit article discovered for October 5-11. Existing stale-week gate remains intact. The bounded index inspection does not prove that no relevant article exists elsewhere. No access restriction observed. |
| Baseball Monster | REPAIRED | Source HTTP success. Real HTML omits 58 row closing tags inside nested wrapper tables. Old parser retained two rows per table and raised incomplete-table ValueError. Repaired parser recovers and ranks all 30 teams in each table from the same cached response. Source rows show 162 games: these are source-published opponent Ease values, not future-week projections. Offseason UI excludes them from forward recommendations. |
| Fantasy Info Central | WORKING | Dated page HTTP success and 20 parsed matchup rows; published pipeline matched 17 target hitters. Existing ambiguous abbreviated-name rejection remains intact. Weekly display now uses the common snapshot freshness validator. |

The PL and FIC weekly display modules previously bypassed the shared 36-hour external-feed freshness gate. Both now validate snapshots before decoration. MLBAM identity adapters, 2027 partial scoring, historical 2026 ownership labels, page structure and filters were not changed. In-season rendering remains subject to verified source and week/date gates; offseason grids remain hidden, rather than displaying stale recommendations.

Tests: 69 Python and 41 Node tests passed in one local run. Added regressions for relative PL URLs, foreign-host rejection, stale article request suppression, invalid dates and Baseball Monster optional row tags/nested wrapper markup. Live in-season ratings cannot be verified during the current offseason window.
