# Server Routes Agents

Always start from root `AGENTS.md` and `docs/README.md` before using this folder guide.

Use this guide for Express route modules under `apps/server/src/routes`.

Routes should stay thin:

- receive dependencies explicitly from `index.ts` or a server context object,
- validate request input at the boundary,
- call domain/runtime/persistence helpers for game rules,
- use shared security helpers such as `routeAuth`,
- preserve stable error codes and cleanup behavior,
- avoid direct cross-route state ownership.

Do not add heavy mechanics, persistence schemas, or scenario format rules inside route modules.
