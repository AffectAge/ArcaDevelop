# Rate Limits

Rate limits protect the online world from abuse and accidental overload.

## Required Areas

- login/register/auth attempts,
- WS connection/auth attempts,
- WS message frequency,
- order submission,
- replay/snapshot requests,
- uploads,
- admin mutations,
- diagnostics endpoints,
- scenario import/apply/validation,
- forced resolve,
- content/Arcawiki/theme/defines edits.

## Rules

- Limits should be configurable where practical.
- Admin bypasses must be explicit, limited, and audited.
- Rate-limit errors use stable error codes and localization.
- Limits must not silently drop important player actions without a clear response.

## Observability

Track rate-limit hits with bounded metrics so abusive or broken clients can be diagnosed.
