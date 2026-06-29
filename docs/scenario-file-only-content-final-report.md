# Scenario File-Only Content Final Report

## Done

- What changed:
  - Scenario `common/*/*.json` is now the authored content source; legacy `content/*.json` loading was removed.
  - Added `AssetContentEntry` and `GameSettings.content.assets` for stable `asset:*` registry entries.
  - Scenario validation now rejects authored asset URL fields (`logoUrl`, `flagUrl`, `crestUrl`, direct URLs) and validates declared local assets.
  - `GameState` persistence no longer writes authored `gameSettings.content`; restore replaces content from the active scenario files.
  - Removed the client ContentPanel entry point and deleted server authored-content mutation routes.
  - Default scenario was expanded with Victoria-like goods, buildings, and professions using current economy mechanics.
  - Missing building/city atlases are allowed so fallback atlases can cover dev content; authored atlas files are still dimension-validated.
  - Added strict no-compatibility rules to project docs and `.codex/project-rules.json`.
  - Added a client `asset:*` resolver that maps stable scenario asset ids to `/scenario-assets/<scenarioId>/assets/...`.
  - Restored content catalog access as read-only `/content/...` routes with scenario asset registry metadata; admin mutation routes remain removed.
  - Added a read-only admin Scenario Status block with server validation status, content counts, asset counts, and generated authored hash when available.
- Why:
  - Scenarios should work like file-authored mods, not admin-edited runtime content.
  - Stable IDs and local asset registry entries make scenario content reproducible and mod-friendly.
  - Removing content mutation UI/API prevents authored content from drifting away from files.
- Files/areas changed:
  - Server scenario loading/validation/runtime restore/persistence.
  - Client shell/topbar/content UI.
  - Client asset resolving and read-only content catalog API normalization.
  - Admin scenario metadata/status route and Game Settings scenario tab.
  - Default scenario goods/buildings/professions/localization.
  - Project rules and modding/database docs.

## Verification

- Checks run:
  - `npm run typecheck -ws`
  - `npm run scenario:validate -- --scenario default`
  - `npx vitest run apps/server/src/scenarios/scenarioContentLoader.test.ts apps/server/src/scenarios/scenarioValidation.test.ts apps/server/src/persistence/gameStatePersistence.test.ts apps/server/src/runtime/persistedGameSettingsRestore.test.ts apps/server/src/scenarios/scenarioRuntimeLoader.test.ts`
  - `npx vitest run apps/server/src/routes/contentReadRoutes.test.ts apps/server/src/routes/adminMetadataRoutes.test.ts apps/server/src/scenarios/scenarioCatalog.test.ts apps/client/src/assets/scenarioAssetResolver.test.ts`
  - Code audit searches for removed ContentPanel/content mutation entry points and authored URL fields in the default scenario.
- Checks skipped and why:
  - Full test suite was not run; targeted tests cover the changed loader, validator, persistence, restore, and scenario runtime paths.
  - Browser/UI smoke test was not run; this pass removed UI entry points rather than adding a new UI flow.
- Manual scenarios:
  - Default scenario validator reports `contentEntries: 62`.

## Required Updates

- Docs:
  - Updated `AGENTS.md`, `docs/modding-authoring.md`, `docs/database-rules.md`, and `.codex/project-rules.json`.
- Arcawiki:
  - Not updated; no player-facing Arcawiki topic was added.
- Localization:
  - Added EN/RU names for new default scenario goods, buildings, and professions.
  - Removed obsolete topbar/shell ContentPanel localization keys.
- Theme:
  - No theme changes.
- Defines:
  - No define values changed.
- Permissions/audit/rate limits:
  - Authored content mutation routes were removed from registration; no new privileged mutation flow was added.
- Cleanup/lifecycle:
  - Runtime player uploads for country customization remain separate and unchanged.
- Tests:
  - Updated scenario loader/validator tests for file-only content and fallback atlas policy.

## Risks

- Problems that may occur:
  - Old saved games that relied on persisted `gameSettings.content` will no longer restore authored content from DB.
  - Any external tooling still writing `content/*.json` or `common/journalEntries` will be ignored.
  - Some deleted ContentPanel API client helpers may remain unused in client API utilities until a broader cleanup.
- Why:
  - The change intentionally removes compatibility paths in favor of scenario files as source of truth.
- Possible mitigations:
  - Reset local dev DB/state when incompatible.
  - Move remaining read-only scenario status/admin diagnostics into a dedicated UI later.
  - Add a client asset resolver for `asset:*` fields when scenario-authored icons become required.

## Follow-Up

- What should still be done:
  - Add a shared `AssetContentEntry` contract package type instead of keeping server/client copies.
  - Replace remaining display URL content fields in non-authored runtime APIs where it makes sense.
  - Add route-level 404 tests proving removed authored content mutation routes are absent.
  - Expand default scenario further with sectors/industries/resource categories/equipment if those systems become required for balancing.
- Why it matters:
  - These follow-ups complete the modding UX and make asset references visible to the client without reintroducing runtime content editing.
