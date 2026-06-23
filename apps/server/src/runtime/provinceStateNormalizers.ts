import type {
  BuildingInstance,
  BuildingOwner,
  RegionConstructionProject,
  RegionResourceDeposit,
  RegionResourceExplorationProject,
} from "@arcanorum/shared";

export type HexStateNormalizerParams = {
  input: unknown;
  hexIds: string[];
  fallbackCountryId: string;
  turnId: number;
  createId: () => string;
  defaultBuildingDurabilityMax: number;
};

function round3(value: number): number {
  return Number((Number.isFinite(value) ? value : 0).toFixed(3));
}

export function normalizeRegionBuildingsMap(params: HexStateNormalizerParams): Record<string, BuildingInstance[]> {
  const input = params.input;
  const fallbackCountryId = params.fallbackCountryId;
  const normalized: Record<string, BuildingInstance[]> = {};
  if (input && typeof input === "object") {
    for (const [hexId, raw] of Object.entries(input as Record<string, unknown>)) {
      const instances: BuildingInstance[] = [];
      if (Array.isArray(raw)) {
        for (const item of raw) {
          if (!item || typeof item !== "object") continue;
          const source = item as Partial<BuildingInstance>;
          const buildingId = typeof source.buildingId === "string" ? source.buildingId.trim() : "";
          if (!buildingId) continue;
          const createdTurnId =
            typeof source.createdTurnId === "number" && Number.isFinite(source.createdTurnId)
              ? Math.max(1, Math.floor(source.createdTurnId))
              : params.turnId;
          const level =
            typeof source.level === "number" && Number.isFinite(source.level)
              ? Math.max(1, Math.floor(source.level))
              : 1;
          instances.push({
            instanceId:
              typeof source.instanceId === "string" && source.instanceId.trim()
                ? source.instanceId.trim()
                : params.createId(),
            buildingId,
            customName:
              typeof source.customName === "string"
                ? source.customName.trim().slice(0, 80) || null
                : source.customName === null
                  ? null
                  : null,
            owner: normalizeBuildingOwner(source.owner ?? { type: "state", countryId: fallbackCountryId }, fallbackCountryId),
            createdTurnId,
            level,
            currentDurability:
              typeof source.currentDurability === "number" && Number.isFinite(source.currentDurability)
                ? Number(Math.max(0, source.currentDurability).toFixed(3))
                : params.defaultBuildingDurabilityMax,
            autoUpgradeEnabled: typeof source.autoUpgradeEnabled === "boolean" ? source.autoUpgradeEnabled : true,
            stateSubsidiesEnabled: typeof source.stateSubsidiesEnabled === "boolean" ? source.stateSubsidiesEnabled : true,
            manualWorkEnabled: typeof source.manualWorkEnabled === "boolean" ? source.manualWorkEnabled : true,
            ducats:
              typeof source.ducats === "number" && Number.isFinite(source.ducats)
                ? Number(Math.max(0, source.ducats).toFixed(3))
                : 0,
            warehouseByGoodId:
              source.warehouseByGoodId && typeof source.warehouseByGoodId === "object"
                ? Object.fromEntries(
                    Object.entries(source.warehouseByGoodId as Record<string, unknown>)
                      .filter(([goodId]) => typeof goodId === "string" && goodId.trim().length > 0)
                      .map(([goodId, valueRaw]) => [
                        goodId,
                        Number(
                          (
                            typeof valueRaw === "number" && Number.isFinite(valueRaw) ? Math.max(0, valueRaw) : 0
                          ).toFixed(3),
                        ),
                      ]),
                  )
                : {},
            lastLaborCoverage:
              typeof source.lastLaborCoverage === "number" && Number.isFinite(source.lastLaborCoverage)
                ? Number(Math.max(0, Math.min(1, source.lastLaborCoverage)).toFixed(3))
                : 0,
            lastInfraCoverage:
              typeof source.lastInfraCoverage === "number" && Number.isFinite(source.lastInfraCoverage)
                ? Number(Math.max(0, Math.min(1, source.lastInfraCoverage)).toFixed(3))
                : 0,
            lastInputCoverage:
              typeof source.lastInputCoverage === "number" && Number.isFinite(source.lastInputCoverage)
                ? Number(Math.max(0, Math.min(1, source.lastInputCoverage)).toFixed(3))
                : 0,
            lastFinanceCoverage:
              typeof source.lastFinanceCoverage === "number" && Number.isFinite(source.lastFinanceCoverage)
                ? Number(Math.max(0, Math.min(1, source.lastFinanceCoverage)).toFixed(3))
                : 0,
            lastExtractionCoverage:
              typeof source.lastExtractionCoverage === "number" && Number.isFinite(source.lastExtractionCoverage)
                ? Number(Math.max(0, Math.min(1, source.lastExtractionCoverage)).toFixed(3))
                : 0,
            lastDurabilityCoverage:
              typeof source.lastDurabilityCoverage === "number" && Number.isFinite(source.lastDurabilityCoverage)
                ? Number(Math.max(0, Math.min(1, source.lastDurabilityCoverage)).toFixed(3))
                : 0,
            lastProductivity:
              typeof source.lastProductivity === "number" && Number.isFinite(source.lastProductivity)
                ? Number(Math.max(0, source.lastProductivity).toFixed(3))
                : 0,
            lastPurchaseByGoodId:
              source.lastPurchaseByGoodId && typeof source.lastPurchaseByGoodId === "object"
                ? Object.fromEntries(
                    Object.entries(source.lastPurchaseByGoodId as Record<string, unknown>).map(([goodId, valueRaw]) => [
                      goodId,
                      Number(
                        (
                          typeof valueRaw === "number" && Number.isFinite(valueRaw) ? Math.max(0, valueRaw) : 0
                        ).toFixed(3),
                      ),
                    ]),
                  )
                : {},
            lastPurchaseCostByGoodId:
              source.lastPurchaseCostByGoodId && typeof source.lastPurchaseCostByGoodId === "object"
                ? Object.fromEntries(
                    Object.entries(source.lastPurchaseCostByGoodId as Record<string, unknown>).map(([goodId, valueRaw]) => [
                      goodId,
                      Number.isFinite(Number(valueRaw)) ? round3(Math.max(0, Number(valueRaw))) : 0,
                    ]),
                  )
                : {},
            lastSalesByGoodId:
              source.lastSalesByGoodId && typeof source.lastSalesByGoodId === "object"
                ? Object.fromEntries(
                    Object.entries(source.lastSalesByGoodId as Record<string, unknown>).map(([goodId, valueRaw]) => [
                      goodId,
                      Number.isFinite(Number(valueRaw)) ? round3(Math.max(0, Number(valueRaw))) : 0,
                    ]),
                  )
                : {},
            lastSalesRevenueByGoodId:
              source.lastSalesRevenueByGoodId && typeof source.lastSalesRevenueByGoodId === "object"
                ? Object.fromEntries(
                    Object.entries(source.lastSalesRevenueByGoodId as Record<string, unknown>).map(([goodId, valueRaw]) => [
                      goodId,
                      Number.isFinite(Number(valueRaw)) ? round3(Math.max(0, Number(valueRaw))) : 0,
                    ]),
                  )
                : {},
            lastConsumptionByGoodId:
              source.lastConsumptionByGoodId && typeof source.lastConsumptionByGoodId === "object"
                ? Object.fromEntries(
                    Object.entries(source.lastConsumptionByGoodId as Record<string, unknown>).map(([goodId, valueRaw]) => [
                      goodId,
                      Number(
                        (
                          typeof valueRaw === "number" && Number.isFinite(valueRaw) ? Math.max(0, valueRaw) : 0
                        ).toFixed(3),
                      ),
                    ]),
                  )
                : {},
            lastProductionByGoodId:
              source.lastProductionByGoodId && typeof source.lastProductionByGoodId === "object"
                ? Object.fromEntries(
                    Object.entries(source.lastProductionByGoodId as Record<string, unknown>).map(([goodId, valueRaw]) => [
                      goodId,
                      Number(
                        (
                          typeof valueRaw === "number" && Number.isFinite(valueRaw) ? Math.max(0, valueRaw) : 0
                        ).toFixed(3),
                      ),
                    ]),
                  )
                : {},
            lastExtractionByGoodId:
              source.lastExtractionByGoodId && typeof source.lastExtractionByGoodId === "object"
                ? Object.fromEntries(
                    Object.entries(source.lastExtractionByGoodId as Record<string, unknown>).map(([goodId, valueRaw]) => [
                      goodId,
                      Number(
                        (
                          typeof valueRaw === "number" && Number.isFinite(valueRaw) ? Math.max(0, valueRaw) : 0
                        ).toFixed(3),
                      ),
                    ]),
                  )
                : {},
            lastRevenueDucats:
              typeof source.lastRevenueDucats === "number" && Number.isFinite(source.lastRevenueDucats)
                ? Number(source.lastRevenueDucats.toFixed(3))
                : 0,
            lastInputCostDucats:
              typeof source.lastInputCostDucats === "number" && Number.isFinite(source.lastInputCostDucats)
                ? Number(source.lastInputCostDucats.toFixed(3))
                : 0,
            lastWagesDucats:
              typeof source.lastWagesDucats === "number" && Number.isFinite(source.lastWagesDucats)
                ? Number(source.lastWagesDucats.toFixed(3))
                : 0,
            lastStateSubsidyDucats:
              typeof source.lastStateSubsidyDucats === "number" && Number.isFinite(source.lastStateSubsidyDucats)
                ? Number(source.lastStateSubsidyDucats.toFixed(3))
                : 0,
            lastNetDucats:
              typeof source.lastNetDucats === "number" && Number.isFinite(source.lastNetDucats)
                ? Number(source.lastNetDucats.toFixed(3))
                : 0,
            isInactive: Boolean(source.isInactive),
            inactiveReason:
              typeof source.inactiveReason === "string" || source.inactiveReason === null
                ? (source.inactiveReason ?? null)
                : null,
          });
        }
      } else if (raw && typeof raw === "object") {
        // shape normalization: { [buildingId]: level } -> single instance with level.
        for (const [buildingId, levelRaw] of Object.entries(raw as Record<string, unknown>)) {
          const level =
            typeof levelRaw === "number" && Number.isFinite(levelRaw) ? Math.max(0, Math.floor(levelRaw)) : 0;
          if (!buildingId || level <= 0) continue;
          instances.push({
            instanceId: params.createId(),
            buildingId,
            customName: null,
            owner: { type: "state", countryId: fallbackCountryId },
            createdTurnId: params.turnId,
            level,
            currentDurability: params.defaultBuildingDurabilityMax,
            autoUpgradeEnabled: true,
            stateSubsidiesEnabled: true,
            manualWorkEnabled: true,
            ducats: 0,
            warehouseByGoodId: {},
            lastLaborCoverage: 0,
            lastInfraCoverage: 0,
            lastInputCoverage: 0,
            lastFinanceCoverage: 0,
            lastExtractionCoverage: 0,
            lastDurabilityCoverage: 0,
            lastProductivity: 0,
            lastPurchaseByGoodId: {},
            lastPurchaseCostByGoodId: {},
            lastSalesByGoodId: {},
            lastSalesRevenueByGoodId: {},
            lastConsumptionByGoodId: {},
            lastProductionByGoodId: {},
            lastExtractionByGoodId: {},
            lastRevenueDucats: 0,
            lastInputCostDucats: 0,
            lastWagesDucats: 0,
            lastStateSubsidyDucats: 0,
            lastNetDucats: 0,
            isInactive: false,
            inactiveReason: null,
          });
        }
      }
      normalized[hexId] = instances;
    }
  }
  for (const hexId of params.hexIds) {
    if (!normalized[hexId]) {
      normalized[hexId] = [];
    }
  }
  return normalized;
}

export function normalizeRegionPopulationTreasuryMap(params: HexStateNormalizerParams): Record<string, number> {
  const input = params.input;
  const normalized: Record<string, number> = {};
  if (input && typeof input === "object") {
    for (const [hexId, raw] of Object.entries(input as Record<string, unknown>)) {
      const value = typeof raw === "number" && Number.isFinite(raw) ? Math.max(0, raw) : 0;
      normalized[hexId] = Number(value.toFixed(3));
    }
  }
  for (const hexId of params.hexIds) {
    if (normalized[hexId] == null) {
      normalized[hexId] = 0;
    }
  }
  return normalized;
}

export function normalizeRegionBuildingDucatsMap(params: HexStateNormalizerParams): Record<string, Record<string, number>> {
  const input = params.input;
  const normalized: Record<string, Record<string, number>> = {};
  if (input && typeof input === "object") {
    for (const [hexId, raw] of Object.entries(input as Record<string, unknown>)) {
      if (!raw || typeof raw !== "object") continue;
      const byBuilding: Record<string, number> = {};
      for (const [buildingId, valueRaw] of Object.entries(raw as Record<string, unknown>)) {
        const value = typeof valueRaw === "number" && Number.isFinite(valueRaw) ? Math.max(0, valueRaw) : 0;
        if (!buildingId) continue;
        byBuilding[buildingId] = Number(value.toFixed(3));
      }
      normalized[hexId] = byBuilding;
    }
  }
  for (const hexId of params.hexIds) {
    if (!normalized[hexId]) {
      normalized[hexId] = {};
    }
  }
  return normalized;
}

export function normalizeBuildingOwner(input: unknown, fallbackCountryId: string): BuildingOwner {
  const source = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  if (source.type === "company" && typeof source.companyId === "string" && source.companyId.trim()) {
    return { type: "company", companyId: source.companyId.trim() };
  }
  if (typeof source.countryId === "string" && source.countryId.trim()) {
    return { type: "state", countryId: source.countryId.trim() };
  }
  return { type: "state", countryId: fallbackCountryId };
}

export function normalizeRegionConstructionQueueMap(params: HexStateNormalizerParams): Record<string, RegionConstructionProject[]> {
  const input = params.input;
  const fallbackCountryId = params.fallbackCountryId;
  const normalized: Record<string, RegionConstructionProject[]> = {};
  if (input && typeof input === "object") {
    for (const [hexId, raw] of Object.entries(input as Record<string, unknown>)) {
      const rows = Array.isArray(raw) ? raw : [];
      const projects: RegionConstructionProject[] = [];
      for (const row of rows) {
        if (!row || typeof row !== "object") continue;
        const source = row as Partial<RegionConstructionProject>;
        const queueId = typeof source.queueId === "string" && source.queueId.trim() ? source.queueId.trim() : params.createId();
        const requestedByCountryId =
          typeof source.requestedByCountryId === "string" && source.requestedByCountryId.trim()
            ? source.requestedByCountryId.trim()
            : fallbackCountryId;
        const buildingId = typeof source.buildingId === "string" ? source.buildingId.trim() : "";
        if (!buildingId) continue;
        const projectType = source.projectType === "upgrade" ? "upgrade" : "build";
        const targetInstanceId =
          projectType === "upgrade" && typeof source.targetInstanceId === "string" && source.targetInstanceId.trim().length > 0
            ? source.targetInstanceId.trim()
            : undefined;
        const costConstruction =
          typeof source.costConstruction === "number" && Number.isFinite(source.costConstruction)
            ? Math.max(1, Math.floor(source.costConstruction))
            : 100;
        const costDucats =
          typeof source.costDucats === "number" && Number.isFinite(source.costDucats)
            ? Math.max(0, Number(source.costDucats))
            : 10;
        const progressConstruction =
          typeof source.progressConstruction === "number" && Number.isFinite(source.progressConstruction)
            ? Math.max(0, Math.min(costConstruction, Number(source.progressConstruction)))
            : 0;
        const createdTurnId =
          typeof source.createdTurnId === "number" && Number.isFinite(source.createdTurnId)
            ? Math.max(1, Math.floor(source.createdTurnId))
            : params.turnId;
        projects.push({
          queueId,
          requestedByCountryId,
          buildingId,
          owner: normalizeBuildingOwner(source.owner, fallbackCountryId),
          projectType,
          targetInstanceId,
          progressConstruction: Number(progressConstruction.toFixed(3)),
          costConstruction,
          costDucats: Number(costDucats.toFixed(3)),
          createdTurnId,
        });
      }
      normalized[hexId] = projects;
    }
  }
  for (const hexId of params.hexIds) {
    if (!normalized[hexId]) {
      normalized[hexId] = [];
    }
  }
  return normalized;
}

export function normalizeRegionResourceDepositsMap(params: HexStateNormalizerParams): Record<string, RegionResourceDeposit[]> {
  const input = params.input;
  const normalized: Record<string, RegionResourceDeposit[]> = {};
  if (input && typeof input === "object") {
    const source = input as Record<string, unknown>;
    for (const [hexId, rawRows] of Object.entries(source)) {
      if (!hexId || !Array.isArray(rawRows)) continue;
      const rows: RegionResourceDeposit[] = [];
      for (const rawRow of rawRows) {
        if (!rawRow || typeof rawRow !== "object") continue;
        const row = rawRow as Partial<RegionResourceDeposit>;
        const goodId = typeof row.goodId === "string" ? row.goodId.trim() : "";
        if (!goodId) continue;
        const amount =
          typeof row.amount === "number" && Number.isFinite(row.amount) ? round3(Math.max(0, Number(row.amount))) : 0;
        if (amount <= 0) continue;
        const discoveredTurnId =
          typeof row.discoveredTurnId === "number" && Number.isFinite(row.discoveredTurnId)
            ? Math.max(1, Math.floor(row.discoveredTurnId))
            : params.turnId;
        const veinSize =
          row.veinSize === "small" || row.veinSize === "medium" || row.veinSize === "large"
            ? row.veinSize
            : "small";
        const existing = rows.find((entry) => entry.goodId === goodId);
        if (existing) {
          existing.amount = round3(existing.amount + amount);
          continue;
        }
        rows.push({ goodId, amount, discoveredTurnId, veinSize });
      }
      normalized[hexId] = rows.sort((a, b) => a.goodId.localeCompare(b.goodId));
    }
  }
  for (const hexId of params.hexIds) {
    if (!normalized[hexId]) normalized[hexId] = [];
  }
  return normalized;
}

export function normalizeRegionResourceExplorationQueueMap(params: HexStateNormalizerParams): Record<string, RegionResourceExplorationProject[]> {
  const input = params.input;
  const normalized: Record<string, RegionResourceExplorationProject[]> = {};
  if (input && typeof input === "object") {
    const source = input as Record<string, unknown>;
    for (const [hexId, rawRows] of Object.entries(source)) {
      if (!hexId || !Array.isArray(rawRows)) continue;
      const rows: RegionResourceExplorationProject[] = [];
      for (const rawRow of rawRows) {
        if (!rawRow || typeof rawRow !== "object") continue;
        const row = rawRow as Partial<RegionResourceExplorationProject>;
        const requestedByCountryId =
          typeof row.requestedByCountryId === "string" && row.requestedByCountryId.trim()
            ? row.requestedByCountryId.trim()
            : "";
        if (!requestedByCountryId) continue;
        const queueId = typeof row.queueId === "string" && row.queueId.trim() ? row.queueId.trim() : params.createId();
        const startedTurnId =
          typeof row.startedTurnId === "number" && Number.isFinite(row.startedTurnId)
            ? Math.max(1, Math.floor(row.startedTurnId))
            : params.turnId;
        const turnsRemaining =
          typeof row.turnsRemaining === "number" && Number.isFinite(row.turnsRemaining)
            ? Math.max(0, Math.floor(row.turnsRemaining))
            : 0;
        rows.push({ queueId, requestedByCountryId, startedTurnId, turnsRemaining });
      }
      normalized[hexId] = rows;
    }
  }
  for (const hexId of params.hexIds) {
    if (!normalized[hexId]) normalized[hexId] = [];
  }
  return normalized;
}

export function normalizeRegionResourceExplorationCountMap(params: HexStateNormalizerParams): Record<string, number> {
  const input = params.input;
  const normalized: Record<string, number> = {};
  if (input && typeof input === "object") {
    const source = input as Record<string, unknown>;
    for (const [hexId, rawValue] of Object.entries(source)) {
      if (!hexId) continue;
      const value =
        typeof rawValue === "number" && Number.isFinite(rawValue) ? Math.max(0, Math.floor(rawValue)) : 0;
      normalized[hexId] = value;
    }
  }
  for (const hexId of params.hexIds) {
    if (normalized[hexId] == null) normalized[hexId] = 0;
  }
  return normalized;
}

