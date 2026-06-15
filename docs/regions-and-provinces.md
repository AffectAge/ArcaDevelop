# Regions And Provinces

## Province Responsibilities

Province data should stay small and map-focused:

- `id`,
- localization key or display name source,
- authored map color,
- neighboring province IDs,
- region ID membership,
- terrain/landscape,
- climate,
- movement cost,
- passability,
- coordinates/centroid,
- optional map metadata.

First movement model:

- provinces form a graph,
- units path through neighboring provinces,
- terrain/climate/movement cost affect pathing,
- region owner/controller determines access and supply.

## Region Responsibilities

Region data holds heavy gameplay:

- authored map color,
- owner/controller,
- cores/claims,
- pops,
- buildings,
- construction,
- resources/deposits,
- infrastructure,
- modifiers,
- colonization,
- economic output,
- taxes.

## Anti-Pattern

Do not introduce new fields like these without explicit approval:

- `regionPopulationByRegion`,
- `regionBuildingsByRegion`,
- `regionConstructionQueueByRegion`,
- province-level colonization ownership,
- province-level diplomacy transfer.

Existing province-heavy systems are obsolete and should be migrated toward region-based equivalents during the server rewrite.
