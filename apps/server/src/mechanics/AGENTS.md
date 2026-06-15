# Server Mechanics Agents

Always start from root `AGENTS.md` and `docs/README.md` before using this folder guide.

Use this guide for domain/gameplay mechanics under `apps/server/src/mechanics`.

Mechanics modules should:

- keep game rules separate from Express routes, DB calls, WebSocket broadcasts, and filesystem work,
- prefer pure functions with explicit inputs and return values,
- keep balance values supplied by scenario defines or caller-owned content/config,
- expose stable domain names that can support future mechanics, not one-off route names,
- include focused unit tests for calculations, validation, cleanup, and edge cases,
- avoid province-heavy mechanics unless explicitly approved.

Do not add hidden gameplay fallback, client-trusted decisions, unbounded caches, or direct persistence side effects here.
