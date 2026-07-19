# New Folder Proposal: Project Map Art

## Summary

- Path: `project_assets/map-art/`
- Purpose: project-owned source palettes and provenance needed to reproducibly build runtime map atlases.
- Task/feature requiring it: painterly 2D hex-map visual refresh and deterministic `map-assets:build` packaging.

## Fit Check

- Existing folders considered: `apps/client/public/game-assets/` and scenario `common/assets/`.
- Why existing folders do not fit: `public/game-assets` is generated runtime output, while scenario assets are authored scenario content with stable `asset:*` ownership. Neither is an appropriate source-art workspace.
- Why this name is stable: it describes a durable asset domain, not one atlas, renderer experiment, or temporary use case.

## Boundaries

- Allowed contents: original source palettes/frames, project-owned working references, provenance and licensing manifests, and source-build notes.
- Forbidden contents: generated runtime atlases, scenario uploads, direct scenario asset URLs, secrets, credentials, private player/admin data, `.env` files, or third-party/Civilization assets without an approved license record.
- Public interfaces: none. Runtime clients consume only generated files under `apps/client/public/game-assets/`.
- Owner/subsystem: client map presentation and project asset pipeline.
- Related docs: `project_assets/AGENTS.md`, `docs/folder-structure.md`, `docs/libraries.md`, `docs/theme-system.md`, and `docs/commands.md`.
- Related tests: `scripts/map-art-manifest.test.ts` validates provenance/output parity and SHA-256 content hashes.

## Architecture

- ADR required: no.
- Reason: the folder does not change runtime boundaries or expose a protocol; the worker/chunk renderer and generated client artifact format are covered by their architecture ADR.
- Import/export strategy: application code never imports this folder. `npm run map-assets:build` reads its strict JSON sources and writes deterministic runtime assets plus a content-hash manifest.
- Cleanup/ownership implications: removing an output requires removing it from provenance, the build script, runtime references, and tests in the same change. Generated outputs are replaced by the build command, not manually edited.
- Commands affected: `npm run map-assets:build`.

## Final Review

- `docs/folder-structure.md` updated: yes.
- Relevant `AGENTS.md` updated: existing `project_assets/AGENTS.md` already defines the required ownership and safety boundaries.
- Docs/commands updated if needed: yes, `docs/commands.md` documents the reproducible build.
