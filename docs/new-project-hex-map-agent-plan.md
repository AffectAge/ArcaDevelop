# New Project Hex Map Agent Plan

Status: Target

This document is a standalone agent plan for building only the map layer of a new project. It is not an implementation plan for the current Arcanorum map and must not be used to replace the existing renderer without a separate architecture decision.

## Goal

Create a high-performance hex map renderer for a new project using Babylon.js and Red Blob Games style hex-grid architecture, without wraparound support.

The first milestone is a map-only vertical slice:

- load a static hex-map artifact,
- render terrain with Babylon.js,
- pan and zoom smoothly,
- pick and hover hexes accurately,
- show selection, highlights, regions, borders, and route previews,
- support noisy terrain borders through shader-ready mesh data,
- expose clear APIs so gameplay code can be added later without rewriting the renderer.

## Non-Goals

Do not build these in the map-only project phase:

- wraparound maps,
- gameplay simulation,
- economy, population, diplomacy, construction, or AI,
- server authority or multiplayer deltas,
- save-game format,
- map editor beyond developer fixtures,
- player-facing game UI outside the map HUD needed for diagnostics.

## Source Approach

Use these Red Blob Games concepts as design inputs:

- Store hexes as axial coordinates `q,r`; compute cube coordinate `s = -q-r` only inside algorithms that need it. Red Blob recommends axial/cube for simpler algorithms and axial storage for many map shapes.
- Keep hex-to-pixel and pixel-to-hex conversion centralized and covered by tests.
- Use cube/axial distance, neighbors, range, line drawing, and pathfinding as the canonical math layer.
- For noisy terrain, design mesh data so terrain transitions can be moved into shaders using corner/dual geometry, barycentric-style interpolation data, and deterministic noise inputs.

References:

- <https://www.redblobgames.com/grids/hexagons/>
- <https://www.redblobgames.com/x/1730-terrain-shader-experiments/noisy-hex-rendering.html>

## Agent Roles

Use separate agents or workstreams only when the implementation environment supports parallel work. If one agent is doing the project, follow the same order sequentially.

### 1. Project Architect Agent

Responsibilities:

- choose the initial stack: TypeScript, Vite, React only if needed for HUD, Babylon.js for rendering, Vitest for math tests, Playwright for smoke tests;
- write the project ADR for Babylon.js as the map renderer;
- define module boundaries before code exists;
- prevent gameplay systems from entering the map-only scope.

Deliverables:

- `docs/adr/use-babylon-hex-map.md`,
- `docs/map-scope.md`,
- `docs/map-performance-budget.md`,
- initial folder plan.

Acceptance criteria:

- Babylon dependency is justified against Pixi, Three.js, and custom WebGL;
- no wraparound requirement appears in scope;
- map-only milestone is small enough to finish before gameplay work starts.

### 2. Hex Math Agent

Responsibilities:

- implement immutable hex coordinate functions;
- keep all algorithms independent from Babylon, React, and DOM;
- write tests for coordinate correctness.

Suggested modules:

```text
src/map/hex/coordinates.ts
src/map/hex/layout.ts
src/map/hex/neighbors.ts
src/map/hex/distance.ts
src/map/hex/rounding.ts
src/map/hex/line.ts
src/map/hex/range.ts
src/map/hex/pathfinding.ts
```

Core decisions:

- `HexCoord` stores `{ q: number; r: number }`.
- `CubeCoord` is derived as `{ q, r, s: -q - r }`.
- Do not use offset coordinates internally; add conversion only if importing external data requires it.
- `HexId` should be deterministic, for example `hex:${q}:${r}`.

Acceptance criteria:

- tests cover axial-to-cube invariant, neighbors, distance, hex-to-pixel, pixel-to-hex, rounding at hex edges, line drawing, ranges, and pathfinding around blocked hexes;
- math package has no renderer imports.

### 3. Map Artifact Agent

Responsibilities:

- define the static map artifact format;
- build a small fixture map and a large stress-test map;
- validate map data before rendering.

Suggested artifact shape:

```ts
interface HexMapArtifact {
  schemaVersion: 1;
  layout: {
    orientation: "pointy" | "flat";
    hexSize: number;
    origin: { x: number; y: number };
  };
  hexes: Array<{
    id: string;
    q: number;
    r: number;
    terrainId: string;
    elevation: number;
    moisture?: number;
    regionId?: string;
    passable: boolean;
  }>;
  regions?: Array<{
    id: string;
    label: string;
    color: string;
  }>;
}
```

Rules:

- static map data is loaded once and indexed;
- dynamic hover, selection, routes, and debug overlays are separate runtime state;
- no gameplay data is stored in hexes during the map-only phase.

Acceptance criteria:

- fixture maps load through the same validation path;
- invalid duplicate IDs, invalid coordinates, missing terrain IDs, and malformed region references fail loudly;
- derived indexes are built once per artifact.

### 4. Babylon Renderer Agent

Responsibilities:

- create the renderer shell;
- own Babylon engine, scene, camera, render loop, materials, meshes, and disposal;
- keep the renderer API framework-neutral.

Suggested modules:

```text
src/map/renderer/HexMapRenderer.ts
src/map/renderer/babylon/createBabylonHexRenderer.ts
src/map/renderer/babylon/babylonCamera.ts
src/map/renderer/babylon/babylonScene.ts
src/map/renderer/babylon/disposeBabylonResources.ts
```

Renderer interface:

```ts
interface HexMapRenderer {
  mount(container: HTMLElement): void;
  dispose(): void;
  setMapArtifact(artifact: HexMapArtifact): void;
  setCamera(camera: HexCameraState): void;
  setOverlayState(state: HexMapOverlayState): void;
  pickHex(screenX: number, screenY: number): string | null;
}
```

Rules:

- render loop is centralized; do not let UI components trigger uncontrolled render loops;
- all Babylon resources must have explicit disposal;
- camera state and map state must be serializable plain data outside Babylon internals;
- use one active requestAnimationFrame/render loop discipline.

Acceptance criteria:

- renderer mounts and disposes without leaking canvases or WebGL contexts;
- static terrain renders from a fixture artifact;
- camera pan/zoom works without React re-rendering every frame;
- renderer can be tested with a headless smoke path where practical.

### 5. Terrain Mesh And Shader Agent

Responsibilities:

- generate terrain mesh data from the static artifact;
- support chunking and future shader-based noisy boundaries;
- avoid rebuilding full mesh during pan/zoom.

Suggested modules:

```text
src/map/terrain/buildHexTerrainChunks.ts
src/map/terrain/buildHexCornerMesh.ts
src/map/terrain/terrainPalette.ts
src/map/terrain/noisyTerrainMaterial.ts
```

Implementation phases:

1. Flat terrain color per hex.
2. Chunked terrain meshes by map-space bounds.
3. Region and terrain border lines.
4. Shader-ready corner/dual data for noisy terrain transitions.
5. Optional high-quality material using deterministic noise.

Rules:

- terrain mesh is rebuilt only when the artifact changes;
- large maps are chunked;
- material uniforms are updated without regenerating geometry;
- noisy boundaries are visual-only and must not change picking or pathfinding.

Acceptance criteria:

- terrain renders correctly on small and large fixtures;
- chunk count, draw calls, vertex count, and mesh build time are measured;
- visual noisy mode can be disabled for debugging.

### 6. Picking And Interaction Agent

Responsibilities:

- convert pointer positions to world coordinates and hex IDs;
- maintain hover and selection state;
- expose map interactions to a future UI without coupling to gameplay.

Suggested modules:

```text
src/map/interaction/pointerToWorld.ts
src/map/interaction/pickHex.ts
src/map/interaction/hexSelectionState.ts
src/map/interaction/mapInputController.ts
```

Rules:

- prefer math-based picking from screen ray/ground-plane intersection to axial rounding;
- Babylon mesh picking may be used for debug, but math picking should be canonical for speed and consistency;
- pointer move work must be throttled to frame cadence;
- hover state updates only when the picked hex changes.

Acceptance criteria:

- clicking the visual center of every fixture hex returns that hex;
- edge and corner rounding tests are deterministic;
- no pick returns a hex outside the artifact bounds;
- hover updates stay smooth on stress maps.

### 7. Overlay Agent

Responsibilities:

- render map overlays independently from terrain;
- support selection rings, hover outlines, region fills, borders, movement paths, and debug coordinates.

Suggested modules:

```text
src/map/overlays/selectionOverlay.ts
src/map/overlays/regionOverlay.ts
src/map/overlays/borderOverlay.ts
src/map/overlays/pathPreviewOverlay.ts
src/map/overlays/debugOverlay.ts
```

Rules:

- overlays consume derived indexes and explicit overlay state;
- do not scan every hex every frame;
- static overlays are rebuilt only when map artifact or layer visibility changes;
- dynamic overlays update only their changed instances or line meshes.

Acceptance criteria:

- hover and selection are visible;
- region overlay can be toggled;
- route preview renders from a list of hex IDs;
- debug overlay can show IDs/coordinates only in development mode.

### 8. Performance Agent

Responsibilities:

- define budgets before optimizing;
- add repeatable tests and instrumentation;
- prevent accidental full-map work during interaction.

Initial budgets:

- initial small-map render: under 1 second on a development machine;
- pan/zoom frame time: target 16.7 ms, warning above 33 ms;
- hover picking: below 2 ms average on large fixture;
- terrain mesh build: measured and reported for 10k, 50k, and 100k hex fixtures;
- draw calls: bounded by chunks and overlay layers, not by hex count.

Instrumentation:

- mesh build time,
- chunk count,
- vertex/index counts,
- draw calls where available,
- frame time rolling average,
- pointer pick duration,
- overlay update duration.

Acceptance criteria:

- `npm run test` covers math and artifact validation;
- `npm run perf:map` reports fixture metrics;
- performance reports are bounded and do not store unbounded frame history.

### 9. QA And Documentation Agent

Responsibilities:

- write setup docs and implementation notes;
- keep an acceptance checklist;
- capture screenshots or short clips for visual milestones.

Deliverables:

- `docs/map-implementation-guide.md`,
- `docs/map-test-plan.md`,
- fixture screenshots,
- release checklist for the map-only milestone.

Acceptance criteria:

- a new developer can run the map demo from the README;
- known limitations are listed;
- no wraparound tasks are left as hidden TODOs.

## Recommended Build Order

### Phase 0: Repository Bootstrap

- Create the project skeleton.
- Add TypeScript strict config.
- Add Vite.
- Add Babylon.js.
- Add Vitest.
- Add lint/typecheck/test scripts.
- Add ADR and map scope docs.

Exit criteria:

- empty app boots;
- tests run;
- ADR explains renderer choice.

### Phase 1: Hex Math Foundation

- Implement axial/cube coordinate utilities.
- Implement layout conversion.
- Implement rounding and picking math helpers.
- Implement neighbors, distance, line, range, and pathfinding.

Exit criteria:

- math tests pass;
- no Babylon dependency in math modules.

### Phase 2: Artifact Loading

- Define map artifact schema.
- Add small and large fixture maps.
- Build indexes: hex by ID, coordinate to ID, hexes by chunk, hexes by region, neighbors by hex.

Exit criteria:

- artifact validation tests pass;
- derived indexes are immutable and reusable.

### Phase 3: Babylon Terrain MVP

- Mount Babylon canvas.
- Create orthographic camera.
- Render flat terrain hexes.
- Add pan and zoom.
- Add resize handling and disposal.

Exit criteria:

- user can pan/zoom a visible map;
- no wraparound behavior exists.

### Phase 4: Picking And Basic UX

- Implement pointer-to-world conversion.
- Implement hex picking through axial rounding and artifact bounds check.
- Add hover and selected hex outlines.
- Add debug HUD for FPS, picked hex, camera, and draw stats.

Exit criteria:

- clicks select the expected hex;
- hover remains smooth.

### Phase 5: Region And Border Overlays

- Render region fills.
- Render terrain and region borders.
- Add layer toggles.
- Keep overlay rebuilds bounded.

Exit criteria:

- region visualization is clear;
- toggling overlays does not rebuild terrain.

### Phase 6: Route Preview

- Render line/strip path previews from hex ID lists.
- Add pathfinding demo mode with blocked hexes.
- Throttle pointer-driven preview updates.

Exit criteria:

- route preview is correct and responsive;
- pathfinding remains in math/domain modules.

### Phase 7: Noisy Terrain Visual Mode

- Add corner/dual mesh data or equivalent shader-ready geometry.
- Add deterministic noise material inputs.
- Keep flat mode as a debug fallback.

Exit criteria:

- noisy boundaries improve visual quality without changing coordinates, picking, or pathfinding;
- shader mode can be turned off.

### Phase 8: Performance Hardening

- Add large fixture performance command.
- Add bounded metrics overlay.
- Ensure panning does not rebuild meshes or indexes.
- Document current budget results.

Exit criteria:

- map-only demo has repeatable performance reports;
- known bottlenecks are documented.

## Definition Of Done For Map-Only MVP

The map-only MVP is done when:

- Babylon renders the fixture map;
- axial/cube math is tested;
- hex-to-pixel and pixel-to-hex are tested;
- hover and click picking are accurate;
- pan and zoom are smooth;
- selection, region, border, and route overlays exist;
- terrain mesh is chunked or has a documented reason why chunking is deferred;
- noisy terrain mode exists or has a documented shader-ready intermediate milestone;
- no wraparound support is implemented;
- no gameplay mechanics are embedded in the renderer;
- performance measurements are available for small and large fixtures;
- all resources dispose cleanly.

## Guardrails For Future Agents

- Do not add wraparound unless a new ADR explicitly approves it.
- Do not mix gameplay rules into renderer modules.
- Do not store mutable game state in Babylon mesh metadata.
- Do not use offset coordinates as the canonical internal format.
- Do not rebuild terrain meshes during pan, zoom, hover, or selection.
- Do not scan all hexes every frame for overlays.
- Do not make shader visuals authoritative for picking or movement.
- Do not hide invalid artifact data behind fallbacks.
- Do not leave unbounded frame logs, debug arrays, or metric histories.
