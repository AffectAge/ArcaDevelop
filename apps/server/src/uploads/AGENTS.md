# Uploads guide

Always start from root `AGENTS.md` and `docs/README.md`.

- Uploads are scenario-owned runtime assets under `apps/server/data/scenarios/<scenario_id>/assets/uploads/` and URLs under `/scenario-assets/<scenario_id>/assets/uploads/`.
- Centralize path and URL rules here; do not trust client filenames, MIME types, owners, scenario IDs, or entity IDs.
- Validate authorization, type, size, dimensions, content, ownership, and expected use before accepting a file.
- New asset types require entity ownership, permissions, audit, rate-limit, and deletion-lifecycle decisions.
- Removal cleans owned files or records an orphan/migration plan. Use exact scenario-scoped targets and preview/dry-run where practical.
- Never reintroduce global upload roots or public `/uploads/...` URLs.
