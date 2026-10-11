# LONGBALL 2027 scoring review — 2026-10-11

Reviewed source at 46d2fc383bb52ab6d351001c94e9443990e50efc. No weights changed.

The current repository's FANTASYGM_SPEC.md authoritatively documents only role-sensitive decisions: SP W/L +5/-5 and RP W/L +2/-2. Both calculators implement these values. Game logs use actual appearance role; aggregate windows with mixed roles and decisions return unavailable.

| Category | Implemented | Documentation comparison |
|---|---:|---|
| Single | +1.5 | Earlier project working rules agree; verify Fantrax |
| Double / Triple | +3 / +3 | Earlier working rules agree; verify Fantrax |
| Home run | +5 | Earlier working rules agree; verify Fantrax |
| RBI / Run | +2 / +1 | Earlier working rules agree; verify Fantrax |
| SB / CS | +3 / -2 | Earlier working rules agree; verify Fantrax |
| BB / HBP | +1 / +1 | Earlier working rules agree; verify Fantrax |
| Strikeout / GIDP | -0.5 / -2 | Earlier working rules agree; verify Fantrax |
| SF / SH | +1 / +1 | Earlier working rules agree; verify Fantrax |
| IP | +2 | Earlier working 2027 rules say +3; unresolved |
| Pitcher K / ER | +1.5 / -2 | Earlier working rules agree; verify Fantrax |
| Hit allowed | -0.5 | Earlier working 2027 rules say -0.75; unresolved |
| Walk allowed | -0.5 | Earlier working 2027 rules say -1; unresolved |
| Quality start | +5 | Working rules agree; aggregate calculator relies on MLB qualityStarts field |
| SP W/L | +5 / -5 | Matches current repository specification and requested rules |
| RP W/L | +2 / -2 | Matches current repository specification and requested rules |
| Save / Hold | +5 / +5 | Earlier working 2027 rules say +4 / +3; unresolved |
| Blown save | -3 | Earlier working rules agree; verify Fantrax |

Neither calculator implements earlier documented minor categories: cycle +5, intentional walk +1, picked off -1, complete game +2, pitcher HBP -1, HR allowed -2, no-hitter +5, pitching pickoff +1, shutout +2. Their active Fantrax configuration and whether IBB is separately additive require authenticated verification. Missing source fields currently default to zero; therefore these calculations must not be treated as a complete reconciliation against Fantrax points.

Sources inspected: add_recent_14d_stats.py HIT/PIT and hitter_points/pitcher_points; mlb_pitcher_logs.py longball_points; add_player_lab_stats.py imports the aggregate scorer. Earlier project working rules are historical context, not proof of active Fantrax settings. Obtain a signed-in LONGBALL 2027 scoring export before changing unresolved values. Until then, rankings and comparisons based on calculated FP carry this unresolved scoring limitation.

