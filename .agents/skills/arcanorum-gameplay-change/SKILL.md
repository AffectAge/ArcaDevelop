---
name: arcanorum-gameplay-change
description: Implement or review Arcanorum server gameplay mechanics, validated orders, shared contracts, scenario-defined content, modifiers, resources, AI behavior, or visible explanation records. Use for mechanics, runtime turn resolution, gameplay API or WS contracts, unit systems, or scenario balance changes.
---

# Arcanorum gameplay change

1. Read root, server, mechanics, and shared `AGENTS.md`, then `docs/world-model.md`, `docs/testing-strategy.md`, and `docs/definition-of-done.md`.
2. Keep the server authoritative. Players and AI submit the same validated orders; neither client nor AI mutates authoritative state directly.
3. Keep provinces lightweight. Population, buildings, production, construction, resources, taxes, colonization, and territorial diplomacy belong to state regions unless explicitly approved.
4. Author concrete content and balance in scenario JSON. Express bonuses and penalties through shared modifiers, not concrete-ID branches.
5. Emit country resource changes through the resource ledger, and produce bounded structured explanations for important visible changes.
6. Define stable errors, permissions, concurrency, audit, rate limit, delta/versioning, cleanup, and localization impacts at every mutated boundary.
7. Add focused pure tests plus integration/scenario tests for cross-system behavior. Run relevant typecheck, tests, and scenario validation; update Arcawiki/tooltips when player understanding changes.

Write an ADR for major architecture, protocol, persistence, world-model, AI, dependency, or scenario-format decisions.
