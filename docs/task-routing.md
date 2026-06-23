# Task Routing

Use this document to decide which guides to read before working. If a task spans multiple rows, read all relevant guides.

| Task type | Required guides |
| --- | --- |
| UI, modals, HUD, Arcawiki | `apps/client/AGENTS.md`, `docs/programming-standards.md`, `docs/accessibility.md`, `docs/localization.md`, `docs/theme-system.md` |
| Map or movement | `apps/client/AGENTS.md`, `apps/server/AGENTS.md`, `docs/hexes-and-regions.md`, `docs/performance-budgets.md`, `docs/folder-structure.md` |
| Game mechanic | `apps/server/AGENTS.md`, `apps/server/src/mechanics/AGENTS.md`, `packages/shared/AGENTS.md`, `docs/world-model.md`, `docs/programming-standards.md`, `docs/testing-strategy.md`, `docs/definition-of-done.md` |
| Region/scenario data | `apps/server/data/AGENTS.md`, `docs/scenario-region-history.md`, `docs/modding-authoring.md`, `docs/data-deletion-lifecycle.md`, `docs/entity-ownership.md` |
| API/WS/shared contract | `packages/shared/AGENTS.md`, `apps/server/AGENTS.md`, `apps/client/AGENTS.md`, `docs/api-ws-versioning.md`, `docs/error-codes.md`, `docs/concurrency.md` |
| Server app/middleware/routes | `apps/server/AGENTS.md`, `apps/server/src/app/AGENTS.md`, `apps/server/src/routes/AGENTS.md`, `docs/security-baseline.md`, `docs/api-ws-versioning.md` |
| Auth/admin/security | `apps/server/AGENTS.md`, `docs/security-baseline.md`, `docs/secrets-policy.md`, `docs/permissions.md`, `docs/audit-log.md`, `docs/rate-limits.md` |
| Uploads/assets cleanup | `apps/server/AGENTS.md`, `apps/server/src/uploads/AGENTS.md`, `docs/security-baseline.md`, `docs/data-deletion-lifecycle.md`, `docs/entity-ownership.md` |
| Persistence/DB | `apps/server/AGENTS.md`, `docs/database-rules.md`, `docs/concurrency.md`, `docs/data-deletion-lifecycle.md` |
| Server runtime primitive | `apps/server/AGENTS.md`, `apps/server/src/runtime/AGENTS.md`, `docs/concurrency.md`, `docs/observability.md`, `docs/performance-budgets.md` |
| AI behavior | `apps/server/AGENTS.md`, `docs/game-ai-development.md`, `docs/ai-testing.md`, `docs/country-control-ai.md`, `docs/performance-budgets.md` |
| Dependency/tooling | `docs/libraries.md`, `docs/programming-standards.md`, `docs/engineering-standards.md`, `docs/ai-operating-boundaries.md`, `docs/adr/README.md` |
| Folder/module refactor | `docs/refactoring-plan.md`, `docs/folder-structure.md`, `docs/programming-standards.md`, relevant subsystem `AGENTS.md`, such as `apps/server/src/routes/AGENTS.md` for route extraction, `docs/adr/README.md` if structural decision is major |
| Review | `docs/review-checklist.md`, relevant subsystem guides |

## Routing Rules

- Start with root `AGENTS.md` and `docs/README.md`.
- Prefer reading too much over missing a cross-cutting rule.
- If a task touches protocol/world state, always include shared, server, and client guidance.
- If a task changes player-facing behavior, include Arcawiki/localization/accessibility implications.
- If a task changes deletion, ownership, uploads, or scenario data, include lifecycle and ownership docs.
