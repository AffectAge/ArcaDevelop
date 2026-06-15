# Game AI Development

Game AI is scenario-driven and server-authoritative.

## Architecture

AI is hybrid:

- rule filters decide legal/available actions,
- utility scoring ranks allowed actions,
- long-term plans guide repeated choices,
- chosen actions become normal server-validated orders.

AI must not directly mutate world state to bypass player-equivalent validation.

## Config

AI config lives in:

```text
common/ai/
  archetypes/
  personalities/
  strategies/
```

Archetypes provide defaults. Personalities and country files can override weights.

Recommended weights:

- aggression,
- diplomacy,
- economy,
- colonization,
- military,
- risk,
- expansion,
- trade,
- technology,
- law preference.

## Fairness

Default AI rules:

- no cheats,
- no hidden information,
- same costs as players,
- same cooldowns and limits,
- same order validation,
- same permission rules.

Any AI bonuses must be explicit in scenario defines.

## Performance

Expected bot count is up to roughly 100-200 countries.

AI must:

- run in budgeted ticks,
- avoid repeated full-world scans,
- use indexes and cached scoring inputs,
- degrade decision quality rather than blocking turn resolve,
- keep interfaces compatible with future worker/service extraction.

## Visibility

Players see narrative outcomes:

- treaty offers,
- sanctions,
- mobilization,
- colonial interest,
- visible strategic posture.

Exact scores, rejected candidate actions, and debug reasoning are admin-only or test-only.

## Fallbacks

Do not hide broken AI config behind gameplay fallback. Technical safety defaults are allowed only when documented and reported.
