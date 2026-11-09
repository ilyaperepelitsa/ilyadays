# Fitness plans

One plan per work stream. `00-master-plan.md` is the contract: when a stream plan disagrees with it, the master
plan wins. Research files under `research/` are the evidence the plans cite.

| Plan | Stream | What it covers |
| --- | --- | --- |
| [00-master-plan.md](00-master-plan.md) | master | Product rules, routes, file ownership, data model, store and engine contracts, registry, orchestration, decisions |
| [01-database-and-sync.md](01-database-and-sync.md) | 01 | Supabase schema and RLS, local-first store, outbox sync, modes (local / synced / viewer), owner setup steps |
| [02-exercise-catalog-and-alternatives.md](02-exercise-catalog-and-alternatives.md) | 02 | 138 exercises, muscles, equivalence classes, alternatives, muscle map, exercise pages |
| [03-program-engine-and-progression.md](03-program-engine-and-progression.md) | 03 | Goal modes, templates (3-day owner program, 2-day, 4-day, legs add-on), progression, warm-ups, session planning |
| [04-session-tracker-ui.md](04-session-tracker-ui.md) | 04 | The gym screen: start, one-tap sets, steppers, rest timer, swaps, end, summary; the fitness home page |
| [05-gym-profiles.md](05-gym-profiles.md) | 05 | Gyms, available equipment, preferred substitutes, increments |
| [06-progress-analytics.md](06-progress-analytics.md) | 06 | e1RM, volume, body-weight trend, Theil–Sen, Banister, ACWR, charts |
| [07-diagrams-and-image-generation.md](07-diagrams-and-image-generation.md) | 07 | Image style, pipeline, budget (≤ $20), naming contract |
| [08-science-content.md](08-science-content.md) | 08 | Science explainers (EN/RU), markdown renderer, safety content |
| [09-nutrition.md](09-nutrition.md) | 09 | Energy and protein calculators, food table, heart-rate zones, VO2max field tests |
| [10-ai-advisor.md](10-ai-advisor.md) | 10 | Program editor and the OpenAI plan advisor (structured output, review before apply) |
| [11-profiles-and-multi-user.md](11-profiles-and-multi-user.md) | 11 | Friends with their own plans (later) |
| [12-qa-and-launch.md](12-qa-and-launch.md) | 12 | Checks, SQL check, phone pass, modes, publishing |
| [13-calculators.md](13-calculators.md) | master | `/fitness/tools`: one-rep max and load table from any set (rounded to the machine), assisted maths, warm-up, plates per side |

## Research

| File | Topic |
| --- | --- |
| [research/01-goals-and-programming.md](research/01-goals-and-programming.md) | Training variables by goal; mode conversion |
| [research/02-progression-algorithms.md](research/02-progression-algorithms.md) | Progression algorithms; the owner's rule set |
| [research/03-injury-prevention-warmup-technique.md](research/03-injury-prevention-warmup-technique.md) | Injury prevention, warm-up, pain rules, technique |
| [research/04-exercise-and-machine-catalog.partial.md](research/04-exercise-and-machine-catalog.partial.md) | Exercise classes, increments, machine lines, strength standards |
| [research/05-longevity-bone-vo2max.md](research/05-longevity-bone-vo2max.md) | Bone density, VO2max, grip, minimal doses |
| [research/06-nutrition-recomposition.md](research/06-nutrition-recomposition.md) | Protein, deficits, recomposition; food table draft |
| [research/07-analytics-and-models.md](research/07-analytics-and-models.md) | e1RM, EWMA, Theil–Sen, Banister, ACWR |
| [research/08-app-ux-survey.md](research/08-app-ux-survey.md) | What the best logging apps do, the fewest-taps spec |

## Tools

```bash
node scripts/fitness-catalog-merge.mjs      # merge + validate content/fitness/exercises/<slice>.json
node scripts/fitness-image-index.mjs        # index generated diagrams into content/fitness/images.json
python3 scripts/fitness-images.py status    # image budget and counts (plan / run / status)
bash scripts/fitness-sql-check.sh           # migrations + 30 RLS checks on a throwaway Postgres 17
/Users/ilyaperepelitsa/miniforge3/bin/python scripts/fitness-qa.py --base http://localhost:3123 --dark   # browser sweep
```
