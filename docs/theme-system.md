# Theme System

Scenario themes control the game look through approved design tokens.

## Source Of Truth

Theme values belong to scenario-owned theme config. UI code should consume tokens, not hardcoded visual values.

## Token Areas

- colors,
- semantic colors,
- backgrounds/surfaces,
- text colors,
- borders,
- focus rings,
- radii,
- spacing,
- shadows,
- density,
- chart palette,
- map overlay colors.

## Safety

- Use an allowlist of CSS variables/tokens.
- Reject arbitrary selectors, scripts, imports, and remote URLs.
- Validate color formats.
- Check important contrast pairs.
- Keep login/admin UI readable under custom themes.

## Agent Rule

New UI must work with default and custom scenario themes. Hardcoded colors/radii/spacing are review red flags.

## Phaser map tokens

The React-to-Phaser adapter resolves allowlisted `--arc-map-*` values from the active theme at initialization and whenever the theme revision changes. Selection, hover, reachable areas, paths, grid, region/country/controller borders, labels, unit banners, building markers, water, coasts, and rivers use these tokens rather than numeric colors embedded in renderer code.

Map theme revisions are coalesced to one update per animation frame. Changes to `class`, `style`, or `data-theme` on the document root or map surface are observed automatically; theme loaders that replace stylesheets or otherwise change computed tokens must dispatch the typed `arc:map-theme-revision` event after applying the new theme.

Screen-space border and label widths remain stable across camera scale. Ownership, control, movement validity, and unit status must also use a stroke, pattern, banner, glyph, or shape so custom themes do not make color the only signal.

Project-owned terrain and fallback atlas sources live under `project_assets/map-art/`, are built with `npm run map-assets:build`, and are loaded from `game-assets/phaser/`; scenario-owned atlas overrides continue to use stable `asset:*` references.
