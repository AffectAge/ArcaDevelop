# AI Operating Boundaries

AI agents may help design, edit, test, and document Arcanorum, but they must operate inside explicit engineering boundaries.

## Required Behavior

- Read relevant `AGENTS.md` and docs before changing a subsystem.
- Keep changes scoped to the task unless the user explicitly approves broader cleanup.
- Explain risky tradeoffs before implementing them.
- Report checks run, checks skipped, remaining risks, and likely failure modes.
- Use stable project commands; if a needed command does not exist, propose or add it intentionally.
- Keep automated guard checks current when adding enforceable prohibitions. `scripts/check-code-guards.ts` is the first line of defense for narrow, high-confidence code patterns.

## Hard Prohibitions

Agents must not:

- add hidden gameplay fallback, silent repair, implicit migration, or auto-defaulting without approval or technical-safety documentation,
- add dependencies without approval and rationale,
- bypass TypeScript with `any`, `@ts-ignore`, or broad casts outside boundary adapters,
- add hardcoded UI text, colors, theme values, or balance constants,
- enforce admin/security only on the client,
- expose raw server errors to players,
- add full-world scans in hot paths without justification,
- perform destructive operations without confirmation, audit, and dry-run where practical,
- create data/assets outside scenario ownership,
- leave dead code/data/assets after removing a mechanic,
- add province-level heavy mechanics without explicit approval,
- mix silent balance changes into refactors,
- log secrets or private player/admin data,
- use third-party runtime services without explicit permission,
- leave temporary hacks undocumented in the final report.

## Temporary Work

Temporary code is allowed only when:

- the user approves it or it is required to restore safety,
- it is isolated,
- it is documented in the final report,
- there is a follow-up removal or replacement path.
