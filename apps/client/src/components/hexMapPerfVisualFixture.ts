import type { HexId, HexMapClientManifest, WorldBase } from "@arcanorum/shared";

const COUNTRY_IDS = [
  "country:perf-amber",
  "country:perf-teal",
  "country:perf-violet",
] as const;

export type HexMapPerfVisualFixture = {
  worldBase: WorldBase;
  countryColorById: Record<string, string>;
  countryNameById: Record<string, string>;
};

export function buildHexMapPerfVisualFixture(
  manifest: HexMapClientManifest,
  labels: { countryLabel: string; cityLabel: string },
): HexMapPerfVisualFixture {
  const regionOwner: Record<string, string> = {};
  const regionController: Record<string, string> = {};
  const landRegions = manifest.regions
    .filter((region) => region.waterTileCount < region.tileCount)
    .sort(
      (left, right) =>
        left.labelAnchor.q - right.labelAnchor.q ||
        left.labelAnchor.r - right.labelAnchor.r ||
        left.id.localeCompare(right.id),
    );
  const regionGroups = COUNTRY_IDS.map(() => [] as typeof landRegions);
  for (const region of landRegions) {
    const normalizedQ =
      manifest.settings.width > 1
        ? region.labelAnchor.q / (manifest.settings.width - 1)
        : 0;
    const countryIndex = Math.min(
      COUNTRY_IDS.length - 1,
      Math.max(0, Math.floor(normalizedQ * COUNTRY_IDS.length)),
    );
    const countryId = COUNTRY_IDS[countryIndex];
    regionOwner[region.id] = countryId;
    regionController[region.id] = countryId;
    regionGroups[countryIndex].push(region);
  }

  const cityMarkersById: WorldBase["cityMarkersById"] = {};
  const unitsById: NonNullable<WorldBase["unitsById"]> = {};
  const civilianUnitsById: WorldBase["civilianUnitsById"] = {};
  for (
    let countryIndex = 0;
    countryIndex < COUNTRY_IDS.length;
    countryIndex += 1
  ) {
    const countryId = COUNTRY_IDS[countryIndex];
    const regions = selectSpreadRegions(regionGroups[countryIndex], 3);
    const cityRegion = regions[0];
    if (cityRegion) {
      const targetHexId = toHexId(
        cityRegion.labelAnchor.q,
        cityRegion.labelAnchor.r,
      );
      cityMarkersById[`city:perf:${countryIndex}`] = {
        id: `city:perf:${countryIndex}`,
        name: `${labels.cityLabel} ${countryIndex + 1}`,
        countryId,
        ownerCountryId: countryId,
        regionId: cityRegion.id,
        targetHexId,
        cultureId: `culture:perf:${countryIndex}`,
        visualState: "working",
        createdTurnId: 1,
      };
    }
    const armyRegion = regions[1] ?? cityRegion;
    if (armyRegion) {
      const id = `unit:perf:${countryIndex}`;
      unitsById[id] = {
        id,
        unitTypeId: "unit_type:perf-infantry",
        countryId,
        hexId: toHexId(armyRegion.labelAnchor.q, armyRegion.labelAnchor.r),
        hp: countryIndex === 2 ? 28 : 100,
        movementPoints: 2,
        experience: countryIndex * 3,
        status:
          countryIndex === 0
            ? "moving"
            : countryIndex === 1
              ? "fortified"
              : "fighting",
        path: [],
        createdTurnId: 1,
      };
    }
    const civilianRegion = regions[2] ?? armyRegion;
    if (civilianRegion) {
      const id = `civilian:perf:${countryIndex}`;
      civilianUnitsById[id] = {
        id,
        countryId,
        type: "colonizer",
        hexId: toHexId(
          civilianRegion.labelAnchor.q,
          civilianRegion.labelAnchor.r,
        ),
        status: "idle",
        movementPoints: 2,
        maxMovementPoints: 2,
        path: [],
        createdTurnId: 1,
      };
    }
  }

  return {
    countryColorById: Object.fromEntries(
      COUNTRY_IDS.map((countryId) => [
        countryId,
        stableFixtureColor(countryId),
      ]),
    ),
    countryNameById: Object.fromEntries(
      COUNTRY_IDS.map((countryId, index) => [
        countryId,
        `${labels.countryLabel} ${index + 1}`,
      ]),
    ),
    worldBase: {
      turnId: 1,
      resourcesByCountry: {},
      resourceLedgerByTurn: {},
      explanationRecordsByTurn: {},
      regionOwner,
      regionController,
      hexOwner: {},
      hexNameById: {},
      colonyProgressByRegion: {},
      regionColonizationByRegion: {},
      regionPopulationByRegion: {},
      regionBuildingsByRegion: {},
      regionBuildingDucatsByRegion: {},
      regionPopulationTreasuryByRegion: {},
      regionConstructionQueueByRegion: {},
      regionResourceDepositsByRegion: {},
      regionResourceExplorationQueueByRegion: {},
      regionResourceExplorationCountByRegion: {},
      parliamentByCountry: {},
      technologyByCountry: {},
      countryDecisionsByCountryId: {},
      countryEventsByCountryId: {},
      countryScheduledEventsByCountryId: {},
      countryEventFlagsByCountryId: {},
      journalEntriesByCountryId: {},
      countryModifiersByCountryId: {},
      unitsById,
      unitTrainingQueueByCountry: {},
      civilianUnitsById,
      civilianUnitQueueByCountry: {},
      settlementProjectsById: {},
      cityMarkersById,
      diplomacyProposals: [],
    },
  };
}

function selectSpreadRegions<T>(regions: readonly T[], count: number): T[] {
  if (regions.length <= count) return [...regions];
  return Array.from(
    { length: count },
    (_, index) =>
      regions[Math.round((index * (regions.length - 1)) / (count - 1))],
  );
}

function toHexId(q: number, r: number): HexId {
  return `hex:${q}:${r}`;
}

function stableFixtureColor(id: string): string {
  let hash = 0;
  for (let index = 0; index < id.length; index += 1)
    hash = Math.imul(hash ^ id.charCodeAt(index), 16_777_619);
  return `#${((hash >>> 0) & 0xffffff).toString(16).padStart(6, "0")}`;
}
