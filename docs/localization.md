# Localization

All visible UI text must use localization keys with English and Russian values.

## Rules

- No new hardcoded player-facing text in JSX/TS.
- API/WS errors return stable codes; client maps codes to localized text.
- Scenario content should use localized fields or localization keys.
- Arcawiki entries must support English and Russian.
- Player-provided content is not auto-translated unless a specific system is approved.
- Missing localization must be treated as a validation error, not silently hidden by gameplay fallback.

## Current Client Registry

Minimal guarded client UI strings live in `apps/client/src/i18n/uiText.ts`. New strings in guarded UI primitives, map HUD components, and client settings must be added there with both `en` and `ru` values, then referenced by key. The active UI locale is stored locally in the browser and exposed through `apps/client/src/i18n/useUiText.ts`. Broader obsolete UI is being migrated incrementally; do not use that obsolete state as precedent for new components.

Map streaming and graphics failures have separate localized descriptions for artifact unavailability, worker failure, artifact-version mismatch, and unrecoverable WebGL context loss. Retry controls are localized too; raw worker, fetch, shader, or renderer exception text must not be shown to players.

## Key Style

Use stable namespaces:

- `ui.*`
- `error.*`
- `admin.*`
- `arcawiki.*`
- `country.*`
- `region.*`
- `content.*`
- `ai.*`

## Plurals And Formatting

Use localization-aware number/date/plural formatting. Do not concatenate translated sentence fragments when grammar may differ by language.
