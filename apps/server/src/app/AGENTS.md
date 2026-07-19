# Server app guide

Always start from root `AGENTS.md` and `docs/README.md`.

This folder owns Express construction, global middleware, static serving, and app-level HTTP boundaries.

- Middleware order is behavior; preserve and test/report changes.
- Keep route handlers, mechanics, persistence, permissions, and cleanup in their owning modules.
- Static scenario/upload serving uses centralized safe path helpers and never bypasses ownership or validation.
- Apply the server security and API/WS rules from root and `apps/server/AGENTS.md`.
