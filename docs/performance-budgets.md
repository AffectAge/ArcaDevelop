# Performance Budgets

Performance-sensitive systems need explicit budgets before large changes.

## Required Budget Areas

- Turn resolve duration.
- AI tick duration.
- WS delta size and broadcast fanout.
- Snapshot size.
- Scenario validation time.
- Content loading time.
- Upload cleanup time.
- Map frame time.

## Map UI Frame Budget

- Reference desktop: current Chrome or Edge with hardware acceleration, 4-core/8-thread CPU, 16 GB RAM, integrated GPU, `1440x900`, DPR 1.
- Reference mobile profile: `390x844`, DPR 2, with the renderer's mobile LOD/cache limits.
- Default `360x160` map (57,600 hexes): first interactive cold viewport at most 2 seconds; pan/zoom frame p95 at most 16.7 ms and p99 at most 33.3 ms.
- Stress 200,000-hex map: first interactive viewport at most 3 seconds; pan/zoom frame p95 at most 20 ms and p99 at most 33.3 ms.
- Mobile profile: pan/zoom frame p95 at most 33.3 ms and p99 at most 50 ms.
- After the first interactive viewport, scripted map interaction must not create main-thread long tasks over 50 ms.
- Hover content response p95 is at most 50 ms; layer/lens response p95 is at most 100 ms.
- Phaser renders only on its bounded game loop, hides resident chunks outside the current visible set, and does not schedule extra frames for static water. Unrelated world deltas rebuild zero static terrain layers.
- Terrain coverage is a visual correctness budget: no background pixel may appear between adjacent biome frames or at a visible chunk boundary at any supported zoom level.
- The single-frame-per-terrain WebP atlas must stay within a 4,096-pixel texture dimension, 2 MiB decoded RGBA, and 1 MiB transfer size unless an ADR records a measured exception.
- Water is static: the renderer must not keep an idle animation clock or schedule frames solely for water.
- Map work must depend on visible/resident chunks, not total world hex count. Static map delivery uses immutable versioned chunks, viewport-first loading, request cancellation, and bounded CPU/GPU caches.
- Natural-object art is baked only for visible chunks. It has at most one simplified and one detailed RenderTexture per visible chunk; detailed 4× desktop / 2× mobile layers may fall back to simplified when the 96 MiB desktop or 32 MiB mobile natural GPU budget is exhausted.
- After 20 repeated pan cycles, retained map heap/cache growth must stay within 10 percent of the warmed baseline.
- The full default static map artifact should remain at or below 2 MiB when served with Brotli, while normal startup downloads only viewport-priority chunks.

These are automated acceptance budgets, not aspirational targets. `npm run map:perf -- --assert` must exit non-zero when a required metric is missing or a threshold is exceeded.

## Map Measurement Rules

- Record fetch, decode, worker prepare, main-thread commit, Phaser layer creation, and first-interactive phases separately.
- Report frame p50/p95/p99, long tasks, input latency, render count, resident/visible chunks, cache bytes, visible tiles/sprites, retained memory, natural logical objects, natural RenderTexture count/GPU bytes, bake p95/p99, and GPU-budget detail fallbacks.
- Measure scripted pan, wheel zoom, hover/picking, and layer changes; an idle requestAnimationFrame average is not a valid map benchmark.
- Test both the default scenario size and a deterministic 200,000-hex fixture.
- Keep diagnostic samples bounded and expose them only through the explicit map performance/debug surface.

## Reporting

If performance was not verified for a touched hot path, say so in the final report.
## Resource Ledger Budget

Resource ledger history is bounded by scenario defines. Keep `resourceLedger.retentionTurns` and `resourceLedger.maxEntriesPerTurn` conservative for large multiplayer worlds, and avoid per-client full-history broadcasts. Normal deltas should include only changed/pruned ledger turns.

Hot-path mechanics should aggregate where possible before appending flows, but must preserve enough source/category information for player-facing explanations.
