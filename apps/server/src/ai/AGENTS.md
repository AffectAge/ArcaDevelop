# AI module guide

- Keep context/index builders pure and derive indexes once per world snapshot.
- AI emits normal server-validated orders and never mutates `WorldBase` directly.
- Scenario profiles own weights, budgets, strategies, and explicit bonuses.
- Avoid per-country full-world scans; test filters, scoring, fixtures, and multi-turn metric ranges.
- Raw utility/debug data is admin/test-only. Player outcomes are localized narrative records.
