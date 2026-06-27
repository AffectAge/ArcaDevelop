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
