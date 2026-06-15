# Definition Of Done

Use this checklist for implementation tasks.

## Required Checks

- Code compiles with `npm run typecheck -ws`.
- Relevant tests are added or updated.
- Relevant scenario/content validation is run when scenario data changes.
- Public API/WS/types are documented when changed.
- UI text is localized in English and Russian.
- Theme/design tokens are used instead of hardcoded visual values.
- Permissions, audit, rate limits, and safe errors are considered for new mutations.
- Cleanup lifecycle is defined for created/removed entities.
- Arcawiki is updated when player-facing mechanics change.
- Technical docs are updated when architecture, data format, protocol, or operations change.
- Performance impact is considered for map, resolver, AI, WS, scenario loading, and hot paths.

## Final Report

Every final report must state:

- what was done and why,
- files or areas changed,
- checks run,
- checks skipped and why,
- remaining risks,
- likely failure modes,
- possible mitigations,
- follow-up work worth doing.
