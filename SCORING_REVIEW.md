# LONGBALL 2027 scoring reconciliation - October 11, 2026

Reviewed repository head `8ae643faffb22fff56cb91c3161f0b4b59e2d8cf`. No scoring weights changed.

## Authoritative evidence

Read-only authenticated `getLeagues` identifies `gxq8uqpqmg5m5edj` as LONGBALL 2026 and `n81gfju2muo8y07b` as LONGBALL 2027. The website collector/workflow still selects the 2026 ID. `getLeagueInfo` for the 2027 ID returned scoringSystem.scoringCategories and scoringCategorySettings.configs; their weights agree. Credentials and raw league payloads are not published.

The complete earlier written project plan is a proposal/history, not proof of configured weights. This review supersedes the previous inference that IP +3, hits -0.75, walks -1 and separate SV +4/HLD +3 were current Fantrax settings. They are not configured in the verified 2027 league.

| Group | Category | Written plan | Fantrax 2027 configured | Calculator |
|---|---|---|---|---|
| HITTING | BB | 1 | Default: 1 | 1 |
| HITTING | IBB | 1 | Default: 1 | Omitted |
| HITTING | HR | 5 | Default: 5 | 5 |
| HITTING | CYC | 5 | Default: 5 | Omitted |
| HITTING | GIDP | -2 | Default: -2 | -2 |
| HITTING | SB | 3 | Default: 3 | 3 |
| HITTING | 3B | 3 | Default: 4 | 3 |
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
| PITCHING | CG | 2 | Default: 2 | Omitted |
| PITCHING | SVH | Separate SV +4 / HLD +3 | Default: 5 | SV +5 plus HLD +5 |
| PITCHING | IP | 3 | Default: 2 | 2 |
| PITCHING | H | -0.75 | Default: -0.5 | -0.5 |
| PITCHING | HR | -2 | Default: -2 | Omitted |
| PITCHING | K | 1.5 | Default: 1.5 | 1.5 |
| PITCHING | L | SP -5 / RP -2 | Default: -5, RP: -2 | Actual game role: SP -5 / RP -2 |
| PITCHING | ER | -2 | Default: -2 | -2 |
| PITCHING | BS | -3 | Default: -3 | -3 |
| PITCHING | PKO | 1 | Default: 1 | Omitted |
| PITCHING | W | SP +5 / RP +2 | Default: 5, RP: 2 | Actual game role: SP +5 / RP +2 |
| PITCHING | HB | -1 | Default: -1 | Omitted |
| PITCHING | NH | 5 | Default: 5 | Omitted |
| PITCHING | SHO | 2 | Default: 2 | Omitted |

## Confirmed gaps and impact

- Triples: calculator +3 versus configured +4, so it undercounts one point per triple under 2027 settings.
- Hitting CYC +5, IBB +1 and PKO -1 are omitted. Pitching CG +2, HB -1, HR -2, NH +5, PKO +1 and SHO +2 are omitted. Whether BB includes IBB and the exact cumulative scoring semantics need reconciliation before adding categories.
- Fantrax expresses W/L as Default +5/-5 with RP +2/-2 overrides, not an explicit SP entry. The calculators apply overrides by actual MLB appearance role. Whether Fantrax applies them by lineup slot, eligibility or appearance role remains unverified.
- Fantrax uses combined SVH +5. The calculator adds saves and holds separately at +5 each; confirm the combined category definition, especially whether one appearance can count both.
- Aggregate QS depends on the MLB qualityStarts field; missing fields default to zero. Game logs derive QS from starts, innings and earned runs. Source coverage for omitted categories is not yet established.
- The 2026 league is different: HR +4, CS -1, hitter SO -1, and no RP W/L override. Current calculated hitter HR +5/CS -2/SO -0.5 and RP decisions do not reproduce that league. Do not relabel the 2026 feed as 2027 or switch IDs without owner direction.
- Affected outputs: calculated 14D/7D/30D points and FP/G, pitcher last-three points, trends, Free Agent signals/vs Rats comparisons, and Player Lab rankings/comparisons. ERA/WHIP and raw Statcast metrics do not depend on these weights.

## Decisions required

Confirm whether the product should evaluate the existing 2026 roster under configured 2027 rules or move to the separate 2027 league, and whether the historical written proposal should replace the current Fantrax configuration. Verify RP override and cumulative minor-category semantics. All configured numeric weights above were retrieved; these behavior/intent questions remain unresolved. No guessed settings, transactions or scoring updates were made.
