# Player identity repair - October 11, 2026

Starting revision: d69f81130395d621f21b5bcf2d9de64abf9f1b6d.

Fantrax catalogue exposes statsIncId, rotowireId and sportRadarId, not MLBAM. These namespaces are not interchangeable. The official MLB season catalogue with hydrated currentTeam plus official MLB team abbreviations supports a conservative crosswalk: full normalized name with suffix retained and team must be unique in both catalogues. No identity is established from an ambiguous name alone. Team aliases are standardized. Unknown teams, conflicts and duplicates remain Not verified. This is a contextual initial link, not a vendor-provided direct ID crosswalk; traded/stale team evidence may withhold a valid player rather than guess.

Historical snapshot: 10,629 records; previous ambiguity count 220 records across 100 name/role groups. Current catalogue check establishes 1,422 MLBAM IDs; 22 of those previously ambiguous records resolve and 198 remain unresolved. Across the entire pool 9,207 records remain unverified, including minor-league and inactive players absent from the season MLB catalogue. These counts refer to identity, not the number of players with recent games.

Examples: Harper 01fh9 -> 547180; Civale 041qr -> 650644; Dodgers Muncy 02mzg -> 571970; Athletics Muncy 05t9l -> 691777; Cleveland Ramirez 01ub6 -> 608070; Cleveland Allen 05jp3 -> 671106. Unknown-team Allen and unsupported Ramirez namesakes are withheld.

Pipeline establishes IDs before MLB statistics and Statcast attachments. Recent 14-day and Player Lab season/7/30-day maps retain separate records by MLBAM ID even when names collide. Pitcher logs use the roster Fantrax ID to retrieve the pool MLBAM ID. Statcast adapters prioritize the canonical ID, cannot override a conflicting ID using a name, and withhold known unresolved identities. Player Lab displays Not verified when identity is unresolved. Existing isolated legacy adapter fixtures retain unique-name fallback; the production pipeline explicitly marks every pool identity and does not use that fallback for unresolved records.

Historical 2026 ownership/data labels and configured partial 2027 scoring are preserved. No ownership or league switch occurred. Safe future work: obtain an authoritative Fantrax vendor-to-MLBAM crosswalk for the unresolved records rather than relaxing uniqueness checks.
