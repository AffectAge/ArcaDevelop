# Accessibility

Arcanorum UI must remain usable under custom scenario themes and dense strategy-game workflows.

## Baseline

- Keyboard navigation for important flows.
- Visible focus states.
- Sufficient contrast.
- Readable font sizes.
- No color-only meaning.
- Tooltips or labels for icon-only controls.
- Dialogs trap focus and close predictably.
- Important destructive actions explain consequences.

## Themes

Scenario themes must not break readability. Theme validation should check core contrast pairs and fall back only as documented technical safety.

## Map Rendering

- Map ownership, control, selection, reachable areas, and unit status must not rely on color alone; use borders, patterns, banners, glyphs, or distinct silhouettes.
- Country/city labels must retain a contrasting outline or backing under every supported map palette.
- Map water is always static. `prefers-reduced-motion` disables the remaining non-essential map pulses while preserving pan/zoom and selection feedback.
- Canvas labels are supplementary: selected hex, city, unit, terrain, movement, and validation details remain available through keyboard-accessible DOM HUD/tooltips.
