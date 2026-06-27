# Civ-Like Units, Equipment Constructor, And Settler Colonization

## Status

Proposed

## Context

- Problem: player-facing colonization by region button does not support a Civ-like map flow, and the current military model does not distinguish civilian units, land divisions, fleets, air wings, equipment variants, production lines, and stockpiles.
- Constraints: heavy simulation remains region-level; hexes may host movement entities and visual markers, but not population/economy/building containers. Server validation remains authoritative, AI must use normal orders, and visible mechanics need tooltip-ready explanations.
- Why this matters now: building placement already made hex-addressed visual markers part of the world model, so units, city markers, and settlement projects need a matching shared contract before UI and runtime mechanics are implemented.

## Options

- Option A: keep region button colonization and only add better military UI.
- Option B: add a small colonizer-only unit model without equipment variants.
- Option C: introduce the target shared model now: civilian units, settlement projects, city markers, branch-aware military state, equipment variants, production lines, stockpiles, and new unit/equipment orders.

## Decision

- Chosen option: Option C, implemented incrementally behind a new-game-only contract.
- Why: the target design depends on shared IDs and WS-visible state. Adding the contracts first prevents UI/server implementations from inventing incompatible local shapes.

## Consequences

- Benefits: client, server, AI, and scenario tooling can converge on one model for colonizers, city markers, equipment variants, production lines, and stockpiles.
- Risks: the current delta mask is a 32-bit number with limited remaining bits. The first contract slice uses one grouped `unitEquipmentState` mask for the new unit/equipment state sections instead of one bit per section.
- Migration/removal work: existing saves are incompatible with the complete feature. During the contract transition, missing new fields restore to empty maps; once runtime mechanics are enabled, old saves must be rejected or reset rather than migrated.
- Compatibility decision: `COLONIZE` remains in the shared union as legacy/internal compatibility, but player UI should move to `FOUND_CITY` with a `colonizer` civilian unit.
- Follow-up tasks: implement server validation and turn resolution, settlement progress through the resource ledger, city atlas validation, equipment stat derivation, military template auto-equipping, combat resolution, AI orders, player UI, Arcawiki, and scenario authoring validation.

## Verification

- Tests: shared typecheck, server/client typecheck, delta tests for grouped unit/equipment sections, client store delta application tests.
- Docs: this ADR, `docs/world-model.md`, `docs/api-ws-versioning.md`.
- Metrics: future runtime slices must add bounded turn-phase metrics for movement, settlement projects, equipment production, and combat.
- Review checklist: confirm no heavy simulation moved to hexes; confirm new orders use stable errors, authorization, and localized UI; confirm AI uses validated orders.
