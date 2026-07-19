# Server mechanics guide

Always start from root `AGENTS.md` and `docs/README.md`.

- Prefer pure rules with explicit inputs/results; keep Express, WS, DB, and filesystem side effects outside.
- Receive balance from scenario defines/content and bonuses from shared modifiers. Never special-case concrete content IDs.
- Keep heavy mechanics on regions and lightweight movement/map rules on provinces/hexes.
- Resource changes emit complete ledger flows; important visible changes emit structured explanations.
- Validate ownership and legality through the authoritative order pipeline. AI uses the same path.
- Add focused tests for calculation, rejection, edge cases, explanations, and cleanup.
- Do not add hidden fallback, direct final resource writes, unbounded caches, or client-trusted decisions.
