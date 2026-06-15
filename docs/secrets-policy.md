# Secrets Policy

Never commit, generate, log, or expose real secrets.

## Forbidden

- Real JWT secrets.
- Passwords or password hashes in docs/logs.
- API keys or service tokens.
- `.env` files with real values.
- Private player/admin data.
- Session tokens.
- Database credentials.

## Allowed

- `.env.example` with dummy placeholders.
- Documentation examples using obvious non-secret values such as `replace_me`.
- Local development instructions that tell the user where to place secrets without revealing them.

## Logging

Logs must not include:

- passwords,
- JWTs,
- cookies,
- auth headers,
- private admin notes,
- raw request bodies for sensitive endpoints.
