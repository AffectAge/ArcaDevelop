---
name: arcanorum-ui-change
description: Implement or review Arcanorum player UI, HUD, menus, modals, tooltips, map controls, responsive layouts, accessibility, localization, theme tokens, or Arcawiki visibility. Use for changes under apps/client/src/components, client styles, localization, scenario themes, or player-facing flows.
---

# Arcanorum UI change

1. Read root and client `AGENTS.md`, `docs/accessibility.md`, `docs/localization.md`, `docs/theme-system.md`, and `apps/client/src/components/templates/DEMO_ELEMENTS.md`.
2. Reuse demo template components and scenario theme tokens. Add no hardcoded visible strings, colors, spacing, radii, or shadows.
3. Add every visible string as an English and Russian localization key. Translate stable server error codes; do not expose raw server errors.
4. Design mobile-first for portrait safe areas and at least `390x844`. Protect the playfield, use at least 44-by-44 CSS-pixel touch targets, and avoid overlapping critical HUD controls.
5. Preserve semantic HTML, keyboard operation, visible focus, modal focus management, contrast, non-color cues, and reduced-motion behavior.
6. Follow tooltip-first development for visible mechanics and values. Explain meaning, current causes, positive/negative sources, modifiers, and gameplay effect.
7. Run client typecheck, relevant component/unit tests, and browser playtests at portrait and desktop sizes. Capture console errors and report skipped accessibility or visual checks.

If a reusable template changes, update its export, demo gallery, and `DEMO_ELEMENTS.md`.
