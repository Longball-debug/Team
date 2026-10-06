# FantasyGM2027 System Specification

## Purpose
FantasyGM2027 is the Desert Rats decision-support site for LONGBALL. Fantrax is the league source of truth. External sources may add context, but unverified external data must never silently replace Fantrax data or be presented as verified.

## Core pages
- Daily Command Center: current roster, daily hitter/pitcher context, verified trends and probable-start information.
- Weekly Outlook: seven-day hitter/pitcher schedule view and verified weekly context.
- Free Agent Board: available-player decision board using recent production, roster comparison, trend, schedule context and FIC where verified.
- Player Lab: deeper player-level research and verified external metrics.

## Data-source rules
1. Fantrax: ownership, roster, league availability, positions and league context.
2. MLB schedule / probable data: MLB schedule and probable-start context.
3. External analysis sources: Pitcher List, Baseball Monster, Fantasy Info Central, RotoBaller, Statcast/FanGraphs-derived inputs only when their adapter marks the data verified.
4. Missing external data must display as Not verified, Not rated, unavailable, or equivalent. Never infer a value merely to fill a cell.
5. Every externally derived dataset should retain a verification status and source date when available.

## UI ownership rule
Each table/body has exactly one renderer owner. No second module may write, clear, or re-render the same DOM target.

Current ownership:
- Free Agent Board `#fa-rows`: `public/fa-filters.mjs` only.
- Core Daily/Weekly tables: `public/website.mjs` unless a dedicated module explicitly owns that target.
- Player Lab enhanced behavior: `public/player-lab.mjs`.

Any new feature that needs an existing table must extend the owning module instead of adding another renderer.

## Free Agent Board
### Filters
- Player type: All players / Hitters / Pitchers
- Position: All, C, 1B, 2B, 3B, SS, OF, UT-only, SP, RP
- Activity: Recent MLB stats / All free agents / No recent stats
- Search by player, MLB team or position

### Enriched columns
Signal | Player | MLB | Pos | 14D Pts | 14D PPG | vs Rats | Trend | Next Wk | Wk +2 | FIC

### vs Rats
Compares a free agent's verified 14-day FP/G with the lowest verified Desert Rats 14-day FP/G among players sharing a usable position.

Color thresholds:
- Green: candidate is at least +1.00 FP/G better
- Yellow: within 1.00 FP/G
- Red: candidate is at least -1.00 FP/G worse
- Gray: insufficient verified comparison data

This is a recent-production comparison, not a projected roster-gain model.

### Trend
Uses verified 7-day and 30-day FP/G when enough games exist.
- Rising: 7D is at least 15% above 30D
- Falling: 7D is at least 15% below 30D
- Steady: between those thresholds
- Not enough data: insufficient verified sample

### LOOK / WATCH / PASS
Current heuristic:
- Top quartile 14D PPG among same-type available players: +2
- Bottom quartile: -2
- Rising/Falling trend: +1 / -1
- Easy/Tough next-week schedule: +1 / -1
- Easy/Tough week+2 schedule: +0.5 / -0.5
- Verified positive/negative FIC hitter context: +0.5 / -0.5
- LOOK: score >= 2
- PASS: score <= -2
- WATCH: otherwise

This is a decision signal, not a validated predictive model. Backtesting is required before treating it as predictive.

## Refresh behavior
- Free Agent Board refresh is owned by `public/fa-filters.mjs`.
- Core site refresh must not overwrite or clear `#fa-rows`.
- Filtering must preserve the enriched renderer; switching positions must never fall back to a legacy plain four-column list.
- Automatic/core refreshes must not create competing render paths for the same table.

## LONGBALL scoring guardrail
The scoring engine must use the current LONGBALL rules. Pitcher W/L scoring is role-sensitive:
- SP win +5, SP loss -5
- RP win +2, RP loss -2

Any future projection-to-points calculator must score W/L by actual game role, not merely by eligibility. SP/RP dual eligibility must not cause double interpretation.

## Player identity
Display names are not sufficient as durable join keys.
Target identity model:
1. Fantrax Player ID as league-side canonical identifier
2. MLBAM ID when available for MLB/external joins
3. Name matching only as a temporary fallback, with ambiguity detection

External adapters should move toward canonical IDs rather than direct `player.name` lookup.

## Offseason mode
When no active MLB regular-season schedule is available:
- Keep final/recent historical data clearly dated.
- Prefer roster, keeper, projection, trade and draft-prep information.
- Daily probable-pitcher and forward-week matchup cells should show unavailable/not verified rather than fabricate future context.
- A future UI pass may explicitly label OFFSEASON MODE and hide irrelevant in-season columns.

## Testing requirements
Before deployment, tests must cover:
- Snapshot/schema contract
- Daily trend/matchup logic
- Weekly source adapters
- UI ownership regression
- Free Agent Board must retain enriched columns after filter changes and refresh
- Missing/stale external sources must fail closed to Not verified / unavailable
- Role-sensitive SP/RP scoring when projection scoring is introduced

## Change-control rule
Do not add a new metric or data source unless it changes a real roster, start/sit, add/drop, trade, keeper or draft decision. Prefer removing duplicate logic over adding parallel logic.
