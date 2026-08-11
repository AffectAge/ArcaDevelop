# Arcanorum Engine v2

Status: **active rewrite foundation**  
Working branch: `engine-v2`  
Reference branch: `update3`

## 1. Purpose

Arcanorum Engine v2 is a data-driven, authoritative online grand-strategy engine.
It keeps the current project's playable mechanics and visual language as reference material,
but it does not preserve the old runtime dependency graph.

The architectural model is deliberately similar to Clausewitz-era Paradox games:

1. the engine owns deterministic simulation and session lifecycle;
2. the game registers domain systems and command handlers;
3. scenarios provide definitions, map data, history, events and localisation;
4. the server remains authoritative;
5. the client renders snapshots/deltas and submits commands, but never decides game outcomes.

This is an architectural analogy, not an attempt to copy proprietary source code or file syntax.

## 2. Non-negotiable rules

### 2.1 Simulation is independent

The simulation core must not import:

- Express;
- Prisma;
- Redis;
- WebSocket libraries;
- React;
- Phaser;
- Node filesystem APIs.

Filesystem loading, persistence, networking and rendering are adapters around the core.

### 2.2 State is normalized

Saveable world state uses ID-based tables rather than nested object graphs:

```text
WorldState
├── meta
├── definitions
│   ├── goods
│   ├── popTypes
│   ├── unitTypes
│   ├── buildingTypes
│   └── technologies
└── tables
    ├── countries
    ├── regions
    ├── provinces
    ├── pops
    ├── units
    ├── markets
    └── buildings
```

References are explicit IDs:

```ts
province.ownerCountryId = "arc";
pop.provinceId = "province:17";
unit.ownerCountryId = "arc";
building.typeId = "textile_mill";
```

Renderer objects, Prisma entities and WebSocket objects are never part of `WorldState`.

### 2.3 Mutations go through a journal

Systems and command handlers receive a `WorldWriter`.
The writer performs mutations and records table-level changes at the same time.
A completed turn therefore produces a `WorldDelta` without comparing two full worlds.

A turn executes against a cloned working world. The live session state is replaced only after
all commands and systems complete. A thrown error does not partially publish the working world.

### 2.4 Turns are deterministic

For the same:

- scenario bundle;
- engine version;
- ordered command stream;
- registered systems;
- starting RNG state;

the resulting world and delta must be identical.

Rules:

- no `Math.random()` inside simulation;
- systems receive `DeterministicRandom`;
- system order is stable by phase, explicit order and system ID;
- command order is assigned by the authoritative server session;
- collections that affect outcomes are explicitly sorted;
- dates advance in UTC;
- side effects happen after the simulation result is accepted.

### 2.5 Online commands are versioned and idempotent

Every client command includes:

```json
{
  "id": "command:arc:tax:184",
  "kind": "country.set_tax_rate",
  "actorCountryId": "arc",
  "expectedVersion": 42,
  "payload": {
    "countryId": "arc",
    "taxRate": 0.35
  }
}
```

The session rejects stale `expectedVersion` values. Reusing a command ID returns its original
submission result rather than executing the action twice.

## 3. Layer model

```text
apps/client
    React UI + Phaser renderer
               │
               │ snapshots / deltas / commands
               ▼
apps/server transport
    HTTP + WebSocket + authentication
               │
               ▼
server application
    game registry + session orchestration
               │
               ▼
engine core
    commands + turn pipeline + world journal
               │
               ▼
game modules
    economy + population + military + politics + ...
               │
               ▼
scenario data
    common + history + map + events + localisation
```

Dependencies point inward. Domain systems may depend on engine contracts; the engine does not
depend on domain systems.

## 4. Scenario data convention

The first loader uses JSON because it is unambiguous, tool-friendly and can be validated before a
session starts. The engine API does not depend on JSON; a future text-format parser can produce the
same `ScenarioBundle`.

```text
scenarios/<scenario-id>/
├── scenario.json
├── common/
│   ├── goods/
│   │   └── *.json
│   ├── pop-types/
│   │   └── *.json
│   ├── unit-types/
│   │   └── *.json
│   ├── building-types/
│   │   └── *.json
│   └── technologies/
│       └── *.json
├── history/
│   ├── countries/
│   ├── regions/
│   ├── provinces/
│   ├── pops/
│   ├── units/
│   ├── markets/
│   └── buildings/
├── map/
├── events/
└── localisation/
    ├── ru.json
    ├── en.json
    └── *.json
```

A collection file may contain one object or an array. Directories are traversed in stable lexical
order. `loadScenarioBundleFromDirectory()` performs deterministic assembly. `compileScenario()`
performs semantic validation and normalization.

The compiler currently checks:

- schema and engine version;
- ID syntax and duplicate IDs;
- date and positive define values;
- country capitals and markets;
- region/province ownership references;
- province adjacency references;
- pop, unit and building references;
- goods used by needs and production;
- technology prerequisites;
- numeric ranges for tax, literacy, consciousness and militancy.

Broken scenario data prevents session creation. It is not repaired silently.

## 5. Turn pipeline

Registered phases are stable:

```text
orders
military
construction
production
market
population
politics
technology
diplomacy
events
ai
finalize
```

A system is small and explicit:

```ts
const populationGrowthSystem: TurnSystem = {
  id: "population.natural-growth",
  phase: "population",
  order: 100,
  run(context) {
    // Read context.world.
    // Mutate only through context.writer.
    // Use context.random for randomness.
  },
};
```

The phase list is an ordering contract, not a requirement that every game register every phase.

## 6. Session and persistence boundary

The target server flow is:

```text
load persisted snapshot
        ↓
create GameSession
        ↓
accept and validate commands
        ↓
resolve isolated working world
        ↓
WorldDelta + EngineEvents
        ↓
atomic persistence transaction
        ↓
publish WebSocket delta
        ↓
advance durable session version
```

Persistence adapters store:

- full snapshots at configured checkpoints;
- accepted command log;
- turn deltas/event log;
- session metadata;
- player/country permissions.

A domain system must never call Prisma directly during turn resolution.

## 7. Client architecture

```text
React
├── strategic shell
├── windows and inspectors
├── tooltips and notifications
├── charts and tables
└── command creation
       │
       ▼
Client World Store
├── last authoritative snapshot
├── ordered applied deltas
├── pending local commands
└── UI-only state
       │
       ▼
Phaser Map Adapter
├── terrain and borders
├── labels and markers
├── units and routes
├── selection overlays
└── camera/input
```

React owns text-heavy interaction. Phaser owns the map surface and disposable visual objects.
Neither renderer nor React component state is authoritative game state.

The `/engine-v2` visual surface is a design contract for the rewrite. It preserves the existing
demo's dark metal, parchment, gold/bronze framing, compact data density and strategic-map emphasis,
while reducing the old `App.tsx` mega-component pattern.

## 8. UI acceptance criteria

Every major UI slice must be checked at representative desktop and mobile sizes.
For map/WebGL work, DOM assertions alone are insufficient; screenshot review is required.

Minimum states:

1. cold boot / loading;
2. default strategic map;
3. selected province;
4. selected army;
5. open economy/politics/diplomacy window;
6. queued command feedback;
7. resolving turn;
8. stale-version resync;
9. mobile collapsed HUD;
10. rendering failure/fallback state.

The center and lower-middle map remain readable during normal play. Large information surfaces are
contextual panels or modal workspaces, not permanently stacked dashboard cards.

## 9. Testing gates

### Engine unit tests

- scenario compilation;
- duplicate/missing references;
- deterministic replay;
- command authorization and validation;
- idempotent command IDs;
- stale world versions;
- system ordering;
- mutation journal/delta correctness;
- turn rollback on failure.

### Server integration tests

- load scenario directory;
- create and restore session;
- persist turn atomically;
- reconnect and replay deltas;
- multiple simultaneous game sessions;
- command permissions;
- WebSocket backpressure and resync.

### Client and visual tests

- store snapshot/delta application;
- UI-to-command mapping;
- Phaser adapter disposal;
- desktop/mobile layout;
- screenshot baselines for important states;
- map performance fixtures.

## 10. Rewrite sequence

### Phase 0 — foundation (current)

- isolated `engine-v2` branch;
- normalized world contracts;
- scenario compiler;
- deterministic RNG;
- command registry and queue;
- system turn pipeline;
- mutation journal and world delta;
- directory loader;
- demo scenario and smoke tests;
- visual UI contract.

### Phase 1 — server vertical slice

- `GameRegistry` supporting multiple `GameSession` instances;
- snapshot/command/delta repositories;
- Engine v2 HTTP/WebSocket protocol;
- login-to-country permission adapter;
- one demo scenario loaded from disk;
- reconnect and delta replay.

### Phase 2 — map and shell

- client `WorldStoreV2`;
- Phaser renderer adapter that consumes normalized province/unit tables;
- React shell split into focused feature modules;
- screenshot/playtest automation;
- responsive HUD.

### Phase 3 — first real game loop

- construction;
- goods production;
- markets and prices;
- pop needs and income;
- tax/budget;
- migration and promotion;
- technology;
- basic military movement/combat.

### Phase 4 — content engine

- modifier registry;
- trigger/effect interpreter;
- events and decisions;
- scripted values;
- localisation interpolation;
- mod load order and override rules;
- scenario validation CLI.

### Phase 5 — migration and retirement

- import selected `update3` scenario/content data;
- compatibility importers where useful;
- regression comparison against agreed mechanics;
- retire old runtime only after the new vertical slice replaces it.

## 11. Current implementation

```text
apps/server/src/engine-v2/
├── types.ts
├── engine.ts
├── scenarioDirectoryLoader.ts
├── demo.ts
├── engine.test.ts
└── index.ts
```

`types.ts` defines serializable world, scenario, command, event and delta contracts.
`engine.ts` owns compilation, deterministic simulation, mutation journaling and game sessions.
`scenarioDirectoryLoader.ts` is the Node filesystem adapter.
`demo.ts` provides a minimal playable data/system example.
`engine.test.ts` protects the initial architecture.

## 12. Engineering references

The implementation follows the official documentation of the selected runtime and build tools:

- TypeScript project references and build mode:
  <https://www.typescriptlang.org/docs/handbook/project-references>
- Node.js filesystem APIs:
  <https://nodejs.org/api/fs.html>
- Node.js path APIs:
  <https://nodejs.org/api/path.html>
- Vite dynamic chunks and CSS code splitting:
  <https://vite.dev/guide/features.html>
- Phaser scene lifecycle:
  <https://docs.phaser.io/phaser/concepts/scenes>
- Phaser game objects:
  <https://docs.phaser.io/phaser/concepts/gameobjects>

These references define tool behavior. They do not replace game-specific architectural tests.
