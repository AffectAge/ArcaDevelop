import type { HexId, HexTile } from "./contracts/hex-map";
import type { WorldBase } from "./contracts/world";

export type EffectiveHexTag = "city";

export type EffectiveHexState = {
  hexId: HexId;
  baseTerrain: HexTile["terrain"];
  tags: EffectiveHexTag[];
  hasCity: boolean;
};

export type EffectiveHexTile = HexTile & {
  baseTerrain: HexTile["terrain"];
  tags: EffectiveHexTag[];
  hasCity: boolean;
};

export type CityHexWorld = Pick<WorldBase, "settlementProjectsById" | "cityMarkersById">;

export function buildCityHexIdSet(world: Partial<CityHexWorld> | null | undefined): Set<HexId> {
  const result = new Set<HexId>();
  for (const project of Object.values(world?.settlementProjectsById ?? {})) {
    if (project?.targetHexId) result.add(project.targetHexId);
  }
  for (const marker of Object.values(world?.cityMarkersById ?? {})) {
    if (marker?.targetHexId) result.add(marker.targetHexId);
  }
  return result;
}

export function resolveEffectiveHexState(hex: HexTile, cityHexIds: ReadonlySet<HexId>): EffectiveHexState {
  const hasCity = cityHexIds.has(hex.id);
  return {
    hexId: hex.id,
    baseTerrain: hex.terrain,
    tags: hasCity ? ["city"] : [],
    hasCity,
  };
}

export function resolveEffectiveHexTile(hex: HexTile, cityHexIds: ReadonlySet<HexId>): EffectiveHexTile {
  const state = resolveEffectiveHexState(hex, cityHexIds);
  return {
    ...hex,
    baseTerrain: state.baseTerrain,
    tags: state.tags,
    hasCity: state.hasCity,
  };
}

export function hexHasTag(hex: { tags?: readonly string[] | null; mapTags?: readonly string[] | null }, tag: string): boolean {
  return Boolean(hex.tags?.some((item) => item === tag) || hex.mapTags?.some((item) => item === tag));
}
