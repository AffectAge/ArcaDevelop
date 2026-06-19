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

- Target smooth pan/zoom on supported desktop.
- Avoid long main-thread work during map interactions.
- Use memoization, viewport filtering, tiling, or worker-friendly processing for large overlays.
- Test new map layers with large province counts when relevant.

## Reporting

If performance was not verified for a touched hot path, say so in the final report.

## Map Lens Budget

Map lens changes should keep lens switching and hover responsive on large maps.

- Lens definitions belong in a registry so the HUD can enumerate modes without triggering heavy data scans.
- Lens computation should be keyed by map lens id, world/snapshot version, geometry version, active filters, perspective country, overlay set, and zoom bucket.
- Cached lens computations should feed renderer paint plans directly; avoid placeholder caches that do not affect `setPaintProperty` work.
- Geometry indexes should be rebuilt only when the map geometry version changes.
- Zoom changes should invalidate heavy work only when crossing stable zoom buckets, not for every fractional zoom tick.
- Diagnostics must use bounded counters or rolling summaries; do not store unbounded per-frame samples.
