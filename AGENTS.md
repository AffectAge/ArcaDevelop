# Arcanorum Agent Guide

This is the mandatory entrypoint for AI agents working on Arcanorum.

## Project Direction

Arcanorum is a single-world online grand strategy game designed to grow toward thousands of players. The world model is Victoria-inspired:

- Provinces are lightweight map and movement units.
- State regions are the main gameplay units for heavy mechanics.
- Scenarios own their countries, regions, content, AI profiles, localization, Arcawiki, theme, defines, and assets.
- The server is authoritative. The client may request actions, but the server validates everything.

## Required Workflow

Before editing, restate the task, list relevant agent guides/docs, and wait for explicit user confirmation when the task is ambiguous, destructive, or changes gameplay architecture. For straightforward documentation implementation already requested by the user, proceed with narrowly scoped edits.

Read all relevant `AGENTS.md` files:

- `apps/server/AGENTS.md` for runtime, mechanics, scenarios, AI, permissions, uploads, persistence, and WS/API.
- `apps/server/src/app/AGENTS.md` for Express app creation, global middleware, and static serving.
- `apps/server/src/mechanics/AGENTS.md` for server gameplay/domain mechanics modules.
- `apps/server/src/runtime/AGENTS.md` for runtime primitives and orchestration helpers.
- `apps/server/src/routes/AGENTS.md` for Express route modules and route registration.
- `apps/server/src/uploads/AGENTS.md` for server upload paths, ownership, validation, and cleanup rules.
- `apps/client/AGENTS.md` for UI, map, localization, Arcawiki, admin controls, and player-facing clarity.
- `packages/shared/AGENTS.md` for contracts, `WorldBase`, orders, and delta protocol.
- `apps/server/data/AGENTS.md` for scenario files, region history, content, AI profiles, defines, and assets.

Read relevant handbook docs before changing a system:

- `docs/README.md` for the documentation map.
- `docs/agent-start-checklist.md` before implementation work.
- `docs/task-routing.md` for task-to-doc routing.
- `docs/templates/` for task, ADR, new-folder, and final-report templates.
- `.codex/project-rules.json` for machine-readable routing, required docs, templates, and forbidden patterns.
- `docs/docs-maintenance.md` and `docs/glossary.md` when adding docs or new terms.
- `docs/programming-standards.md`, `docs/engineering-standards.md`, `docs/folder-structure.md`, `docs/refactoring-plan.md`, and `docs/naming-and-abstractions.md` for code structure, folders, phased refactors, functions, naming, typing, async, state, errors, tests, and configuration.
- `docs/ai-operating-boundaries.md` for AI-agent prohibitions and reporting rules.
- `docs/commands.md` for available commands and missing future command expectations.
- `docs/testing-strategy.md` for test layer expectations.
- `docs/definition-of-done.md` before finalizing implementation work.
- `docs/security-baseline.md` and `docs/secrets-policy.md` for auth, safety, uploads, logs, and sensitive data.
- `docs/api-ws-versioning.md` and `docs/error-codes.md` for protocol, delta, and error changes.
- `docs/permissions.md`, `docs/audit-log.md`, and `docs/rate-limits.md` for privileged or abuse-prone actions.
- `docs/concurrency.md`, `docs/observability.md`, and `docs/performance-budgets.md` for mutating or hot-path systems.
- `docs/data-deletion-lifecycle.md` and `docs/entity-ownership.md` for entity deletion, cleanup, and orphan prevention.
- `docs/localization.md` and `docs/theme-system.md` for UI text and visual design.
- `docs/modding-authoring.md` and `docs/libraries.md` for scenario authoring and dependencies.
- `docs/review-checklist.md` when reviewing or auditing changes.
- `docs/adr/README.md` for major architecture decisions.

Use templates when they match the task:

- `docs/templates/mechanic-change.md`
- `docs/templates/api-change.md`
- `docs/templates/ui-change.md`
- `docs/templates/new-folder-proposal.md`
- `docs/templates/adr.md`
- `docs/templates/final-report.md`
- `docs/templates/bug-fix.md`
- `docs/templates/refactor.md`
- `docs/templates/scenario-change.md`
- `docs/templates/data-migration-removal.md`
- `docs/templates/security-change.md`
- `docs/templates/performance-change.md`
- `docs/templates/test-plan.md`
- `docs/templates/arcawiki-update.md`
- `docs/templates/dependency-request.md`
- `docs/templates/cleanup-lifecycle.md`
- `docs/templates/database-change.md`
- `docs/templates/ws-delta-change.md`
- `docs/templates/localization-change.md`
- `docs/templates/theme-change.md`
- `docs/templates/ai-behavior-change.md`
- `docs/templates/release-checklist.md`

## Task Classification

Use this routing before work. `docs/task-routing.md` is the standalone source for the same routing rules.

| Task type | Required guides |
| --- | --- |
| UI, modals, HUD, Arcawiki | `apps/client/AGENTS.md`, `docs/programming-standards.md`, `docs/accessibility.md`, `docs/engineering-standards.md` |
| Map or movement | `apps/client/AGENTS.md`, `apps/server/AGENTS.md`, `docs/regions-and-provinces.md`, `docs/performance-budgets.md` |
| Game mechanic | `apps/server/AGENTS.md`, `apps/server/src/mechanics/AGENTS.md`, `packages/shared/AGENTS.md`, `docs/world-model.md`, `docs/testing-strategy.md`, `docs/definition-of-done.md` |
| Region/scenario data | `apps/server/data/AGENTS.md`, `docs/scenario-region-history.md`, `docs/modding-authoring.md`, `docs/data-deletion-lifecycle.md` |
| API/WS/shared contract | `packages/shared/AGENTS.md`, `apps/server/AGENTS.md`, `apps/client/AGENTS.md`, `docs/api-ws-versioning.md`, `docs/error-codes.md` |
| Server app/middleware/routes | `apps/server/AGENTS.md`, `apps/server/src/app/AGENTS.md`, `apps/server/src/routes/AGENTS.md`, `docs/security-baseline.md`, `docs/api-ws-versioning.md` |
| Auth/admin/security | `apps/server/AGENTS.md`, `docs/security-baseline.md`, `docs/secrets-policy.md`, `docs/permissions.md`, `docs/audit-log.md` |
| Uploads/assets cleanup | `apps/server/AGENTS.md`, `apps/server/src/uploads/AGENTS.md`, `docs/security-baseline.md`, `docs/data-deletion-lifecycle.md`, `docs/entity-ownership.md` |
| Persistence/DB | `apps/server/AGENTS.md`, `docs/database-rules.md`, `docs/concurrency.md` |
| AI behavior | `apps/server/AGENTS.md`, `docs/game-ai-development.md`, `docs/ai-testing.md`, `docs/country-control-ai.md` |
| Dependency/tooling | `docs/libraries.md`, `docs/programming-standards.md`, `docs/engineering-standards.md`, `docs/ai-operating-boundaries.md`, ADR docs |
| Folder/module refactor | `docs/refactoring-plan.md`, `docs/folder-structure.md`, `docs/programming-standards.md`, relevant subsystem `AGENTS.md`, ADR docs if structural decision is major |
| Review | `docs/review-checklist.md`, relevant subsystem guides |

## Non-Negotiable Rules

- Do not add new province-level population, buildings, construction, resources, production, taxes, colonization, or diplomacy transfer without explicit approval.
- Heavy mechanics belong to state regions.
- Provinces remain for map rendering, adjacency, terrain, climate, movement cost, passability, and unit movement.
- Tooltip-first development is mandatory: every new mechanic must have player-visible UI representation and explanatory tooltips before it is considered complete.
- Important visible state changes must produce structured explanation records that can support debugging and player-facing inspection.
- New gameplay content must be data-driven through scenario files, not hardcoded as one-off core simulation branches.
- Bonuses, penalties, multipliers, and rule changes must use the shared modifier system instead of mechanic-specific conditionals.
- AI countries must use the same validated order pipeline as players.
- No default AI cheats. Any AI bonuses must be explicit in scenario defines.
- No hidden gameplay fallback. Technical safety defaults are allowed only when documented and reported.
- All visible UI text must use localization keys with English and Russian values.
- Any admin or privileged behavior must be enforced server-side.
- Important player/admin actions require localized consequence-aware confirmation.
- Balance, pacing, limits, rates, and costs belong in scenario-owned defines.
- Country-level resources must not be mutated directly by mechanics or routes. Mechanics emit `ResourceFlow` entries through `ResourceLedgerService`/resource ledger runtime with resource id, direction, source, category, and localization label key; only ledger runtime/world normalizers apply final `resourcesByCountry` totals.
- Player-facing country resource values must have ledger-backed income, expense, net, category, and recent-entry explanations when they are shown as flows.
- Major architecture, protocol, persistence, AI, dependency, world-model, or scenario-format decisions require an ADR.
- No real secrets, tokens, passwords, JWTs, `.env` files, or private player/admin data may be committed, logged, or embedded.
- Mutating flows must choose a concurrency strategy: transaction, lock, queue, optimistic version, idempotency key, or explicit rejection.
- Destructive operations require authorization, confirmation, audit, and dry-run/preview where practical.
- Heavy systems need bounded metrics/logs; never add unbounded in-memory metric arrays.
- Name reusable code by stable domain responsibility, not by the first mechanic that uses it.
- New folders require a clear responsibility and, for non-trivial cases, a New Folder Proposal as defined in `docs/folder-structure.md`.
- Scenario-authored data uses strict JSON, one entity per file, authoritative JSON `id` fields, and stable-ID references.
- Province authored data belongs in `history/provinces/*.json`; old aggregate `provinces.json` files are not target authored sources.
- Root legacy aggregate content libraries such as `apps/server/data/content-library.json` are forbidden; scenario content belongs under `scenarios/<scenario_id>/common/*/*.json`.
- Scenario generated indexes belong only under `scenarios/<scenario_id>/.generated/` and must not be manually edited.

## Tooltip-First Development

Every new mechanic must answer immediately: how will the player see and understand this?

A mechanic is incomplete until it has proper UI representation and explanatory tooltips. Tooltips for visible values must explain:

- what the value means,
- why the value currently has this number,
- which sources increase it,
- which sources decrease it,
- which modifiers affect it,
- what gameplay effects it produces.

If a system changes science, money, population, legitimacy, production, market access, migration, radicalism, or any other visible value, the player must be able to inspect the reason. Do not implement hidden calculations that only developers can understand.

## Data-Driven Content

New gameplay content must be added through data files, not hardcoded logic. This applies to buildings, goods, technologies, laws, events, decisions, modifiers, units, institutions, cultures, and religions.

Preferred formats are JSON and, where already supported by the project, JSON-compatible scenario files. JSONC or YAML may be introduced only after explicit project support is added and documented.

Adding a new building, good, law, or event must not require editing core simulation code. Core code provides reusable systems; scenario data defines concrete content.

Bad:

```ts
if (buildingId === "university") {
  science += 10;
}
```

Good:

```json
{
  "id": "building:university",
  "effects": [
    {
      "type": "add_resource_flow",
      "resource": "science",
      "amount": 10,
      "category": "education"
    }
  ]
}
```

## Unified Modifier System

All bonuses, penalties, multipliers, and rule changes must use the shared modifier system.

Do not add mechanic-specific conditional logic such as:

```ts
if (hasLawA) value += 10;
if (hasLawB) value *= 1.2;
if (hasTechnologyC) cost -= 5;
```

Instead, laws, technologies, buildings, traits, events, institutions, and country effects must create modifiers. A modifier must define target, operation, value, scope, source, duration, and priority/order when needed.

Example:

```json
{
  "id": "modifier:public_schools_science_bonus",
  "target": "country.science_generation",
  "operation": "multiply",
  "value": 1.15,
  "source": "law:public_schools"
}
```

The same modifier system must be usable by economy, population, politics, military, technology, construction, diplomacy, colonization, and market systems.

## Logging And Explanations

The game must be able to explain important state changes quickly. Developers and players should be able to answer:

- why a region lost population,
- why a country went bankrupt,
- why legitimacy fell,
- why market access collapsed,
- why radicals increased,
- why a building stopped producing,
- why migration changed.

Important calculations must produce structured explanation records. These records should include turn number, affected object, changed value, previous value, new value, causes, source systems, related modifiers, and related events.

The explanation system must support both debugging and player-facing UI. If a system changes an important value but does not leave an explanation trail, it is incomplete.

## Forbidden Patterns

Treat these as immediate red flags:

- New hardcoded Russian or English player-facing text in JSX/TS instead of localization keys.
- New hardcoded colors, radii, shadows, spacing, or theme values in UI.
- New balance numbers in code instead of scenario defines.
- New hidden visible-value calculation without UI, tooltip, and explanation trail.
- New hardcoded concrete gameplay content that should be scenario-authored data.
- New mechanic-specific bonus/penalty conditional that bypasses the shared modifier system.
- Root `apps/server/data/content-library.json` or any monolithic scenario content-library fallback.
- New `provincePopulation*`, `provinceBuildings*`, `provinceConstruction*`, `provinceResources*`, or province-level colonization/diplomacy mechanics.
- Admin endpoint, admin WS command, or scenario mutation without server-side permission enforcement.
- Upload flow without owner, scenario scope, validation, and cleanup lifecycle.
- AI direct world-state mutation instead of normal validated orders.
- Direct country resource writes such as `resources.science +=`, `resources.ducats =`, or `worldBase.resourcesByCountry[...]... =` outside resource ledger runtime or world normalizers.
- Raw server error messages exposed to players.
- Full-world scans in resolver, AI, WS, economy, market, or map hot paths without justification.
- Destructive operation without confirmation, audit, and dry-run/preview where practical.
- Dependency addition without rationale and approval.
- Dead code, data, localization keys, docs, tests, or assets left behind after removing a mechanic.
- `any`, `@ts-ignore`, or broad casts outside boundary adapters.
- Secrets, tokens, passwords, auth headers, or private player/admin data in logs/docs/code.
- Vague reusable names like `processData`, `handleStuff`, `updateState`, or overly narrow names for broadly reusable domain logic.
- New root/module folders or large file moves without updating `docs/folder-structure.md`.
- New folders named after temporary use-cases or vague buckets like `misc`, `helpers`, `stuff`, `random`, or `newMechanicStuff`.

## Documentation Update Matrix

When changing a system, update the matching docs:

| Change | Required updates |
| --- | --- |
| New or changed mechanic | Technical docs, Arcawiki if player-facing, tests, scenario defines if balance changes |
| New API/WS contract | Shared types, API/WS docs, error codes, permissions, rate limits if abuse-prone, tests |
| New entity type | Data lifecycle docs, entity ownership docs, cleanup tests, scenario validator if scenario-authored |
| New UI flow | Localization docs/keys, accessibility notes, theme-token compliance, player-facing error clarity |
| New admin action | Permission docs, audit behavior, confirmation UX, rate limits, security review |
| New scenario format/content | Scenario docs, validator expectations, commands docs if scripts change |
| New AI behavior | AI docs, AI tests, performance/observability notes, narrative player visibility if applicable |
| New dependency | ADR or dependency rationale, libraries/engineering docs |
| Destructive/removal work | Data lifecycle docs, deletion checklist, final report with removed code/data/assets |
| New command/script | `docs/commands.md` |
| New term or renamed concept | `docs/glossary.md` and affected docs |
| New reusable domain utility | `docs/naming-and-abstractions.md` conventions and final-report note if intentionally narrow |
| Folder/module layout change | `docs/folder-structure.md`, relevant `AGENTS.md`, imports/commands docs if affected |

## Region Model

A state region is the main unit for:

- population,
- buildings,
- construction,
- resources and deposits,
- production and economy,
- taxes,
- colonization,
- territorial diplomacy,
- region modifiers.

Each region has:

- `ownerCountryId`: legal owner,
- `controllerCountryId`: current controller/occupier,
- `coreCountryIds`: countries with historical/legal core status,
- `claims`: detailed claims with claimant, type, strength, source, expiry, and notes when needed.

The controller receives the region economy while controlling it.

## Game AI Rules

AI is hybrid:

- rule filters decide legal/available actions,
- utility scoring chooses among allowed actions,
- long-term plans guide repeated decisions,
- each turn produces normal server-validated orders.

AI must be budgeted and tested. Target bot count is up to roughly 100-200 AI countries, so avoid full-world scans without indexes.

## Verification

For implementation tasks, run relevant checks and report exactly what ran. Typical gates:

- `npm run typecheck -ws`
- relevant unit/integration tests when available
- scenario validator when scenario/content/regions/AI/localization/assets change
- manual scenario notes for gameplay mechanics

If a required command does not exist yet, propose or add it as part of the task instead of silently skipping the need.

## End-Of-Task Report

Every implementation response must include:

- what was done and why,
- what files/areas changed,
- what checks ran,
- what still should be done and why,
- what problems may occur and why,
- possible solutions or mitigations,
- any docs, Arcawiki, localization, theme, defines, permission, cleanup, or test updates.
- skipped checks and why,
- likely failure modes and possible mitigations.
