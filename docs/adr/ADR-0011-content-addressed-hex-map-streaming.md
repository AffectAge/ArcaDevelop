# ADR-0011: Content-Addressed Hex Map Streaming

## Status

Accepted

## Context

- The authoritative 57,600-hex map is roughly 44 MB as pretty-printed JSON, and building every client render chunk from the full artifact causes multi-second main-thread stalls and excessive retained memory.
- The server still needs the complete `HexMapArtifact` for authoritative movement and corridor validation.
- The client needs progressive viewport loading, cancellation, bounded caching, deterministic scenario artifacts, and stable cache invalidation without changing the pointy-top rectangular offset geometry.

## Options

- Keep `/hex-map/artifact` and preprocess the full map in every client session.
- Build chunks dynamically inside HTTP handlers.
- Generate content-addressed client chunks with scenario artifacts and stream only requested versions/chunks.

## Decision

- Keep `.generated/hex-map.json` as an internal server/generator artifact. It is no longer a public client endpoint.
- Generate `.generated/hex-map-client/<artifactVersion>/` from the normalized static artifact and sorted special feature instances. `artifactVersion` is a SHA-256 content version that also includes the client format version.
- Store `manifest.json`, compact row-major `navigation.json`, and Windows-safe `chunk-<q>-<r>.json` files. Every navigation/chunk file also has deterministic gzip and Brotli variants and an uncompressed SHA-256 descriptor.
- Each chunk owns its primary tiles and feature instances, a unique one-neighbor visual halo, and river/coast edge records that touch its primary boundary. Generation builds indexes once and does not rescan the whole map per chunk.
- Write `.generated/hex-map-client/current.json` last as the active generated-version pointer. Runtime loads and validates this pointer and manifest, verifies every declared identity/gzip/Brotli file against its length, SHA-256, and decompressed bytes, retains only manifest metadata, and serves chunk files by descriptor allowlist. Generation retains the current and immediately previous version so requests already holding the old runtime snapshot remain valid during atomic scenario cutover; new stale-version requests receive `MAP_VERSION_MISMATCH`, and older versions are pruned.
- Public client delivery is `GET /hex-map/manifest`, `GET /hex-map/navigation?version=<hash>`, and `GET /hex-map/chunks/:chunkId?version=<hash>`. The old `/hex-map/artifact` and `/hex-map/features` endpoints are removed without compatibility fallback; features are carried by their owning chunks.
- The client worker protocol is generation-tagged and typed. A worker fetches/parses desired chunks and navigation while the main thread only accepts current-generation results. Render-specific transferable typed-array payloads remain a client specialization of the shared generic response contract.
- Geometry remains pointy-top rectangular offset with `q` in `[0,width)` and `r` in `[0,height)`. `wrapX` is an optional boolean and only changes horizontal neighbor normalization; it does not change the rectangular artifact or projection. This supersedes only ADR-0006's earlier prohibition on `wrapX: true`.
- This renderer change does not introduce fog of war. A real fog-of-war system requires a separate server-authoritative visibility model, protocol/delta contract, persistence rules, and gameplay decision.

## Consequences

- First interaction can begin after the manifest/navigation and visible chunks instead of after a full-map download and mesh build.
- Versioned files may use immutable browser caching; the manifest revalidates with ETag.
- Scenario generation performs additional deterministic compression work and generated output contains duplicated halo tiles, but the default complete Brotli payload remains bounded by the 2 MiB acceptance gate.
- Missing, partial, stale, or mismatched generated client artifacts fail explicitly with stable map error codes. There is no silent main-thread monolith fallback.
- Applying a scenario builds artifacts before swapping map runtime state. The existing authorized/audited scenario-apply flow remains the serialization boundary; the new GET routes are readonly and require no idempotency key, audit event, or extra rate limit.

## Verification

- Builder tests cover deterministic versions/bytes, one-neighbor wrap-aware halo, row-major navigation, file hashes, compression parity, and incomplete-output repair.
- Route tests cover ETag/304, immutable encoding variants, unavailable/mismatched versions, descriptor-only chunk lookup, traversal rejection, and old endpoint removal.
- Default-scenario generation asserts all raw/gzip/Brotli variants exist and the complete Brotli navigation-plus-chunk payload is at most 2 MiB.
