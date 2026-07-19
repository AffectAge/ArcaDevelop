# Shared contracts guide

Always start from root `AGENTS.md` and `docs/README.md`.

Read root `AGENTS.md`, `docs/api-ws-versioning.md`, `docs/concurrency.md`, and `docs/engineering-standards.md`.

- Shared types are the client/server contract. A model change updates validators, server producers, client consumers, tests, and docs together.
- Keep public names stable and payloads typed. Use machine-readable error codes and localization keys, not player-facing prose.
- Regions own heavy state; province/hex contracts stay focused on geometry, terrain, adjacency, passability, cost, and movement.
- Keep delta sections explicit, compact, versioned, idempotent, and ACK/replay safe. Avoid full snapshots outside bootstrap/resync.
- Country resource changes use `ResourceFlow` plus bounded ledger history. `labelKey` is localized at the client boundary.
- Hex geometry and movement helpers must be pure, deterministic, precision-safe, and covered by focused tests.
- Do not put server-only persistence, permissions, or runtime state into shared contracts.
