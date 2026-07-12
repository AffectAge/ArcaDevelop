# Project Assets Agent Guide

Always start from root `AGENTS.md` and `docs/README.md` before using this folder guide.

Use this guide for `project_assets`.

- Store only source/reference assets and project-owned asset working files here.
- Do not store secrets, credentials, private player/admin data, or `.env` files.
- Scenario-authored runtime assets belong in scenario data under `apps/server/data/scenarios/<scenario_id>/common/assets/*.json` and generated/runtime upload paths, not as ad-hoc references from code.
- Keep asset IDs stable when assets are referenced by scenario data.
- Large generated outputs should be documented and reproducible rather than manually edited.
