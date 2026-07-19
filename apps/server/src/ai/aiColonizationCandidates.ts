import type { HexMapIndexEntry } from "../map/hexIndex";

export type AiColonizationCandidate = never;

export function selectAiColonizationCandidates(_params: unknown): AiColonizationCandidate[] {
  void _params;
  return [];
}

export function buildRegionAdjacencyByIdFromHexes(
  hexes: Pick<HexMapIndexEntry, "id" | "regionId" | "neighbors">[],
): Record<string, string[]> {
  const regionByHexId = new Map<string, string>();
  for (const province of hexes) {
    if (province.regionId) regionByHexId.set(province.id, province.regionId);
  }

  const adjacency = new Map<string, Set<string>>();
  for (const province of hexes) {
    if (!province.regionId) continue;
    const sourceRegionId = province.regionId;
    for (const neighborHexId of province.neighbors) {
      const targetRegionId = regionByHexId.get(neighborHexId);
      if (!targetRegionId || targetRegionId === sourceRegionId) continue;
      addRegionNeighbor(adjacency, sourceRegionId, targetRegionId);
      addRegionNeighbor(adjacency, targetRegionId, sourceRegionId);
    }
  }

  return Object.fromEntries(
    [...adjacency.entries()]
      .map(([regionId, neighbors]) => [regionId, [...neighbors].sort()] as const)
      .sort(([left], [right]) => left.localeCompare(right)),
  );
}

function addRegionNeighbor(adjacency: Map<string, Set<string>>, regionId: string, neighborRegionId: string): void {
  const neighbors = adjacency.get(regionId) ?? new Set<string>();
  neighbors.add(neighborRegionId);
  adjacency.set(regionId, neighbors);
}
