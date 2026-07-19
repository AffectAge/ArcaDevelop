# Arcanorum Documentation Index

This is the entrypoint for project documentation.

## Start Here

- `AGENTS.md` - mandatory AI-agent workflow and prohibitions.
- `docs/agent-start-checklist.md` - short checklist agents run before implementation.
- `docs/task-routing.md` - task-to-guide routing table.
- `.codex/project-rules.json` - machine-readable routing, required docs, templates, and forbidden patterns.
- `docs/docs-maintenance.md` - how to keep docs current and avoid stale duplicates.
- `docs/glossary.md` - shared project terminology.
- `docs/definition-of-done.md` - completion checklist for implementation tasks.
- `docs/programming-standards.md` - canonical day-to-day coding standards.
- `docs/official-engineering-sources.md` - primary OpenAI, TypeScript, React, ESLint, WCAG, MDN, Node.js, and Phaser sources behind those standards.
- `docs/engineering-standards.md` - code structure, typing, configuration, and error rules.
- `docs/folder-structure.md` - current and target repository layout rules.
- `docs/refactoring-plan.md` - phased plan for bringing obsolete code toward the agent rules.
- `docs/naming-and-abstractions.md` - naming rules for functions, types, modules, and reusable domain logic.
- `docs/ai-operating-boundaries.md` - what AI agents must and must not do.
- `docs/commands.md` - project commands and when to use them.
- `apps/server/src/app/AGENTS.md` - server app construction and middleware rules.
- `apps/server/src/mechanics/AGENTS.md` - server gameplay/domain mechanics module rules.
- `apps/server/src/runtime/AGENTS.md` - server runtime primitives and orchestration helper rules.
- `apps/server/src/uploads/AGENTS.md` - server upload ownership, path, validation, and cleanup rules.

## World And Mechanics

- `docs/world-model.md` - hex/region world model.
- `docs/hexes-and-regions.md` - responsibilities of hexes vs gameplay regions.
- `docs/regions-and-provinces.md` - legacy province/state-region notes kept only for cleanup context.
- `docs/scenario-region-history.md` - scenario region geography and starting state files.
- `docs/data-deletion-lifecycle.md` - ownership and cleanup rules.
- `docs/entity-ownership.md` - practical ownership map by entity.
- `docs/testing-strategy.md` - project-wide testing layers and expectations.
- `docs/performance-budgets.md` - turn resolve, AI, WS, scenario loading, and map budgets.

## AI

- `docs/country-control-ai.md` - country control modes and takeover.
- `docs/game-ai-development.md` - game AI architecture and fairness.
- `docs/ai-testing.md` - AI unit, fixture, and simulation tests.

## Server, API, And Operations

- `docs/security-baseline.md` - server authority, input handling, safe errors.
- `docs/secrets-policy.md` - secrets, logs, env files, and private data.
- `docs/database-rules.md` - Prisma, destructive operations, hot paths.
- `docs/api-ws-versioning.md` - API/WS contracts and world deltas.
- `docs/error-codes.md` - error-code registry policy.
- `docs/permissions.md` - roles and privileged action policy.
- `docs/audit-log.md` - audit event format and retention.
- `docs/rate-limits.md` - rate-limit requirements.
- `docs/concurrency.md` - transactions, locks, queues, idempotency.
- `docs/observability.md` - bounded metrics and admin diagnostics.

## Client And UX

- `docs/accessibility.md` - keyboard, focus, contrast, and readable UI.
- `docs/localization.md` - i18n keys, namespaces, and error-code text.
- `docs/theme-system.md` - scenario theme tokens and validation.
- `docs/project-assets-map-art-folder-proposal.md` - source-art/provenance folder boundaries for reproducible map atlases.
- `apps/client/src/components/templates/DEMO_ELEMENTS.md` - reusable UI template component catalog for modals, panels, buttons, form controls, chips, charts, and demo-maintenance rules.

## Scenario Authoring

- `docs/modding-authoring.md` - scenario/modding authoring principles.
- `docs/libraries.md` - approved library map and dependency approval policy.
- `docs/dependency-eslint-react-hooks.md` - official React Hooks lint dependency rationale and scope.

## Architecture Decisions

- `docs/adr/README.md` - when to write an ADR.
- `docs/adr/ADR-0001-template.md` - ADR template.
- `docs/adr/ADR-0002-per-entity-scenario-files.md` - accepted scenario per-entity file layout decision.
- `docs/adr/ADR-0011-content-addressed-hex-map-streaming.md` - accepted worker-owned, content-addressed chunk streaming and client artifact format.
- `docs/adr/ADR-0014-baked-natural-object-render-textures.md` - accepted deterministic individual natural-object recipes baked into visible chunk RenderTextures.

## Templates

- `docs/templates/mechanic-change.md` - mechanic change planning/report template.
- `docs/templates/api-change.md` - API/WS change template.
- `docs/templates/ui-change.md` - UI change template.
- `docs/templates/new-folder-proposal.md` - new folder proposal template.
- `docs/templates/adr.md` - ADR template.
- `docs/templates/final-report.md` - implementation final report template.
- `docs/templates/bug-fix.md` - bug investigation and regression template.
- `docs/templates/refactor.md` - behavior-preserving refactor template.
- `docs/templates/scenario-change.md` - scenario/content/defines/assets template.
- `docs/templates/data-migration-removal.md` - removal and cleanup template.
- `docs/templates/security-change.md` - permissions/security/audit/rate-limit template.
- `docs/templates/performance-change.md` - performance optimization template.
- `docs/templates/test-plan.md` - test planning template.
- `docs/templates/arcawiki-update.md` - player-facing guide update template.
- `docs/templates/dependency-request.md` - dependency approval template.
- `docs/templates/cleanup-lifecycle.md` - entity cleanup lifecycle template.
- `docs/templates/database-change.md` - Prisma/database change template.
- `docs/templates/ws-delta-change.md` - WS/world-delta protocol template.
- `docs/templates/localization-change.md` - localization update template.
- `docs/templates/theme-change.md` - scenario theme update template.
- `docs/templates/ai-behavior-change.md` - AI behavior change template.
- `docs/templates/release-checklist.md` - release readiness template.

## Reviews

- `docs/review-checklist.md` - code review checklist for agents and humans.
