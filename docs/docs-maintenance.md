# Documentation Maintenance

Documentation must stay useful and current.

## Rules

- Update `docs/README.md` when adding, removing, or renaming docs.
- Update `.codex/project-rules.json` when required docs, task routing, templates, guarded paths, or forbidden patterns change.
- Avoid duplicating full rules across many files; link to the source of truth instead.
- Mark outdated sections as `obsolete` only when they describe existing obsolete code that still matters.
- Remove obsolete docs when the system they describe is removed.
- Keep player-facing guidance in Arcawiki, not technical docs.
- Keep technical implementation guidance in `docs/`, not Arcawiki.

## Status Labels

Use these labels when needed:

- `Current`: implemented or actively required.
- `Target`: intended architecture/rule not fully implemented yet.
- `obsolete`: existing old behavior that must not be expanded.
- `Planned`: approved future work.

## Agent Requirement

When a task changes architecture, protocol, scenario format, mechanics, AI, commands, permissions, or operations, update the relevant doc and the docs index.

When adding a reusable task format, add it under `docs/templates/` and link it from `docs/README.md` and `.codex/project-rules.json`.
