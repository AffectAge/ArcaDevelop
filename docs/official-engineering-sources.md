# Official engineering sources

Arcanorum's repository standards adapt these primary sources. Project rules may be stricter because they also encode the authoritative-server world model, scenario ownership, localization, performance budgets, and cleanup lifecycle.

## Agent configuration

- [OpenAI: Custom instructions with AGENTS.md](https://learn.chatgpt.com/docs/agent-configuration/agents-md) — keep instructions practical and durable; use nested files for directory-specific rules.
- [OpenAI: Build skills](https://learn.chatgpt.com/docs/build-skills) — put repeatable workflows in progressively disclosed project skills under `.agents/skills`.

## TypeScript and JavaScript

- [TypeScript TSConfig reference](https://www.typescriptlang.org/tsconfig/) and [project references](https://www.typescriptlang.org/docs/handbook/project-references.html) — strict typing, explicit compiler boundaries, and scalable workspace checks.
- [ESLint configuration files](https://eslint.org/docs/latest/use/configure/configuration-files) and [rules](https://eslint.org/docs/latest/rules/) — executable code-quality rules; project exceptions must be narrow and explained.
- [Node.js ECMAScript modules](https://nodejs.org/api/esm.html) — module behavior for server and build scripts.

## React and web accessibility

- [React rules](https://react.dev/reference/rules) — components and hooks stay pure, hooks run at the top level, and React owns component state transitions.
- [WCAG 2.2](https://www.w3.org/TR/WCAG22/) — keyboard access, focus visibility, contrast, target size, and non-color meaning.
- [MDN semantic HTML](https://developer.mozilla.org/en-US/docs/Glossary/Semantics#semantics_in_html) — prefer native elements and semantics before custom ARIA behavior.

## Phaser and map runtime

- [Phaser TilemapLayer API](https://docs.phaser.io/api-documentation/class/tilemaps-tilemaplayer) — standard tile layers, cameras, and culling.
- [Phaser RenderTexture concepts](https://docs.phaser.io/phaser/concepts/gameobjects/render-texture) — bounded compositing when a static cached surface is appropriate.
- [Phaser download and releases](https://phaser.io/download) — dependency source and current release information.

## Applying these sources

1. Use `docs/programming-standards.md` for daily code rules and this page for primary-source rationale.
2. Prefer automated enforcement through TypeScript, ESLint, tests, validators, and reproducible asset scripts.
3. Record major deviations or dependency choices in an ADR or dependency note.
4. Re-check links and upstream guidance when changing the related standard; do not copy large external passages into the repository.
