# Server Mechanics Agents

Always start from root `AGENTS.md` and `docs/README.md` before using this folder guide.

Use this guide for domain/gameplay mechanics under `apps/server/src/mechanics`.

Mechanics modules should:

- keep game rules separate from Express routes, DB calls, WebSocket broadcasts, and filesystem work,
- prefer pure functions with explicit inputs and return values,
- keep balance values supplied by scenario defines or caller-owned content/config,
- consume data-authored content and shared modifiers instead of hardcoding concrete buildings, goods, laws, events, technologies, or bonuses,
- return or emit structured explanation records for important visible state changes,
- emit country-level resource changes as resource ledger flows instead of mutating `resourcesByCountry` directly,
- include source type, source id, category id, resource id, direction, amount, and localization label key on every resource ledger flow,
- expose stable domain names that can support future mechanics, not one-off route names,
- include focused unit tests for calculations, validation, cleanup, and edge cases,
- avoid province-heavy mechanics unless explicitly approved.

Do not add hidden gameplay fallback, hidden visible-value calculations, mechanic-specific modifier bypasses, client-trusted decisions, unbounded caches, or direct persistence side effects here.
