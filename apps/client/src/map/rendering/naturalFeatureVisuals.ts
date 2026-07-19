import { matchesMapTagQuery } from "@arcanorum/shared";
import type {
  HexTile,
  NaturalFeatureRenderLod,
  NaturalFeatureVisualCatalog,
  NaturalFeatureVisualLayer,
  NaturalFeatureVisualLayoutId,
  NaturalFeatureVisualPlacement,
  NaturalFeatureVisualRuleDefinition,
} from "@arcanorum/shared";

export type ResolvedNaturalFeaturePlacement = {
  id: string;
  textureKey: string;
  textureUrl: string;
  frame: number;
  offsetX: number;
  offsetY: number;
  scale: number;
  rotation: number;
  layer: NaturalFeatureVisualLayer;
  drawOrder: number;
  role: NaturalObjectRole;
  layoutId: NaturalFeatureVisualLayoutId;
};

type NaturalObjectRole = "back" | "center" | "front" | "edge";
type NaturalHexAnchor = {
  x: number;
  y: number;
  role: NaturalObjectRole;
  footprint: number;
};

const LAYER_ORDER: Readonly<Record<NaturalFeatureVisualLayer, number>> = {
  landform: 0,
  snow: 1,
  wet: 2,
  vegetation: 3,
};

const A = (
  x: number,
  y: number,
  role: NaturalObjectRole,
  footprint = 0.13,
): NaturalHexAnchor => ({ x, y, role, footprint });
const mirror = (anchors: readonly NaturalHexAnchor[]): NaturalHexAnchor[] =>
  anchors.map((anchor) => ({ ...anchor, x: -anchor.x }));

const TEMPERATE_GROVE = [
  A(-0.24, -0.3, "back", 0.13),
  A(0.03, -0.35, "back", 0.13),
  A(0.29, -0.28, "back", 0.13),
  A(-0.39, -0.04, "edge", 0.11),
  A(-0.13, -0.06, "center", 0.13),
  A(0.15, -0.04, "center", 0.13),
  A(0.4, -0.01, "edge", 0.11),
  A(-0.27, 0.19, "center", 0.12),
  A(0.01, 0.18, "center", 0.13),
  A(0.28, 0.21, "center", 0.12),
  A(-0.14, 0.43, "front", 0.1),
  A(0.17, 0.44, "front", 0.1),
];
const PLAINS_GROVE = [
  A(-0.23, -0.28, "back", 0.13),
  A(0.07, -0.32, "back", 0.13),
  A(0.32, -0.21, "back", 0.12),
  A(-0.42, -0.02, "edge", 0.1),
  A(-0.16, -0.02, "center", 0.13),
  A(0.13, 0.01, "center", 0.13),
  A(0.42, 0.04, "edge", 0.1),
  A(-0.29, 0.22, "center", 0.12),
  A(0, 0.2, "center", 0.13),
  A(0.28, 0.24, "center", 0.12),
  A(-0.12, 0.45, "front", 0.1),
  A(0.2, 0.44, "front", 0.1),
];
const TROPICAL_GROVE = [
  A(-0.28, -0.25, "back", 0.17),
  A(0, -0.32, "back", 0.18),
  A(0.29, -0.22, "back", 0.17),
  A(-0.42, -0.02, "edge", 0.14),
  A(-0.14, -0.01, "center", 0.16),
  A(0.16, -0.01, "center", 0.16),
  A(0.42, 0.03, "edge", 0.14),
  A(-0.31, 0.23, "center", 0.14),
  A(0, 0.21, "center", 0.15),
  A(0.31, 0.25, "center", 0.14),
  A(-0.16, 0.45, "front", 0.11),
  A(0.18, 0.44, "front", 0.11),
];
const OASIS_RING = [
  A(-0.24, -0.24, "back", 0.16),
  A(0.13, -0.28, "back", 0.16),
  A(0.34, -0.04, "edge", 0.14),
  A(-0.36, 0.05, "edge", 0.14),
  A(0, 0.02, "center", 0.17),
  A(-0.17, 0.25, "center", 0.14),
  A(0.2, 0.28, "center", 0.14),
  A(0.02, 0.46, "front", 0.11),
];
const TAIGA_STAND = [
  A(-0.32, -0.24, "back", 0.15),
  A(0, -0.32, "back", 0.16),
  A(0.31, -0.22, "back", 0.15),
  A(-0.43, 0, "edge", 0.12),
  A(-0.18, -0.01, "center", 0.15),
  A(0.16, 0.01, "center", 0.15),
  A(0.43, 0.04, "edge", 0.12),
  A(-0.29, 0.26, "center", 0.14),
  A(0.03, 0.23, "center", 0.15),
  A(0.31, 0.29, "center", 0.14),
  A(-0.16, 0.47, "front", 0.1),
  A(0.19, 0.46, "front", 0.1),
];
const TUNDRA_EDGE = [
  A(-0.44, -0.04, "edge", 0.1),
  A(0.38, -0.16, "edge", 0.1),
  A(-0.31, 0.24, "edge", 0.1),
  A(0.34, 0.29, "edge", 0.1),
  A(-0.11, 0.45, "front", 0.09),
  A(0.17, 0.45, "front", 0.09),
  A(0.01, -0.36, "edge", 0.09),
  A(-0.43, 0.17, "edge", 0.08),
  A(0.44, 0.13, "edge", 0.08),
];
const WETLAND_BAND = [
  A(-0.4, -0.13, "edge", 0.1),
  A(-0.22, -0.22, "back", 0.11),
  A(0.03, -0.18, "back", 0.11),
  A(0.27, -0.11, "back", 0.1),
  A(0.43, 0.03, "edge", 0.09),
  A(-0.31, 0.12, "center", 0.1),
  A(-0.05, 0.1, "center", 0.11),
  A(0.19, 0.14, "center", 0.1),
  A(-0.25, 0.35, "front", 0.09),
  A(0.02, 0.32, "front", 0.1),
  A(0.28, 0.37, "front", 0.09),
  A(0.05, 0.5, "front", 0.08),
];
const WETLAND_COPSE = [
  A(-0.23, -0.28, "back", 0.13),
  A(0.07, -0.31, "back", 0.13),
  A(0.32, -0.2, "back", 0.12),
  A(-0.41, -0.02, "edge", 0.1),
  A(-0.14, 0, "center", 0.13),
  A(0.15, 0.03, "center", 0.13),
  A(0.41, 0.06, "edge", 0.1),
  A(-0.27, 0.23, "center", 0.12),
  A(0.02, 0.2, "center", 0.13),
  A(0.29, 0.25, "center", 0.12),
  A(-0.13, 0.45, "front", 0.1),
  A(0.19, 0.44, "front", 0.1),
];
const MOUNTAIN_MASSIF_BASE = [A(0, 0.39, "front", 0.25)];
const MOUNTAIN_RIDGE = [
  A(0, -0.42, "back", 0.15),
  A(-0.31, -0.22, "center", 0.16),
  A(0.3, -0.18, "center", 0.16),
  A(-0.42, 0.07, "edge", 0.12),
  A(0.42, 0.1, "edge", 0.12),
];
const MOUNTAIN_SLOPE = [
  A(0, -0.28, "back", 0.25),
  A(-0.28, -0.06, "center", 0.2),
  A(0.28, -0.02, "center", 0.2),
  A(-0.16, 0.24, "center", 0.16),
  A(0.2, 0.28, "center", 0.16),
  A(-0.31, 0.43, "front", 0.11),
  A(0.3, 0.44, "front", 0.11),
];
const SNOW_RIDGE = [
  A(-0.15, -0.43, "back", 0.16),
  A(0.2, -0.37, "back", 0.16),
  A(-0.37, -0.11, "edge", 0.12),
  A(0.37, -0.08, "edge", 0.12),
  A(-0.08, 0.13, "center", 0.13),
  A(0.22, 0.2, "center", 0.13),
  A(0, 0.42, "front", 0.1),
  A(-0.29, 0.33, "front", 0.1),
];
const ROCK_CLUSTER = [
  A(-0.15, -0.19, "back", 0.14),
  A(0.21, -0.1, "back", 0.14),
  A(-0.31, 0.11, "center", 0.12),
  A(0.05, 0.15, "center", 0.14),
  A(0.33, 0.22, "center", 0.12),
  A(-0.13, 0.4, "front", 0.1),
  A(0.2, 0.43, "front", 0.1),
];

const NATURAL_LAYOUT_VARIANTS = {
  temperate_grove: [
    TEMPERATE_GROVE,
    mirror(TEMPERATE_GROVE),
    [
      A(-0.31, -0.23, "back", 0.13),
      A(-0.03, -0.34, "back", 0.13),
      A(0.26, -0.3, "back", 0.13),
      A(-0.43, 0, "edge", 0.1),
      A(-0.17, -0.02, "center", 0.13),
      A(0.11, -0.04, "center", 0.13),
      A(0.39, 0.05, "edge", 0.1),
      A(-0.31, 0.22, "center", 0.12),
      A(-0.03, 0.22, "center", 0.13),
      A(0.27, 0.25, "center", 0.12),
      A(-0.16, 0.45, "front", 0.1),
      A(0.16, 0.47, "front", 0.1),
    ],
  ],
  temperate_understory: [
    [
      A(-0.24, 0.04, "center", 0.1),
      A(0.06, -0.06, "center", 0.1),
      A(0.31, 0.12, "center", 0.1),
      A(-0.12, 0.35, "front", 0.09),
      A(0.2, 0.4, "front", 0.09),
    ],
    [
      A(-0.35, -0.03, "edge", 0.09),
      A(-0.08, 0.08, "center", 0.1),
      A(0.22, -0.03, "center", 0.1),
      A(0.36, 0.23, "edge", 0.09),
      A(0, 0.43, "front", 0.09),
    ],
  ],
  plains_grove: [
    PLAINS_GROVE,
    mirror(PLAINS_GROVE),
    [
      A(-0.3, -0.24, "back", 0.13),
      A(0.02, -0.33, "back", 0.13),
      A(0.29, -0.24, "back", 0.12),
      A(-0.42, 0.01, "edge", 0.1),
      A(-0.14, -0.01, "center", 0.13),
      A(0.14, 0.02, "center", 0.13),
      A(0.42, 0.07, "edge", 0.1),
      A(-0.28, 0.22, "center", 0.12),
      A(0.01, 0.2, "center", 0.13),
      A(0.29, 0.24, "center", 0.12),
      A(-0.14, 0.45, "front", 0.1),
      A(0.2, 0.44, "front", 0.1),
    ],
  ],
  plains_scrub: [
    [
      A(-0.42, -0.03, "edge", 0.09),
      A(0.4, -0.12, "edge", 0.09),
      A(-0.28, 0.32, "edge", 0.1),
      A(0.3, 0.38, "edge", 0.1),
      A(0.02, 0.48, "front", 0.08),
    ],
    [
      A(-0.35, -0.18, "edge", 0.09),
      A(0.37, 0.03, "edge", 0.09),
      A(-0.1, 0.4, "front", 0.09),
      A(0.22, 0.31, "edge", 0.1),
      A(-0.44, 0.18, "edge", 0.08),
    ],
  ],
  tropical_grove: [
    TROPICAL_GROVE,
    mirror(TROPICAL_GROVE),
    [
      A(-0.2, -0.32, "back", 0.18),
      A(0.16, -0.3, "back", 0.18),
      A(0.43, -0.06, "edge", 0.13),
      A(-0.42, 0.01, "edge", 0.13),
      A(-0.18, -0.02, "center", 0.16),
      A(0.13, 0.06, "center", 0.16),
      A(-0.35, 0.25, "center", 0.13),
      A(0, 0.24, "center", 0.15),
      A(0.34, 0.28, "center", 0.13),
      A(-0.18, 0.45, "front", 0.1),
      A(0.17, 0.46, "front", 0.1),
      A(0.02, 0.49, "front", 0.08),
    ],
  ],
  tropical_understory: [
    [
      A(-0.3, 0.02, "center", 0.09),
      A(-0.06, 0.1, "center", 0.1),
      A(0.2, 0.05, "center", 0.1),
      A(0.38, 0.25, "edge", 0.09),
      A(-0.16, 0.39, "front", 0.09),
      A(0.13, 0.43, "front", 0.09),
    ],
    [
      A(-0.39, -0.02, "edge", 0.08),
      A(-0.16, 0.12, "center", 0.1),
      A(0.13, 0.1, "center", 0.1),
      A(0.36, 0.01, "edge", 0.08),
      A(-0.04, 0.37, "front", 0.1),
      A(0.27, 0.38, "front", 0.09),
    ],
  ],
  oasis_ring: [
    OASIS_RING,
    mirror(OASIS_RING),
    [
      A(-0.14, -0.32, "back", 0.16),
      A(0.25, -0.18, "back", 0.15),
      A(-0.36, -0.05, "edge", 0.13),
      A(0.03, 0.04, "center", 0.18),
      A(0.37, 0.14, "edge", 0.12),
      A(-0.22, 0.27, "center", 0.13),
      A(0.2, 0.31, "center", 0.13),
      A(-0.02, 0.48, "front", 0.1),
    ],
  ],
  scrub_edge: [
    [
      A(-0.42, -0.1, "edge", 0.1),
      A(0.4, -0.02, "edge", 0.1),
      A(-0.24, 0.28, "edge", 0.1),
      A(0.3, 0.31, "edge", 0.1),
      A(0.02, 0.47, "front", 0.08),
    ],
    [
      A(-0.34, -0.2, "edge", 0.09),
      A(0.42, 0.12, "edge", 0.09),
      A(-0.41, 0.21, "edge", 0.09),
      A(0.16, 0.37, "front", 0.1),
      A(-0.13, 0.45, "front", 0.09),
    ],
  ],
  taiga_stand: [
    TAIGA_STAND,
    mirror(TAIGA_STAND),
    [
      A(-0.24, -0.29, "back", 0.13),
      A(0.04, -0.34, "back", 0.13),
      A(0.3, -0.25, "back", 0.13),
      A(-0.42, -0.02, "edge", 0.1),
      A(-0.14, -0.04, "center", 0.13),
      A(0.15, -0.02, "center", 0.13),
      A(0.42, 0.05, "edge", 0.1),
      A(-0.29, 0.22, "center", 0.12),
      A(0.01, 0.22, "center", 0.13),
      A(0.3, 0.25, "center", 0.12),
      A(-0.15, 0.45, "front", 0.1),
      A(0.18, 0.46, "front", 0.1),
    ],
  ],
  tundra_edge: [
    TUNDRA_EDGE,
    mirror(TUNDRA_EDGE),
    [
      A(-0.4, -0.16, "edge", 0.09),
      A(0.4, -0.08, "edge", 0.09),
      A(-0.45, 0.18, "edge", 0.08),
      A(0.43, 0.23, "edge", 0.08),
      A(-0.24, 0.36, "edge", 0.09),
      A(0.1, 0.44, "front", 0.09),
      A(0.31, 0.38, "edge", 0.09),
      A(-0.05, -0.39, "edge", 0.08),
      A(0.02, 0.5, "front", 0.08),
    ],
  ],
  wetland_band: [
    WETLAND_BAND,
    mirror(WETLAND_BAND),
    [
      A(-0.44, -0.03, "edge", 0.09),
      A(-0.27, -0.18, "back", 0.1),
      A(-0.02, -0.22, "back", 0.11),
      A(0.24, -0.18, "back", 0.1),
      A(0.44, 0.02, "edge", 0.09),
      A(-0.2, 0.09, "center", 0.1),
      A(0.06, 0.12, "center", 0.11),
      A(0.29, 0.16, "center", 0.1),
      A(-0.31, 0.34, "front", 0.09),
      A(-0.04, 0.36, "front", 0.1),
      A(0.25, 0.37, "front", 0.09),
      A(0.04, 0.5, "front", 0.08),
    ],
  ],
  wetland_copse: [
    WETLAND_COPSE,
    mirror(WETLAND_COPSE),
    [
      A(-0.28, -0.26, "back", 0.13),
      A(0.03, -0.33, "back", 0.13),
      A(0.31, -0.23, "back", 0.12),
      A(-0.42, -0.01, "edge", 0.1),
      A(-0.15, 0.01, "center", 0.13),
      A(0.14, 0.03, "center", 0.13),
      A(0.42, 0.08, "edge", 0.1),
      A(-0.28, 0.23, "center", 0.12),
      A(0.02, 0.22, "center", 0.13),
      A(0.3, 0.26, "center", 0.12),
      A(-0.14, 0.45, "front", 0.1),
      A(0.19, 0.45, "front", 0.1),
    ],
  ],
  mountain_massif_base: [
    MOUNTAIN_MASSIF_BASE,
    [A(0.02, 0.38, "front", 0.25)],
    [A(-0.02, 0.4, "front", 0.25)],
  ],
  mountain_ridge: [
    MOUNTAIN_RIDGE,
    mirror(MOUNTAIN_RIDGE),
    [
      A(-0.28, -0.3, "back", 0.16),
      A(0.03, -0.43, "back", 0.15),
      A(0.32, -0.23, "center", 0.16),
      A(-0.43, 0.06, "edge", 0.12),
      A(0.41, 0.11, "edge", 0.12),
    ],
  ],
  mountain_slope: [
    MOUNTAIN_SLOPE,
    mirror(MOUNTAIN_SLOPE),
    [
      A(-0.08, -0.32, "back", 0.26),
      A(0.28, -0.1, "center", 0.2),
      A(-0.29, 0.03, "center", 0.2),
      A(0.16, 0.25, "center", 0.16),
      A(-0.22, 0.29, "center", 0.16),
      A(-0.32, 0.44, "front", 0.11),
      A(0.31, 0.46, "front", 0.11),
    ],
  ],
  mountain_tree_line: [
    [
      A(-0.36, 0.05, "edge", 0.11),
      A(-0.13, 0.17, "center", 0.12),
      A(0.14, 0.18, "center", 0.12),
      A(0.37, 0.08, "edge", 0.11),
      A(-0.05, 0.44, "front", 0.1),
    ],
    [
      A(-0.28, -0.02, "edge", 0.11),
      A(0.1, 0.1, "center", 0.12),
      A(0.36, 0.22, "edge", 0.1),
      A(-0.18, 0.36, "front", 0.1),
      A(0.17, 0.43, "front", 0.1),
    ],
  ],
  snow_ridge: [
    SNOW_RIDGE,
    mirror(SNOW_RIDGE),
    [
      A(0, -0.46, "back", 0.16),
      A(-0.3, -0.23, "back", 0.14),
      A(0.31, -0.18, "back", 0.14),
      A(-0.39, 0.04, "edge", 0.11),
      A(0.35, 0.08, "edge", 0.11),
      A(-0.13, 0.25, "center", 0.12),
      A(0.18, 0.29, "center", 0.12),
      A(0, 0.45, "front", 0.09),
    ],
  ],
  rock_cluster: [
    ROCK_CLUSTER,
    mirror(ROCK_CLUSTER),
    [
      A(-0.24, -0.18, "back", 0.13),
      A(0.16, -0.16, "back", 0.13),
      A(-0.39, 0.09, "edge", 0.1),
      A(-0.06, 0.08, "center", 0.14),
      A(0.31, 0.18, "center", 0.12),
      A(-0.19, 0.4, "front", 0.1),
      A(0.15, 0.44, "front", 0.1),
    ],
  ],
} as const satisfies Readonly<
  Record<NaturalFeatureVisualLayoutId, readonly (readonly NaturalHexAnchor[])[]>
>;

export function resolveNaturalFeaturePlacements(
  tile: HexTile,
  catalog: NaturalFeatureVisualCatalog,
  seed: string,
  lod: NaturalFeatureRenderLod,
): ResolvedNaturalFeaturePlacement[] {
  const rules = catalog.visuals
    .filter((rule) => matchesMapTagQuery(tile.mapTags, rule.tagQuery))
    .sort(
      (left, right) =>
        (right.priority ?? 0) - (left.priority ?? 0) ||
        left.id.localeCompare(right.id),
    );
  const occupiedAnchors: NaturalHexAnchor[] = [];
  const placements = rules.flatMap((rule) =>
    resolveRulePlacements(tile, rule, catalog, seed, lod, occupiedAnchors),
  );
  return placements.sort(
    (left, right) =>
      LAYER_ORDER[left.layer] - LAYER_ORDER[right.layer] ||
      left.offsetY - right.offsetY ||
      left.id.localeCompare(right.id),
  );
}

function resolveRulePlacements(
  tile: HexTile,
  rule: NaturalFeatureVisualRuleDefinition,
  catalog: NaturalFeatureVisualCatalog,
  seed: string,
  lod: NaturalFeatureRenderLod,
  occupiedAnchors: NaturalHexAnchor[],
): ResolvedNaturalFeaturePlacement[] {
  return rule.placements
    .filter((placement) => matchesMapTagQuery(tile.mapTags, placement.tagQuery))
    .filter((placement) => placement.lod === "simplified" || lod === "detailed")
    .flatMap((placement) =>
      resolvePlacement(tile, rule, placement, catalog, seed, occupiedAnchors),
    );
}

function resolvePlacement(
  tile: HexTile,
  rule: NaturalFeatureVisualRuleDefinition,
  placement: NaturalFeatureVisualPlacement,
  catalog: NaturalFeatureVisualCatalog,
  seed: string,
  occupiedAnchors: NaturalHexAnchor[],
): ResolvedNaturalFeaturePlacement[] {
  const count = stableInteger(
    `${seed}:${tile.id}:${rule.id}:${placement.id}:count`,
    placement.count.min,
    placement.count.max,
  );
  const scaleRange = placement.scale ?? { min: 0.72, max: 1 };
  const selected = selectLayoutAnchors(
    placement.layoutId,
    `${seed}:${tile.id}:${rule.id}:${placement.id}:layout`,
    count,
    scaleRange.max,
    occupiedAnchors,
  );
  return selected.map((anchor, index) => {
    const frame = selectFrame(
      placement.frameIds,
      `${seed}:${tile.id}:${rule.id}:${placement.id}:${index}:frame`,
    );
    return {
      id: `${rule.id}:${placement.id}:${index}`,
      textureKey: `arc-map-natural-${rule.textureSetId}`,
      textureUrl:
        catalog.textureUrls[rule.textureSetId] ??
        `/game-assets/phaser/natural_features/${rule.textureSetId}_features.webp`,
      frame,
      offsetX: anchor.x,
      offsetY: anchor.y,
      scale: stableRange(
        `${seed}:${tile.id}:${rule.id}:${placement.id}:${index}:scale`,
        scaleRange.min,
        scaleRange.max,
      ),
      rotation: placement.rotation
        ? stableRange(
            `${seed}:${tile.id}:${rule.id}:${placement.id}:${index}:rotation`,
            -0.09,
            0.09,
          )
        : 0,
      layer: placement.layer,
      drawOrder: placement.drawOrder ?? 0,
      role: anchor.role,
      layoutId: placement.layoutId,
    };
  });
}

function selectLayoutAnchors(
  layoutId: NaturalFeatureVisualLayoutId,
  seed: string,
  count: number,
  maximumScale: number,
  occupiedAnchors: NaturalHexAnchor[],
): NaturalHexAnchor[] {
  const variants = NATURAL_LAYOUT_VARIANTS[layoutId];
  const variant = variants[
    Math.floor(stableUnit(seed) * variants.length)
  ] as readonly NaturalHexAnchor[];
  const selected: NaturalHexAnchor[] = [];
  const occupiedForSelection = [...occupiedAnchors];
  for (const anchor of variant) {
    if (
      selected.length >= count ||
      overlapsOccupiedAnchor(anchor, maximumScale, occupiedForSelection)
    )
      continue;
    selected.push(anchor);
    occupiedForSelection.push({
      ...anchor,
      footprint: anchor.footprint * maximumScale,
    });
  }
  occupiedAnchors.push(
    ...selected.map((anchor) => ({
      ...anchor,
      footprint: anchor.footprint * maximumScale,
    })),
  );
  return selected;
}

function overlapsOccupiedAnchor(
  anchor: NaturalHexAnchor,
  maximumScale: number,
  occupiedAnchors: readonly NaturalHexAnchor[],
): boolean {
  const footprint = anchor.footprint * maximumScale;
  return occupiedAnchors.some(
    (occupied) =>
      Math.hypot(anchor.x - occupied.x, anchor.y - occupied.y) <
      footprint + occupied.footprint,
  );
}

function selectFrame(frameIds: readonly number[], seed: string): number {
  return frameIds[Math.floor(stableUnit(seed) * frameIds.length)] as number;
}

function stableInteger(seed: string, min: number, max: number): number {
  return min + Math.floor(stableUnit(seed) * (max - min + 1));
}

function stableRange(seed: string, min: number, max: number): number {
  return min + stableUnit(seed) * (max - min);
}

function stableUnit(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1)
    hash = Math.imul(hash ^ value.charCodeAt(index), 16777619);
  return (hash >>> 0) / 0xffffffff;
}
