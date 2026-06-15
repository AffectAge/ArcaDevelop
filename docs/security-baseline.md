# Security Baseline

## Server Authority

The server validates every meaningful action:

- authentication,
- authorization,
- ownership,
- resources/costs,
- cooldowns,
- limits,
- route and province/region access,
- admin permissions,
- upload rules,
- scenario mutation rights.

Client UI restrictions are not security controls.

## Input Handling

- Validate API bodies, WS payloads, scenario files, uploads, and admin inputs.
- Normalize authentication token payloads to the explicit fields routes need; do not pass through arbitrary JWT claims as auth context.
- HTTP and WS authentication must use the same normalized token parsing rules.
- Keep authentication token lifetime choices centralized in server security helpers instead of hardcoding expiry strings in routes.
- Sanitize player-provided names/text before display or persistence.
- Use allowlists for file types, image dimensions, and theme variables.
- Resolve upload paths inside the configured upload root and reject traversal such as `..`, empty segments, or absolute paths.
- Reject unexpected fields for privileged mutations unless there is an explicit compatibility reason.

## Sensitive Operations

Require permission checks, audit logs, and confirmations for:

- admin mutations,
- forced resolve,
- scenario apply/import/export,
- defines/theme/content edits,
- country deletion,
- upload cleanup,
- permission changes.

## Errors

- Return stable error codes.
- Do not show stack traces or raw server messages to players.
- Gate debug details behind admin permissions.
