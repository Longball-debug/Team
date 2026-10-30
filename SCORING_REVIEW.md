# LONGBALL 2027 scoring reconciliation - October 11, 2026

Reviewed repository head `8ae643faffb22fff56cb91c3161f0b4b59e2d8cf`. Step 4 changed no weights; Step 5 updates supported categories as detailed below.

## Authoritative evidence

Read-only authenticated `getLeagues` identifies `gxq8uqpqmg5m5edj` as LONGBALL 2026 and `n81gfju2muo8y07b` as LONGBALL 2027. The website collector/workflow still selects the 2026 ID. `getLeagueInfo` for the 2027 ID returned scoringSystem.scoringCategories and scoringCategorySettings.configs; their weights agree. Credentials and raw league payloads are not published.

The complete earlier written project plan is a proposal/history, not proof of configured weights. This review supersedes the previous inference that IP +3, hits -0.75, walks -1 and separate SV +4/HLD +3 were current Fantrax settings. They are not configured in the verified 2027 league.

| Group | Category | Written plan | Fantrax 2027 configured | Calculator |
|---|---|---|---|---|
| HITTING | BB | 1 | Default: 1 | 1 |
| HITTING | IBB | 1 | Default: 1 | 1 |
| HITTING | HR | 5 | Default: 5 | 5 |
| HITTING | CYC | 5 | Default: 5 | Omitted |
| HITTING | GIDP | -2 | Default: -2 | -2 |
| HITTING | SB | 3 | Default: 3 | 3 |
| HITTING | 3B | 3 | Default: 4 | 4 |
| HITTING | CS | -2 | Default: -2 | -2 |
| HITTING | 2B | 3 | Default: 3 | 3 |
| HITTING | 1B | 1.5 | Default: 1.5 | 1.5 |
| HITTING | R | 1 | Default: 1 | 1 |
| HITTING | SF | 1 | Default: 1 | 1 |
| HITTING | PKO | -1 | Default: -1 | Omitted |
| HITTING | SH | 1 | Default: 1 | 1 |
| HITTING | HBP | 1 | Default: 1 | 1 |
| HITTING | RBI | 2 | Default: 2 | 2 |
| HITTING | SO | -0.5 | Default: -0.5 | -0.5 |
| PITCHING | BB | -1 | Default: -0.5 | -0.5 |
| PITCHING | QS | 5 | Default: 5 | 5 |
| PITCHING | CG | 2 | Default: 2 | 2 |
| PITCHING | SVH | Separate SV +4 / HLD +3 | Default: 5 | SV +5 plus HLD +5 |
| PITCHING | IP | 3 | Default: 2 | 2 |
| PITCHING | H | -0.75 | Default: -0.5 | -0.5 |
| PITCHING | HR | -2 | Default: -2 | -2 |
| PITCHING | K | 1.5 | Default: 1.5 | 1.5 |
| PITCHING | L | SP -5 / RP -2 | Default: -5, RP: -2 | Actual game role: SP -5 / RP -2 |
| PITCHING | ER | -2 | Default: -2 | -2 |
| PITCHING | BS | -3 | Default: -3 | -3 |
| PITCHING | PKO | 1 | Default: 1 | 1 |
| PITCHING | W | SP +5 / RP +2 | Default: 5, RP: 2 | Actual game role: SP +5 / RP +2 |
| PITCHING | HB | -1 | Default: -1 | -1 |
| PITCHING | NH | 5 | Default: 5 | Solo game log +5; aggregate unavailable |
| PITCHING | SHO | 2 | Default: 2 | 2 |

## Confirmed gaps and impact

- Triples: corrected from +3 to configured +4 in Step 5.
- Hitting CYC +5 and PKO -1 and pitching NH +5 remain omitted. Step 5 implements supported IBB, CG, HB, HR allowed, pitching PKO and SHO using verified cumulative settings and MLB fields.
- Fantrax expresses W/L as Default +5/-5 with RP +2/-2 overrides, not an explicit SP entry. The calculators apply overrides by actual MLB appearance role. Whether Fantrax applies them by lineup slot, eligibility or appearance role remains unverified.
- Fantrax uses combined SVH +5. The calculator adds saves and holds separately at +5 each; confirm the combined category definition, especially whether one appearance can count both.
- Aggregate QS depends on the MLB qualityStarts field; missing fields default to zero. Game logs derive QS from starts, innings and earned runs. Source coverage for omitted categories is not yet established.
- The 2026 league is different: HR +4, CS -1, hitter SO -1, and no RP W/L override. Current calculated hitter HR +5/CS -2/SO -0.5 and RP decisions do not reproduce that league. Do not relabel the 2026 feed as 2027 or switch IDs without owner direction.
- Affected outputs: calculated 14D/7D/30D points and FP/G, pitcher last-three points, trends, Free Agent signals/vs Rats comparisons, and Player Lab rankings/comparisons. ERA/WHIP and raw Statcast metrics do not depend on these weights.

## Decisions required

Confirm whether the product should evaluate the existing 2026 roster under configured 2027 rules or move to the separate 2027 league, and whether the historical written proposal should replace the current Fantrax configuration. Verify RP override and cumulative minor-category semantics. All configured numeric weights above were retrieved; these behavior/intent questions remain unresolved. No guessed settings, transactions or scoring updates were made.


## Step 5 alignment

Owner confirmed 2027 is primary and configured Fantrax 2027 settings govern. Read-only readiness inspection found all 12 teams and 10,615 eligibility-bearing pool entries. Pool validation passed with 10,362 free agents, 248 other-team players, 5 Desert Rats players and 5 unknown entries. Desert Rats, Newberry and Midland each have five players. The 2026 historical collector is retained until a complete useful 2027 replacement exists; it is explicitly labeled historical and never merged with 2027 ownership.

Triples now score +4. IBB +1 is additive: Fantrax BB and IBB both have cumulative=true, and official MLB season statistics expose baseOnBalls and intentionalWalks. Pitching CG +2, HB -1, HR allowed -2, PKO +1 and SHO +2 are additive in Fantrax and official MLB game statistics expose completeGames, hitBatsmen, homeRuns, pickoffs and shutouts. Both pitching calculators now use those fields. Updated terms contribute only source-reported values; missing source coverage remains a limitation, not proof of zero events.

Cycles, hitter picked-off penalties and no-hitter bonuses remain omitted because reliable matching source fields were not verified. Aggregate QS source coverage also remains unresolved. W/L override values are verified, but Fantrax's RP application semantics (appearance versus lineup slot) remain unverified. SVH is configured +5 and cumulative=true; exact combined-category event treatment remains unverified, so the existing saves-plus-holds calculation is retained and marked partial. No guessed bonuses or league-switch occurred. All calculated trends, rankings and comparisons consume the same refreshed 7/14/30-day scoring values; MLB season metrics and Statcast remain explicitly 2026 historical statistics.


## Authenticated scoring verification - October 11, 2026

Current baseline ada9e20192531411b3c67b9d7a689bed2c8ddf5c. Read-only getLeagueInfo confirms 2027 season dates March 24-September 5, 2027. Existing roster responses contain only player ID, position and status; no applied category points. There are no played 2027 season scoring examples available through this collector.

RP: configured W/L Default +5/-5 and Relief Pitcher +2/-2 are confirmed. The official league rules page also states "Score Flex positions by the players' actual positions: No". This makes the calculators' MLB-appearance-role assumption unsafe to call verified. Applied slot/eligibility behavior for dual-eligible pitchers and P flex slots still needs a Fantrax breakdown or explicit documentation. No role formula was changed by guessing.

SVH: the configured category is INDIVIDUAL_SAVES_PLUS_HOLDS, named Saves + Holds, cumulative=true, +5. The existing formula 5*(saves+holds) matches the configured category and MLB's standard events: a pitcher cannot earn both a save and a hold in one game; multiple different pitchers may earn holds. No capped one-per-team/game interpretation is supported. Configuration/formula consistency is confirmed; empirical reconciliation of Fantrax versus MLB's holds provider remains unavailable.

Source coverage inspected directly for Harper and Civale: MLB season, gameLog and byDateRange responses had no direct cycle, hitter-pickedOff, noHitters or qualityStarts fields. Pitcher pickoffs is a distinct pitcher-side counter and cannot substitute for a hitter-picked-off event. Cycles can be established from a complete single-game single/double/triple/HR line, but aggregate hit totals cannot establish cycles. Aggregate QS must be summed from complete game-level starts; aggregate IP/ER alone cannot prove it.

One proven correction: the game-log scorer omitted the configured +5 solo no-hitter bonus. MLB's official game 746679 identifies Blake Snell's August 2, 2024 outing as a no-hitter; API line has gamesPlayed=1, gamesStarted=1, inningsPitched=9.0, hits=0, completeGames=1. It now earns +5 in addition to existing cumulative CG/SHO/QS terms. Under the configured partial model the fixture changes 47 to 52 points. This is a historical replay, not a claim of actual Fantrax 2027 points. Shortened hitless games, relief contributions to combined no-hitters and incomplete source data do not receive an invented bonus. Aggregate NH remains unavailable.

Authoritative references:
- https://www.fantrax.com/newui/fantasy/leagueRulesSummary.go?leagueId=n81gfju2muo8y07b
- https://www.mlb.com/glossary/standard-stats/hold
- https://www.mlb.com/glossary/standard-stats/quality-start
- https://www.mlb.com/news/no-hitters-fewer-than-9-innings
- https://www.mlb.com/stories/game/746679
- https://statsapi.mlb.com/api/v1/people/605483/stats?stats=gameLog&group=pitching&season=2024&startDate=2024-08-02&endDate=2024-08-02

No Fantrax setting, roster ownership or active website league changed. Remaining exact-scoring limitations are slot-specific W/L application, source-provider SVH reconciliation, cycles/hitter pickoffs, aggregate NH and QS coverage. Current calculations remain explicitly partial and withhold missing supported events.

## October 30, 2026 direct re-verification

Read-only `getLeagueInfo` for `n81gfju2muo8y07b` again returned the complete configured categories and cumulative settings. They match `public/scoring-model.json`, including pitching HR -2, SHO +2, K +1.5, SVH +5 and W/L RP +2/-2. No WP, BK or perfect-game category is configured. The complete normalized-event engine now covers every configured category and rejects missing event counts/decision roles; the MLB adapters remain partial where their source cannot establish those events. A cycle can be derived only from a complete single-game hit-type line. Aggregate totals cannot establish it. No applied Fantrax scoring result was invented.
