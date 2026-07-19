import type { HexMapTag, MapTagQuery } from "./contracts/hex-map";

export const HEX_MAP_TAGS = [
  "biome:tundra",
  "biome:grassland",
  "biome:plains",
  "biome:desert",
  "biome:tropical",
  "ecoregion:steppe",
  "ecoregion:temperate_forest",
  "ecoregion:taiga",
  "ecoregion:tundra",
  "ecoregion:alpine_tundra",
  "ecoregion:glacial_mountains",
  "ecoregion:tropical_forest",
  "ecoregion:savanna",
  "ecoregion:desert",
  "ecoregion:wetland",
  "ecoregion:mangrove",
  "morphology:flat",
  "morphology:rough",
  "morphology:mountainous",
  "morphology:navigable_river",
  "water:coastal",
  "water:ocean",
  "water:lake",
  "water:fresh",
  "feature:minor_river",
  "feature:floodplain",
  "feature:wet",
  "feature:vegetated",
  "feature:aquatic",
  "feature:snow",
  "feature:volcanic",
  "natural:broadleaf_forest",
  "natural:mixed_forest",
  "natural:coniferous_forest",
  "natural:tropical_rainforest",
  "natural:tropical_dry_forest",
  "natural:savanna",
  "natural:shrubland",
  "natural:marsh",
  "natural:swamp_forest",
  "natural:mangrove",
  "natural:oasis",
  "natural:alpine_conifers",
  "natural:rock_outcrop",
  "vegetation:sparse",
  "vegetation:normal",
  "vegetation:dense",
  "movement:stop_on_enter",
  "fertility:barren",
  "fertility:poor",
  "fertility:modest",
  "fertility:fertile",
  "fertility:rich",
  "rainfall:arid",
  "rainfall:dry",
  "rainfall:moderate",
  "rainfall:wet",
  "rainfall:monsoon",
  "slope:flat",
  "slope:rolling",
  "slope:hilly",
  "slope:steep",
  "slope:rugged",
  "latitude:polar",
  "latitude:subpolar",
  "latitude:temperate",
  "latitude:subtropical",
  "latitude:tropical",
  "elevation:lowland",
  "elevation:upland",
  "elevation:highland",
  "elevation:mountain",
  "elevation:peak",
  "landmass:continent",
  "landmass:island",
  "continent:homeland",
  "continent:distant",
  "basin:headwater",
  "basin:mainstem",
  "basin:delta",
  "river:minor",
  "river:major",
  "river:navigable",
  "coast:coastal",
  "coast:inland",
] as const satisfies readonly HexMapTag[];

export type KnownHexMapTag = (typeof HEX_MAP_TAGS)[number];

export const HEX_MAP_TAG_SET: ReadonlySet<string> = new Set<string>(HEX_MAP_TAGS);

export function isKnownHexMapTag(value: string): value is KnownHexMapTag {
  return HEX_MAP_TAG_SET.has(value);
}

export function matchesMapTagQuery(tags: readonly string[] | undefined, query: MapTagQuery | null | undefined): boolean {
  if (query == null) return true;
  const tagSet = new Set(tags ?? []);
  return matchesOneTagQuery(tagSet, query);
}

function matchesOneTagQuery(tags: ReadonlySet<string>, query: MapTagQuery): boolean {
  if (typeof query === "string") return tags.has(query);
  if (!query || typeof query !== "object" || Array.isArray(query)) return false;
  if (query.all && !query.all.every((child) => matchesOneTagQuery(tags, child))) return false;
  if (query.any && !query.any.some((child) => matchesOneTagQuery(tags, child))) return false;
  if (query.not) {
    const denied = Array.isArray(query.not) ? query.not : [query.not];
    if (denied.some((child) => matchesOneTagQuery(tags, child))) return false;
  }
  return true;
}
