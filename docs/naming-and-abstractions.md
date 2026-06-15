# Naming And Abstractions

Good names should describe stable responsibility, not only the first mechanic that uses the code.

## Core Rule

Name functions, types, modules, and files by what they do in the domain. Avoid naming reusable logic after one current feature if the logic is already broader.

Examples:

- Prefer `calculateMovementCost` over `calculateArmyMoveCost` if the function can apply to all unit movement.
- Prefer `resolveRegionOwnershipChange` over `applyColonizationWinner` if diplomacy, war, and colonization can all change ownership.
- Prefer `validateRegionAccess` over `validateColonizationProvinceAccess` if the rule is about access to a region.
- Prefer `normalizeRegionPops` over `normalizeStartingPopulationForScenarioImport` if it is the general region-pop normalizer.

## Do Not Over-Generalize

Do not invent generic names for code that is truly feature-specific.

Examples:

- `calculateColonizationProgress` is better than `calculateProgress` because the formula belongs to colonization.
- `validateTreatyRegionTransferClause` is better than `validateClause` because the rule belongs to one clause type.
- `buildArcawikiProvinceArticleDraft` is better than `buildArticleDraft` if it only handles that draft.

## Naming Checklist

Before naming a new function/type/module, ask:

- Is this domain logic, transport code, UI code, or persistence code?
- Is the responsibility stable across likely future mechanics?
- Would another mechanic reasonably reuse this without changing semantics?
- Does the name expose implementation details instead of intent?
- Does the name include obsolete terms like `province` for heavy mechanics that should be region-based?
- Is the name too vague, such as `handleData`, `processStuff`, `updateState`, or `doAction`?

## Function Names

Use verb phrases:

- `calculate*` for deterministic calculations.
- `validate*` for checks that return validation results or throw normalized errors.
- `normalize*` for converting raw input into safe typed shapes.
- `resolve*` for turn/mechanic resolution.
- `apply*` for applying an already-decided change.
- `build*` or `create*` for constructing new objects.
- `select*` or `derive*` for read-only projections.
- `load*` and `persist*` for IO boundaries.

Do not use `handle*` unless the function is genuinely an event/route handler.

## Type And Interface Names

- Domain types use nouns: `RegionClaim`, `CountryControlMode`, `AiPersonality`.
- Request/response types include transport context: `ApplyScenarioRequest`, `WorldSnapshotResponse`.
- Raw external shapes should include `Raw` or `Input`: `RawRegionHistory`, `RegionHistoryInput`.
- Validated domain shapes should not include `Raw`.

## Module Names

Module names should match ownership and responsibility:

- `domain/regions/ownership`
- `domain/ai/utilityScoring`
- `scenarios/regionHistoryLoader`
- `ws/worldDeltaReplay`
- `uploads/scenarioAssetCleanup`

Avoid dumping unrelated helpers into `utils`, `helpers`, or `common` unless the module has a narrow, named topic.

## Local Names

- Use `regionId`, `countryId`, `provinceId`, not ambiguous `id`.
- Use `ownerCountryId` and `controllerCountryId` when ownership/control matters.
- Use `actorCountryId` for the country performing an action.
- Use `targetRegionId` or `sourceRegionId` when direction matters.
- Use `candidate` for options being scored or filtered.

## AI-Agent Rule

When an agent creates reusable logic, it must choose a name that fits the broader domain responsibility and mention any intentional narrow naming in the final report.
