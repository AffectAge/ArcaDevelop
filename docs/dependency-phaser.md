# Dependency Request: Phaser Hex Map Runtime

## Requested Package

- `phaser@^4.2.1`

## Reason

Arcanorum needs a maintained 2D game runtime for a pointy-top hex map, camera/input handling, visible-tile culling, texture atlases, and sparse sprite layers. The standard Phaser hex `TilemapLayer` supports the required orientation and camera culling without Arcanorum maintaining custom WebGL shaders or mesh upload code.

The dependency is isolated behind `apps/client/src/map/rendering`. React remains the owner of the DOM interface; shared and server packages do not import Phaser.

## Alternatives Considered

- Keep PixiJS: rejected because the current implementation accumulated a custom mesh/shader/material pipeline and a large imperative renderer inside `MapView`.
- DOM/CSS hexes: rejected because the target visible density and pan/zoom behavior exceed a practical DOM object budget.
- Phaser GPU tile layer: rejected because the specialized layer does not support hexagonal maps and relies on the shader-oriented path this change intentionally avoids.
- Canvas 2D only: retained as a possible Phaser fallback, not as a separate runtime.

## Status

Installed in the client workspace. The legacy Pixi package and live client renderer modules have been removed after typecheck, focused tests, atlas validation, and portrait browser smoke testing.

## Constraints

- No custom shaders, custom WebGL materials, or custom terrain meshes.
- Only bitmap textures and normal Phaser tile/image/sprite objects.
- Pointy-top rectangular offset geometry and optional horizontal wrap remain canonical.
- Gameplay and path validation remain server authoritative.
- Renderer changes must continue to pass desktop and portrait-mobile performance gates.

## Removal

Remove `phaser` if the renderer is replaced. Renderer-specific code must stay below `apps/client/src/map/rendering` so removal does not affect shared gameplay contracts.

## Sources

- [Phaser download and current release](https://phaser.io/download)
- [Phaser standard TilemapLayer](https://docs.phaser.io/api-documentation/class/tilemaps-tilemaplayer)
