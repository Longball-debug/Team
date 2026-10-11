# Offseason accuracy and refresh - October 11, 2026

Starting head ee7a82652360b53f0ba115c053da727b2a228737.

Confirmed defect: scorer numeric helpers defaulted absent, blank and malformed statistics to zero. The scoring entry points now validate all supported source event fields before calculating. Explicit numeric zero is accepted; missing, blank, invalid, nonfinite and negative event counts withhold the calculated total. Baseball innings notation accepts only whole innings or .0/.1/.2. A pure-relief aggregate with explicit gamesStarted=0 cannot have a quality start; starter aggregates require a source qualityStarts value. Mixed-role aggregate decisions remain unverified.

MLB game logs calculate quality starts from verified appearance data; they do not require an aggregate QS field. Missing log events withhold FP while preserving source-reported raw statistics. Missing raw season counters/percentage inputs and game counts remain unavailable rather than zero. Daily null FP are displayed Not available and excluded from trend calculations. Hitter totals remain available only where all supported events exist. Aggregate pitching totals may now be unavailable where MLB omits QS or other fields; this is an accuracy correction, not proof of zero production.

All displayed FP/FP-G are partial configured-2027-model calculations, not exact Fantrax totals. Missing cycles, hitter pickoff events and no-hitter bonuses, plus unverified RP override/SVH semantics, remain limitations. Comparisons/filters/color heuristics are preserved and consume only available numeric totals. Historical 2026 ownership and MLB data are never merged with 2027 ownership.

All four reload buttons now say Reload Published Snapshot. Each page labels collection timestamp separately from browser load timestamp and explains that reload does not generate fresh data. Core refresh no longer overwrites independent FA/Lab timestamps. Dedicated Daily pitcher and Weekly source/summary modules reload when their page reload is requested. Cloud collection remains the existing scheduled/manual GitHub workflow; no new collection action was added.

Tests: 74 Python and 42 Node tests passed overall. Existing tests ran once; one incomplete scoring fixture was corrected and its focused test rerun. New tests verify missing/blank/nonfinite fields, explicit zero, QS coverage and null-versus-zero pitcher trends. Current launch blockers: complete 2027 rosters and deliberate activation, remaining exact scoring semantics/event coverage, unresolved identities and live in-season evidence.
