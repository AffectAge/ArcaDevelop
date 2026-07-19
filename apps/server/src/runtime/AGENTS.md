# Server runtime guide

Always start from root `AGENTS.md` and `docs/README.md`.

This folder owns bounded orchestration and runtime primitives, not route handlers, persistence adapters, security policies, scenario formats, or reusable gameplay rules.

- Name modules by stable runtime responsibility; do not create catch-all helpers.
- Bound caches, queues, histories, retries, logs, and metrics; expose invalidation.
- Mutating flows choose and document a concurrency strategy.
- Avoid hidden full-world scans in hot paths; derive indexes and batch work.
- Keep primitives focused and test-covered. Move rules to `mechanics`, persistence to `persistence`, and HTTP boundaries to `routes`/`app`.
