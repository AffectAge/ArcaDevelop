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
