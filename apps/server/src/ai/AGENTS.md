# Server AI Module Agent

This folder contains deterministic AI support code: context builders, indexes, fixture harnesses, rule filters, scoring, plans, and future AI order generation.

Phase rules:

- Context and index builders must be pure or mostly pure and must not mutate `WorldBase`.
- AI must not directly mutate world state; future generated actions must become normal server-validated orders.
- Avoid repeated full-world scans in hot AI ticks; derive indexes once per world snapshot and pass them into country context builders.
- Keep debug or explanation data test-only/admin-only. Do not expose raw utility scores to players.
- Scenario-owned config and AI profiles own budgets, weights, and bonuses.
