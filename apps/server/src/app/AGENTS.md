# App Agents

Always start from root `AGENTS.md` and `docs/README.md` before using this folder guide.

Use this guide for `apps/server/src/app`.

Also read:

- `apps/server/AGENTS.md`
- `docs/security-baseline.md`
- `docs/api-ws-versioning.md`
- `docs/programming-standards.md`

## Responsibility

This folder owns Express app construction, global middleware wiring, static serving, and app-level HTTP concerns.

## Rules

- Keep route handlers out of this folder unless they are truly global app health or middleware boundaries.
- Do not put game mechanics, persistence queries, permissions policies, or upload cleanup logic here.
- Middleware order is behavior. Preserve it intentionally and test or report any order changes.
- Static serving of uploads must use upload path helpers and must not bypass upload security rules.
