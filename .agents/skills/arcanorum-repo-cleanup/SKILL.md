---
name: arcanorum-repo-cleanup
description: Safely remove obsolete Arcanorum code, dependencies, assets, docs, localization, tests, compatibility layers, or reorganize modules and folders. Use for dead-code cleanup, hard cutovers, dependency removal, AGENTS.md maintenance, documentation deduplication, or structural refactors.
---

# Arcanorum repository cleanup

1. Read root `AGENTS.md`, `docs/refactoring-plan.md`, `docs/folder-structure.md`, `docs/programming-standards.md`, and `docs/data-deletion-lifecycle.md`.
2. Inventory references with `rg` and inspect Git status before editing. Treat pre-existing changes as user-owned and preserve unrelated work.
3. Prove obsolete scope from imports, scripts, runtime references, generated manifests, tests, docs, and scenario data. Keep historical ADRs, marking them superseded instead of rewriting history.
4. Remove a subsystem completely: code, exports, dependencies, scripts, tests, docs, localization, generated outputs, and owned assets. Do not add legacy aliases or compatibility fallbacks during active development unless explicitly requested.
5. Use `apply_patch` for edits. Resolve exact paths before destructive operations and use recoverable deletion where practical. Never perform broad recursive deletion.
6. For folder changes, update `docs/folder-structure.md` and add a folder proposal when non-trivial. For dependency changes, document rationale and lockfile impact.
7. Verify `rg` has no live references, then run typecheck, lint, focused tests, generated-artifact validation, scenario validation, and smoke tests proportionate to the change.

Final reporting must distinguish removed items, retained historical or binary artifacts, skipped checks, likely failures, and mitigations.
