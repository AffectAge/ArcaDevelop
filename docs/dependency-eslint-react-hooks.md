# Dependency request: React Hooks ESLint rules

## Package

- `eslint-plugin-react-hooks@^7.1.1` (development only)

## Decision

Use the official React-team flat-config `recommended` rules for TypeScript/TSX files under `apps/client/src`. Core hook ordering is an error; `exhaustive-deps` and newer compiler-oriented rules begin as visible warnings while the pre-existing client backlog is migrated. New and touched code must not add warnings. This turns React's rules into an executable repository gate without hiding legacy findings or blocking unrelated server work.

## Cost and compatibility

- No browser or server runtime code.
- Supports ESLint 10 and Node.js 18 or newer.
- MIT license and maintained in the React repository.
- Removal requires deleting the client rule block from `eslint.config.mjs`; application code has no import coupling.

## Alternatives

- Manual review only: rejected because hook-order and dependency-array regressions are deterministic and automatable.
- A third-party general React plugin: not required for this scope; semantic HTML, TypeScript, accessibility guidance, and the existing compiler cover the remaining immediate needs.

## Sources

- [React: eslint-plugin-react-hooks](https://react.dev/reference/eslint-plugin-react-hooks)
- [Official package and flat-config usage](https://www.npmjs.com/package/eslint-plugin-react-hooks)
