# Permissions

All privileged actions must be enforced server-side.

## Roles

- `guest`: unauthenticated or pre-auth access.
- `player`: normal country/player access.
- `moderator`: limited moderation if added.
- `admin`: scenario/game administration.
- `superadmin`: server-owner level operations if added.

## Rule

Every API endpoint and WS command must declare its required permission level. UI visibility is not security.

The static map delivery endpoints `GET /hex-map/manifest`, `GET /hex-map/navigation`, and
`GET /hex-map/chunks/:chunkId` are readonly public (`guest`) endpoints. They expose only generated
scenario map artifacts and do not expose player-private state or authorize any mutation.

Server routes must resolve current admin status from trusted server state or a server-side permission checker. Do not trust an `isAdmin` token claim as the final authorization decision for privileged mutations.

## High-Risk Actions

Require admin or stronger:

- scenario apply/import/export,
- defines/theme/content edits,
- Arcawiki admin edits,
- forced resolve,
- country deletion/mutation,
- registration approval,
- punishment/lock/unlock,
- upload cleanup,
- diagnostics,
- permission changes.

## Review Requirement

New endpoints/actions must update this doc or the future permission matrix.
