# Error Codes

API and WS errors must use stable machine-readable codes.

## Rules

- Do not expose raw server messages to players.
- Client maps codes to localized text.
- Admin/debug details require permission.
- Avoid duplicate concepts like `FORBIDDEN`, `NOT_ALLOWED`, and `ACCESS_DENIED` for the same situation.
- Document new codes when adding API/WS behavior.
- obsolete HTTP auth helpers may still return `{ error: "UNAUTHORIZED" }` or `{ error: "FORBIDDEN" }`; new API/WS contracts should move toward explicit `code` fields intentionally.

## Suggested Namespaces

- `AUTH_*`
- `PERMISSION_*`
- `VALIDATION_*`
- `ORDER_*`
- `REGION_*`
- `COUNTRY_*`
- `SCENARIO_*`
- `UPLOAD_*`
- `RATE_LIMIT_*`
- `CONFLICT_*`
- `SERVER_*`

## Required Fields

Error responses should include:

- `code`,
- localized client mapping key or namespace,
- optional safe metadata,
- debug details only when permission-gated.

## Build Placement Codes

- `BUILD_TARGET_HEX_REQUIRED`: a new `BUILD` order did not provide `targetHexId`.
- `BUILD_RESTRICTED`: the selected hex failed building placement validation.
- `BUILD_PLACEMENT_HEX_NOT_FOUND`: the requested `targetHexId` does not exist in the active hex map.
- `BUILD_PLACEMENT_HEX_REGION_MISMATCH`: the requested `targetHexId` is not part of the requested `regionId`.
- `BUILD_PLACEMENT_REGION_NOT_CONTROLLED`: the requester does not control the target region.
- `BUILD_PLACEMENT_OCCUPIED`: the target hex already has a building instance or construction project.
- `BUILD_PLACEMENT_TERRAIN_DENIED` and `BUILD_PLACEMENT_TERRAIN_NOT_ALLOWED`: terrain rules reject the target hex.
- `BUILD_PLACEMENT_FEATURE_DENIED` and `BUILD_PLACEMENT_FEATURE_NOT_ALLOWED`: feature rules reject the target hex.
- `BUILD_PLACEMENT_WATER_DENIED` and `BUILD_PLACEMENT_WATER_NOT_ALLOWED`: water rules reject the target hex.

## Static Map Artifact Codes

- `MAP_ARTIFACT_UNAVAILABLE`: the active scenario does not have a complete validated client map manifest/artifact set, or a declared identity/gzip/Brotli file is missing, has the wrong length or SHA-256, or fails compression-parity validation.
- `MAP_VERSION_MISMATCH`: a navigation/chunk request omitted the version or used a version other than the active manifest's `artifactVersion`; the client must reload the manifest.
- `MAP_CHUNK_NOT_FOUND`: the requested chunk ID is not present in the active manifest. Raw route input is never resolved as a filesystem path.

## Settlement / Found City Codes

- `COLONIZER_NOT_FOUND`: the `FOUND_CITY` order references a missing colonizer, a non-colonizer civilian unit, or a unit owned by another country.
- `COLONIZER_CAPTURED`: the referenced colonizer is captured and cannot found a city.
- `COLONIZER_NOT_ON_TARGET_HEX`: the colonizer is not standing on the requested `targetHexId`.
- `FOUND_CITY_NAME_REQUIRED`: the city name is missing or empty after trimming.
- `FOUND_CITY_NAME_TOO_LONG`: the city name is longer than 32 characters after trimming.
- `FOUND_CITY_HEX_REGION_MISMATCH`: the requested hex is not part of the requested region.
- `REGION_NOT_NEUTRAL`: the target region already has an owner or controller.
- `SETTLEMENT_PROJECT_EXISTS`: the target region already has an active or stalled settlement project.
- `COLONIZATION_DISABLED`: scenario/admin settings forbid colonization in the target region.

## Unit Movement Codes

- `MAP_UNIT_NOT_FOUND`: a unit order references a missing unit or one not owned by the order country.
- `MAP_UNIT_ALREADY_MOVED`: the referenced unit already spent its action during the current turn.
- `MAP_UNIT_ALREADY_QUEUED`: the player already queued a unit order for this unit this turn.
- `MAP_UNIT_NOT_SLEEPING`: a wake order references a unit that is not sleeping or fortified.
- `MAP_UNIT_STACK_LIMIT_REACHED`: the requested movement would exceed the one combat plus one civilian unit stacking rule for the same country.
- `MAP_UNIT_TARGET_INVALID`: the movement target is empty, invalid, impassable, or unreachable during turn resolution.
- `UNIT_ATTACK_ATTACKER_NOT_FOUND`: the `UNIT_ATTACK` order references a missing, foreign, or unsupported attacker unit.
- `UNIT_ATTACK_ALREADY_ACTED`: the attacker already moved or attacked during the current turn.
- `UNIT_ATTACK_ALREADY_QUEUED`: the player already queued a movement or attack order for this attacker this turn.
- `UNIT_ATTACK_TARGET_INVALID`: the attack target is missing, friendly, out of melee/ranged range, or otherwise not attackable by the current server slice.
- `UNIT_MOVE_TARGET_INVALID`: the movement target is empty, invalid, or unreachable.
- `UNIT_MOVE_PATH_NOT_CONTIGUOUS`: the submitted route is not a contiguous hex route.
- `FORMATION_DEPLOYMENT_BUILDING_REQUIRED`: the selected hex does not have a suitable active building with deployment capability.
- `FORMATION_DEPLOYMENT_BRANCH_UNSUPPORTED`: the selected deployment building exists but does not support the requested branch.
- `FORMATION_TEMPLATE_NOT_FOUND`: the selected formation template is missing or not owned by the requester.

## Military Equipment Codes

- `EQUIPMENT_FRAME_NOT_FOUND`: an equipment variant creation request did not reference a known frame, and no compatible legacy class frame could be resolved.
- `EQUIPMENT_CLASS_NOT_FOUND`: the resolved equipment frame points to a missing equipment class.
- `EQUIPMENT_SLOT_EMPTY`: a required frame slot did not receive a module selection.
- `EQUIPMENT_MODULE_INVALID`: the selected module does not exist, does not match the requested slot, or is incompatible with the frame's equipment class.
