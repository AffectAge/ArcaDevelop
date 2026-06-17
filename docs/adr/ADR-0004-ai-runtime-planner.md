# ADR-0004: AI Runtime Planner Before AI Execution

## Status

Proposed

## Context

- Problem: the AI subsystem can now derive contexts, candidates, scores, and crisis assessments, but there is no runtime layer that applies scenario AI budgets consistently before a future executor submits selected actions.
- Constraints: AI must not directly mutate `WorldBase`; generated actions must become normal server-validated orders or validated API-equivalent requests; AI must avoid repeated full-world scans and must obey scenario-owned budget/config keys.
- Why this matters now: connecting candidates directly to turn execution without a planner would risk bypassing budgets, validation boundaries, deterministic ordering, or rejection diagnostics.

## Options

- Option A: let each AI behavior module submit orders directly. This is rejected because it spreads mutation risk and budget handling across modules.
- Option B: add a read-only runtime planner first, then add a separate executor/adapter later. This preserves deterministic planning and keeps execution validation separate.
- Option C: delay all runtime work until every candidate type is feature-complete. This is rejected because it postpones budget and orchestration testing too long.

## Decision

- Chosen option: Option B. Add a read-only AI runtime planner that builds indexes once, processes a bounded deterministic country list, gathers candidates from provider modules, caps candidates per country, scores candidates with profiles, and returns selected draft actions without submitting or mutating anything.
- Why: this creates the runtime seam needed for future validated order submission while keeping the current PR safe, testable, and reversible.

## Consequences

- Benefits: scenario AI budget keys are consumed by runtime planning; planning can be tested without persistence or turn execution; future executor code receives already-scored draft actions.
- Risks: duplicate candidate identity logic may need to move into a shared helper as more candidate kinds are added.
- Migration/removal work: no data migration is needed because the planner is read-only and not wired into turn execution.
- Compatibility decision: existing AI candidate modules remain unchanged and can be connected through provider adapters.
- Follow-up tasks: add a validated executor/adapter for one safe economy order slice, then expand to route-backed upgrade/diplomacy/market actions.

## Verification

- Tests: planner unit tests must cover disabled AI, country/candidate budgets, deterministic ordering, strategy-profile scoring, and no world mutation.
- Docs: AI development docs must describe the planner/executor split and validation boundary.
- Metrics: future executor work should add bounded diagnostics for processed countries, candidate counts, selected actions, and rejected submissions.
- Review checklist: verify there is no direct world mutation, no hidden fallback, no AI cheat, and no repeated per-country full-world index build.
