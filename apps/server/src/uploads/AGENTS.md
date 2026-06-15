# Uploads Agents

Always start from root `AGENTS.md` and `docs/README.md` before using this folder guide.

Use this guide for `apps/server/src/uploads`.

Also read:

- `apps/server/AGENTS.md`
- `docs/security-baseline.md`
- `docs/data-deletion-lifecycle.md`
- `docs/entity-ownership.md`
- `docs/programming-standards.md`

## Upload Ownership

Upload code must keep ownership, scenario scope, validation, and cleanup explicit. Do not add a new uploaded asset type without checking deletion lifecycle, permissions, audit behavior, and scenario ownership.

Uploaded files are scenario-owned runtime assets. Store them under `apps/server/data/scenarios/<scenario_id>/assets/uploads/` and expose them as `/scenario-assets/<scenario_id>/assets/uploads/<relative_path>`. Do not reintroduce a global `apps/server/uploads` root or `/uploads/...` public URL.

## Validation

Validate file type, size, dimensions, and expected usage before accepting uploads. Do not trust client-provided filenames, MIME types, ownership, or target entity IDs without server-side checks.

## Paths

Centralize upload directories and URL segment rules in this folder. Do not spread hardcoded upload subpaths through route handlers or domain code.

## Cleanup

When removing countries, content entries, mechanics, or scenarios, delete or orphan-plan owned uploads and report the cleanup behavior. Destructive cleanup should support dry-run/preview where practical.
