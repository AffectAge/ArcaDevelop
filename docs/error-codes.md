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
