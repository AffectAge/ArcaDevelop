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


## Phased Implementation Plan

The AI roadmap is split into narrow phases so each step can be reviewed and verified independently. Do not skip the validation gate for a phase before starting the next one.

| Phase | Scope | Output | Required checks after the phase |
| --- | --- | --- | --- |
| 1 | Architecture, documentation, and scenario-owned config only. | AI runtime boundaries, define keys, and implementation notes without gameplay behavior changes. | `npm run typecheck -ws`, relevant unit tests, AI fixture tests when present, and `npm run docs:check`. |
| 2 | Context builder, indexes, and tests. | Deterministic per-country AI context derived from indexed region, economy, market, diplomacy, and military inputs. | Typecheck, context/index unit tests, AI fixture tests, and docs check. |
| 3 | Economy MVP with build/upgrade orders. | AI selects player-equivalent build and upgrade orders through the validated order pipeline. | Typecheck, economy/build order unit tests, AI fixture tests, and docs check. |
| 4 | Market and import logic. | AI evaluates shortages/surpluses and uses legal market/import actions without direct state mutation. | Typecheck, market/import unit tests, AI fixture tests, and docs check. |
| 5 | Strategy and personality. | Scenario archetypes, personalities, and strategies alter weights without bypassing legality filters. | Typecheck, merge/scoring unit tests, AI fixture tests, and docs check. |
| 6 | Crisis mode. | AI detects bounded crisis conditions and shifts priorities using explicit scenario config. | Typecheck, crisis unit tests, AI fixture tests, and docs check. |
| 7 | Diplomacy and military expansion. | AI proposes diplomacy and military orders through the normal validated order pipeline. | Typecheck, diplomacy/military unit tests, AI fixture tests, and docs check. |

Phase 1 may add or document config keys, but must not create new AI gameplay decisions. Phase 2 adds deterministic context builders, indexes, and fixture harnesses; it still must not create gameplay AI decisions or orders. Later phases must keep all costs, limits, budgets, and bonuses in scenario-owned defines or AI profile files.

## Scenario Defines

Scenario authors may tune AI execution budget in `common/defines.json`:

```json
{
  "ai": {
    "enabled": true,
    "maxCountriesPerTick": 50,
    "maxDecisionCandidatesPerCountry": 20,
    "contextCacheTtlTurns": 1,
    "maxBuildCompletionTurns": 8
  }
}
```

These keys control runtime budget, cache behavior, and conservative candidate filtering only. `maxBuildCompletionTurns` limits new build candidates to projects that the country can finish with its current construction points within that many turns; AI profile fragments may override it per country style. These keys do not grant AI bonuses, hidden information, or permission to mutate world state directly. Invalid values must fail scenario validation/application instead of falling back silently.


## Context Builder And Indexes

The Phase 2 context layer derives per-country AI inputs from a `WorldBase` snapshot without mutating the world and without generating orders. AI ticks should build world indexes once per snapshot, then pass those indexes into each country context build instead of rescanning the whole world for every country.

The current context includes owned/controlled region ids, compact region summaries, construction-project counts, diplomacy-proposal counts, division counts, and current resources. Landless countries must produce valid empty region contexts.


## Economy Candidate MVP

The Phase 3 economy MVP derives deterministic build and upgrade candidates from the Phase 2 country context. It is still read-only: candidate selection must not mutate `WorldBase`, submit orders automatically, or bypass existing player-equivalent validation.

Build candidates carry a `BUILD` order draft with a state owner payload; the runtime integration layer must add the authoritative turn/player envelope before submission. Upgrade candidates carry the existing `/country/build/upgrade-state` request body because upgrade-state is currently an HTTP route flow rather than a shared turn order. Later integration work must submit or adapt these candidates through the same server validation used by players before changing world state.

The MVP filters candidates by region control, building country rules, unlock callbacks, region build restrictions, country/global build limits, duplicate queued build projects in the same region, available ducats, current construction capacity, profile/scenario `maxBuildCompletionTurns`, max upgrade level, duplicate queued upgrades, and available ducats for upgrade requests. Candidate ordering is stable and deterministic; it is not a personality or strategy scorer.


## Market Import Candidate MVP

The Phase 4 market/import MVP derives deterministic import candidates from market shortage and surplus history. It is read-only: it must not mutate market state, submit trade actions, edit policies, or bypass existing market sanctions/policy validation.

Import candidates compare a country's assigned market against other markets for tradeable goods only. They estimate target-market shortage, source-market available surplus, current source price, and the amount allowed by import/export policy caps. Service and local-only goods are ignored because they are not world-import candidates.

This layer is a candidate finder, not a market execution engine. Later integration work must route any chosen import/policy action through the same server-side validation players or admins use.


## Strategy And Personality Scoring

The Phase 5 strategy/personality layer merges scenario-authored archetype, personality, strategy, and country-specific profile fragments in order. Later fragments override or extend earlier fragments, so scenarios can provide broad defaults and then specialize individual countries without code changes.

Scoring applies weights to already-legal candidates only. It must not make illegal candidates legal, mutate candidates, submit orders, or bypass rule filters. The current scorer supports base weights for build, upgrade, market-import, diplomacy-contact, and army-move candidates plus optional building, good, and region weights where applicable. Tie-breaking is deterministic by candidate identity.


## Crisis Mode Assessment

The Phase 6 crisis layer detects bounded, config-driven crisis signals from already-derived AI context and market candidates. It is read-only: it must not mutate world state, enqueue orders, or override legality filters.

Crisis config can enable treasury, landless, and market-shortage signals. A crisis becomes active only when at least one signal is critical. Active crises may return an explicit priority profile fragment that later scoring can merge after normal personality/strategy profiles. Warning-only signals are reported for diagnostics but do not activate crisis priority overrides.

## Diplomacy And Military Candidate MVP

The Phase 7 diplomacy/military MVP derives bounded, deterministic diplomacy contact and army movement candidates from the existing AI context and world snapshot. It is read-only: it must not mutate diplomacy proposals, move divisions, start wars, transfer regions, or submit orders directly.

Diplomacy candidates are limited to countries without an active pending/renewal proposal between the same pair and carry the `/diplomacy/proposals` request shape for later server validation. Military candidates only draft adjacent, same-country land repositioning `ARMY_MOVE` orders for idle, organized divisions; they deliberately avoid hostile movement or conquest logic until later war integration can route those decisions through normal validation and visibility rules. Each Phase 7 candidate carries an explicit validated-pipeline marker so runtime integration treats the output as a draft, not as permission to mutate world state.

## Runtime Planner Integration

After Phase 7, AI runtime work starts with a read-only planner rather than direct execution. The planner builds world indexes once, applies scenario AI budgets, builds bounded country contexts, gathers deterministic candidates, scores them with strategy profiles, and returns selected draft actions. It must not submit orders, call route handlers, mutate `WorldBase`, or treat candidate drafts as validated actions.

Future executor work must consume planner output through normal server validation paths only. Start with one safe economy order slice before expanding to route-backed upgrade, diplomacy, market, or military execution. See `docs/adr/ADR-0004-ai-runtime-planner.md` for the planner/executor split.

## Validated Order Draft Adapter

The first executor-facing integration slice converts selected economy `build` candidates into normal `BUILD` order drafts with an AI player id envelope. This adapter is still not an executor: it does not call turn resolvers, route handlers, persistence, or mutation code. Future runtime execution must pass these drafts into the same validated order pipeline used for player orders and must report any rejected AI submissions. The draft submission seam is injected so tests and runtime adapters can prove accepted/rejected outcomes without letting the AI module call mutation code directly. The first bridge converts AI drafts to standard `ORDER_DELTA` messages, allowing a runtime adapter to call the existing order-delta validation path instead of adding AI-specific validation. The websocket runtime exposes `submitOrderDeltaToRuntime` as the reusable server-side validation/submission seam for that bridge, plus `submitAiOrderDeltaToRuntime` as the internal AI wrapper that uses the draft order player/country envelope as the synthetic AI submission context.

## Build Order Runtime Coordinator

The first guarded runtime coordinator runs the safe build-order slice only: planner, build-order draft adapter, `ORDER_DELTA` bridge, and injected order-delta submitter. The turn runtime exposes an optional before-resolve AI hook and calls it only when `gameSettings.ai.enabled` is true; deployments must still provide the hook explicitly, so AI execution remains feature-guarded instead of automatic by default. The hook receives the current turn id and resolved AI settings so the runtime can select a bounded country batch before normal turn resolution. Runtime wiring must keep `gameSettings.ai.enabled` as the guard and must preserve rejected submission diagnostics. The runtime coordinator helper adapts `submitAiOrderDeltaToRuntime` errors into AI submission results, keeps the first error code as the compatibility rejection reason, and preserves the full runtime error list for future admin-only diagnostics.

## Colonization Candidate And Runtime Slice

The colonization slice adds profile-driven `COLONIZE` and colonizer `UNIT_MOVE` order drafts to the guarded AI runtime coordinator. It does not add a new protocol or mutate world state directly; selected candidates become normal `ORDER_DELTA` submissions and the existing server validation enforces neutral regions, disabled-region rules, duplicate queues, active-colonization limits, current turn, country resources, unit ownership, and movement legality.

Colonization candidates are region-first. Landless AI countries may consider any neutral colonizable region, then strategy `colonization` weight and `regionWeights` decide whether that first target beats economy or other candidates. AI countries that already own or control regions only consider neutral regions adjacent to those regions, using a region-adjacency index derived from province neighbors once per AI cycle.

If an idle colonizer already stands on a valid neutral settlement target, the AI prefers a `COLONIZE` draft. If no ready target exists, idle uncaptured colonizers can plan a deterministic land route to the nearest valid neutral settlement hex and submit a normal `UNIT_MOVE` draft. Colonizers that already have a movement target or path are left alone so the runtime movement system can continue the current route. If no usable colonizer exists and the country passes resource and queue filters, the AI may queue a new colonizer.

When a colonization capture succeeds, empty captured regions may receive scenario-defined starter settlers through the normal region population state. This is controlled by `colonization.settlementEnabled` and `colonization.settlementPopulationOnCapture`; it does not create province-level population and does not change the AI order pipeline.

The selector filters owned, disabled, already-progressing, active, queued, over-limit, and resource-poor targets before scoring. Candidate ordering is deterministic by point cost, ducat cost, and region id; scoring can still override between candidate kinds through the scenario-authored profile stack.
