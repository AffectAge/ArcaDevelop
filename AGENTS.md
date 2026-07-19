# Arcanorum agent guide

This is the mandatory entrypoint for work in this repository. A nested `AGENTS.md` adds rules for its directory; the closest file wins on directory-specific details, while the invariants below always apply.

## Start every task

1. Restate the requested outcome and inspect `git status` before editing.
2. Read `docs/README.md`, `docs/agent-start-checklist.md`, `docs/task-routing.md`, `.codex/project-rules.json`, and every applicable nested `AGENTS.md`.
3. Use the relevant project skill:
   - `.agents/skills/arcanorum-map-change` for maps, Phaser, geometry, borders, streaming, or unit movement.
   - `.agents/skills/arcanorum-ui-change` for HUD, menus, modals, tooltips, localization, themes, or responsive UI.
   - `.agents/skills/arcanorum-gameplay-change` for mechanics, orders, contracts, scenarios, modifiers, resources, or AI.
   - `.agents/skills/arcanorum-repo-cleanup` for dead code, dependency removal, documentation cleanup, or structural refactors.
4. Read the template under `docs/templates/` matching the task. Create an ADR for major architecture, protocol, persistence, AI, dependency, world-model, or scenario-format decisions.
5. Ask before an ambiguous, destructive, or unrequested gameplay-architecture change. Straightforward requested implementation may proceed.

## Architecture invariants

- The server is authoritative. Clients and AI request actions through the same validated order pipeline.
- The world is one rectangular `width x height` map of pointy-top offset hexes. Canonical authored bounds are `q in [0,width)` and `r in [0,height)`; horizontal wrapping exists only when `wrapX` is enabled.
- Do not change hex orientation or projection without tracing projection, inverse hit testing, neighbors, edge masks, rivers/coasts, corridors, paths, culling, and authored artifacts.
- Hexes/provinces are lightweight map and movement units: terrain, climate, adjacency, passability, cost, rendering, and unit position.
- State regions own heavy mechanics: population, buildings, construction, resources, production, taxes, colonization, territorial diplomacy, and regional modifiers.
- Regions track legal owner, current controller, cores, and detailed claims. The controller receives the region economy.
- Scenarios own countries, regions, content, defines, AI profiles, localization, Arcawiki, themes, and runtime assets.

Do not add province-level heavy mechanics without explicit approval.

## Code and folder standards

- Follow `docs/programming-standards.md`, `docs/engineering-standards.md`, `docs/folder-structure.md`, and `docs/naming-and-abstractions.md`.
- Primary upstream guidance is indexed in `docs/official-engineering-sources.md`.
- Keep strict TypeScript. Do not add `any`, `@ts-ignore`, broad casts, empty catches, or vague catch-all helpers.
- Separate domain calculation, validation, mutation, transport, persistence, filesystem, and rendering responsibilities.
- Validate untrusted API, WS, scenario, upload, and external-library data at boundaries.
- Name modules by stable responsibility. New non-trivial folders require `docs/templates/new-folder-proposal.md` and a `docs/folder-structure.md` update.
- Do not add dependencies without rationale, documentation, and approval within the task scope.
- Preserve unrelated user changes in a dirty worktree.

## Gameplay and data rules

- Concrete buildings, goods, technologies, laws, events, decisions, units, cultures, religions, AI profiles, and balance belong in scenario files, not concrete-ID branches.
- Scenario-authored data is strict JSON, one entity per file, with authoritative stable `id` values.
- Province history belongs in `history/provinces/*.json`; generated indexes belong only in `.generated/` and are not manually edited.
- Do not restore root aggregate content libraries or legacy scenario layouts.
- During active development, do not add compatibility aliases or migration fallbacks unless explicitly requested. Prefer a documented local reset for incompatible development state.
- Bonuses, penalties, multipliers, and rule changes use the shared modifier system.
- Country resource changes use `ResourceFlow` through the resource ledger. Direct mechanics/routes writes to final country resource totals are forbidden.
- Important visible changes produce bounded structured explanations with turn, object, previous/new value, causes, source systems, modifiers, and related events.
- Every new mechanic is tooltip-first: the player must see it and understand meaning, current causes, positive/negative sources, modifiers, and effects.

## Client and map rules

- All visible text uses localization keys with English and Russian values.
- UI uses scenario theme tokens and the reusable demo components documented in `apps/client/src/components/templates/DEMO_ELEMENTS.md`; do not hardcode visible colors, spacing, radii, shadows, or player text.
- Preserve keyboard use, focus visibility, contrast, non-color cues, readable targets, safe areas, and portrait mobile layout.
- Phaser map terrain uses bitmap textures and normal images/sprites/tile layers. Do not add custom shader pipelines or custom mesh terrain.
- Country, controller, and region borders use cached edge masks/atlases and visible-chunk culling; do not create one graphics object per edge or redraw the whole world every frame.

## Server, security, and operations

- Enforce permissions server-side. Client visibility is not authorization.
- Mutations define concurrency strategy, stable errors, audit need, rate-limit need, idempotency, and cleanup.
- Do not expose raw server errors or private debug data to players.
- Never commit or log secrets, tokens, passwords, JWTs, auth headers, cookies, `.env` files, or private player/admin data.
- Destructive actions require exact scope, authorization, confirmation, audit, and preview/dry-run where practical.
- Hot paths avoid unjustified full-world scans and N+1 queries. Caches, queues, metrics, logs, histories, and replay windows stay bounded.
- Uploads require server-side ownership, scenario scope, validation, safe paths, permissions, and cleanup lifecycle.

## AI rules

- AI uses deterministic rule filters, utility scoring, and longer plans to emit normal validated orders.
- AI has no default cheats or hidden information. Explicit bonuses belong in scenario defines.
- Budget AI for roughly 100-200 countries; derive indexes once rather than scanning the world per country.
- Raw scores/debug explanations stay admin-only or test-only; player-facing outcomes remain narrative and localized.

## Cleanup rules

- Prove obsolete scope with imports, runtime references, scripts, manifests, tests, docs, localization, scenario data, and assets.
- Remove owned code, exports, dependencies, tests, docs, localization, and generated artifacts together. Do not leave dead compatibility layers.
- Keep historical ADRs and mark superseded decisions instead of deleting history.
- Follow `docs/data-deletion-lifecycle.md` and `docs/entity-ownership.md` for entity or asset removal.

## Verification and delivery

Run checks proportional to risk and report exact commands. Typical gates are:

- `npm run typecheck -ws`
- `npm run lint`
- focused Vitest tests, then broader tests when practical
- scenario validation when scenario/content/regions/AI/localization/themes/assets change
- `npm run map-assets:build` when map art or its manifest changes
- browser playtest for map or UI changes, including portrait mobile

Read `docs/testing-strategy.md` and `docs/definition-of-done.md` before finishing. The final report must state what changed and why, files/areas changed, checks run, skipped checks and reasons, remaining work, likely failures and mitigations, and impacts on docs, Arcawiki, localization, themes, defines, permissions, cleanup, and tests.
