# Client Agents

Always start from root `AGENTS.md` and `docs/README.md` before using this folder guide.

Use this guide for `apps/client`.

Also read:

- `docs/accessibility.md`
- `docs/engineering-standards.md`
- `docs/security-baseline.md`
- `docs/api-ws-versioning.md`
- `docs/performance-budgets.md`

## UI And Localization Agent

All visible UI text must use localization keys with English and Russian values. Do not add inline player-facing text.

When changing UI:

- use design tokens and scenario theme variables,
- ensure all visible UI text uses localization keys with English and Russian values,
- keep important actions consequence-aware and localized,
- preserve keyboard and accessibility behavior,
- explain failed player actions with localized reasons,
- make new mechanics player-visible through UI and explanatory tooltips,
- explain country resource totals and per-turn changes from ledger balances when ledger entries are available,
- show ledger `labelKey` through localization; raw source ids are allowed only in admin/debug surfaces,
- ensure tooltips for important values explain meaning, current causes, increasing/decreasing sources, modifiers, and gameplay effects,
- do not expose raw server error messages to normal players.
- do not hardcode UI text, colors, theme values, or balance values.
- map server error codes to localized player-facing text.

## Accessibility Agent

New and changed UI must support:

- keyboard navigation for important flows,
- visible focus states,
- sufficient contrast under scenario themes,
- readable text sizes,
- no color-only meaning,
- labels/tooltips for icon-only controls,
- predictable modal focus behavior.

## Region UI Agent

Player-facing heavy mechanics should be presented at region/state level:

- region population,
- region buildings,
- region construction,
- region resources,
- region colonization,
- region transfers in diplomacy,
- region economy/taxes.

Province UI remains appropriate for:

- map hover/selection,
- terrain/climate,
- movement paths,
- adjacency,
- local passability and movement cost.

Avoid UI that implies provinces are the main unit for heavy mechanics unless explicitly approved.

## Map And Movement Agent

The map is province-based for rendering and unit movement. New map layers must respect frame budget and large-world performance:

- avoid long main-thread tasks during pan/zoom,
- use memoization or viewport filtering,
- keep overlays bounded,
- test with large province counts when relevant.
- report when map frame performance was not verified.

Region overlays should aggregate province shapes while actions target region IDs.

## Admin AI Controls Agent

Admin UI for AI should remain minimal unless separately approved:

- country control mode: `player`, `ai`, `open`,
- AI profile selection,
- takeover status,
- clear indication that switching control clears current orders/plans.

Detailed AI editing remains scenario-file driven.

## Arcawiki Agent

Arcawiki is player-facing only. It explains mechanics, strategy, UI concepts, and scenario lore. It is not technical developer documentation.

Update Arcawiki when player understanding changes because of mechanics, region ownership, colonization, diplomacy, AI, or movement changes.
