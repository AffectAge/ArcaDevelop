# Review Checklist

Use this checklist when reviewing code, docs, scenario data, or AI-generated changes.

## Scope

- Does the change match the requested task?
- Are unrelated refactors avoided or explicitly approved?
- Are deleted/replaced mechanics fully removed from code, data, docs, UI, tests, and assets?

## Programming Standards

- Does new/touched code follow `docs/programming-standards.md`?
- Does any folder/file movement follow `docs/folder-structure.md`?
- If a new non-trivial folder was added, is there a New Folder Proposal with purpose, boundaries, public interfaces, docs/tests, and ADR decision?
- Is domain logic separated from UI, transport, persistence, filesystem, and third-party adapters?
- Do functions have one clear responsibility?
- Are calculations/validation/mutation/persistence/transport kept separate where practical?
- Are names specific enough to be clear but broad enough for reusable domain responsibility?
- Are `any`, broad casts, and suppressions limited to boundary adapters?
- Are hidden fallback/defaulting and silent behavior changes avoided?

## Region Model

- Are heavy mechanics region-based?
- Did the change avoid new province-level population/buildings/construction/resources/colonization/diplomacy transfer?
- Are zero-territory countries handled?

## Security And Permissions

- Are admin/privileged operations enforced server-side?
- Are sensitive endpoints rate-limited or considered for rate limits?
- Are player/admin secrets and private data excluded from logs?
- Are raw server errors hidden from players?

## API/WS And Shared Contracts

- Are payloads typed?
- Are stable error codes used?
- Are shared/server/client updates synchronized?
- Are ACK/replay/idempotency/concurrency impacts considered?

## Data Lifecycle

- Does every new entity have ownership and cleanup behavior?
- Are uploaded assets scenario-owned?
- Are orphan references and orphan assets prevented or cleaned?
- Are destructive operations audited and confirmed?

## Client/UI

- Is all visible text localized in English and Russian?
- Are theme tokens used instead of hardcoded visual values?
- Is accessibility preserved?
- Are important actions consequence-aware?

## Performance And Observability

- Are hot paths free of unjustified full-world scans?
- Are metrics bounded?
- Are performance budgets considered for map, resolver, AI, WS, and scenario loading?

## Tests And Docs

- Are relevant tests added/updated?
- Are docs/Arcawiki updated when player or developer understanding changes?
- Is an ADR added for major architecture/protocol/persistence/AI/scenario/dependency decisions?
- Does the final report list checks, skipped checks, risks, and mitigations?
