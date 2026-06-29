import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type {
  GoodDepositCountRule,
  GoodDepositDefinition,
  HexMapArtifact,
  HexId,
  HexTile,
  RegionId,
  RegionResourceDeposit,
  ResourceExplorationResult,
} from "@arcanorum/shared";

export const GENERATED_RESOURCE_DEPOSITS_FILE = "resource-deposits.json";

export type ResourceDepositGoodDefinition = {
  id: string;
  deposit?: GoodDepositDefinition | null;
};

export type GeneratedResourceDepositsPayload = {
  version: 1;
  seed: string;
  depositsByRegion: Record<string, RegionResourceDeposit[]>;
};

export function loadGeneratedResourceDeposits(scenarioDir: string): Record<string, RegionResourceDeposit[]> {
  const filePath = getGeneratedResourceDepositsPath(scenarioDir);
  if (!existsSync(filePath)) return {};
  const parsed = JSON.parse(readFileSync(filePath, "utf8")) as Partial<GeneratedResourceDepositsPayload>;
  return parsed && parsed.version === 1 && parsed.depositsByRegion && typeof parsed.depositsByRegion === "object"
    ? parsed.depositsByRegion
    : {};
}

export function ensureGeneratedResourceDeposits(params: {
  scenarioDir: string;
  artifact: HexMapArtifact;
  goods: ResourceDepositGoodDefinition[];
  authoredDepositsByRegion?: Record<string, RegionResourceDeposit[]>;
  forceGenerated?: boolean;
}): Record<string, RegionResourceDeposit[]> {
  const filePath = getGeneratedResourceDepositsPath(params.scenarioDir);
  if (!params.forceGenerated && existsSync(filePath)) return loadGeneratedResourceDeposits(params.scenarioDir);
  const depositsByRegion = generateResourceDeposits({
    artifact: params.artifact,
    goods: params.goods,
    authoredDepositsByRegion: params.authoredDepositsByRegion,
  });
  const payload: GeneratedResourceDepositsPayload = {
    version: 1,
    seed: params.artifact.settings.seed,
    depositsByRegion,
  };
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return depositsByRegion;
}

export function generateResourceDeposits(params: {
  artifact: HexMapArtifact;
  goods: ResourceDepositGoodDefinition[];
  authoredDepositsByRegion?: Record<string, RegionResourceDeposit[]>;
}): Record<string, RegionResourceDeposit[]> {
  const depositsByRegion: Record<string, RegionResourceDeposit[]> = {};
  const occupiedHexIds = new Set<string>();
  for (const [regionId, rows] of Object.entries(params.authoredDepositsByRegion ?? {})) {
    for (const deposit of rows) {
      occupiedHexIds.add(deposit.hexId);
      depositsByRegion[regionId] ??= [];
    }
  }

  const tilesByRegion = new Map<string, HexTile[]>();
  for (const tile of params.artifact.tiles) {
    const rows = tilesByRegion.get(tile.regionId) ?? [];
    rows.push(tile);
    tilesByRegion.set(tile.regionId, rows);
    depositsByRegion[tile.regionId] ??= [];
  }

  for (const good of [...params.goods].sort((a, b) => a.id.localeCompare(b.id))) {
    const deposit = good.deposit;
    if (!deposit?.enabled) continue;
    const allCandidates = params.artifact.tiles.filter((tile) => !occupiedHexIds.has(tile.id) && matchesDepositRules(tile, deposit));
    const globalCount = resolveCount(deposit.generation?.global, `${params.artifact.settings.seed}:${good.id}:global`);
    const selectedGlobal = pickStableTiles(allCandidates, globalCount, `${params.artifact.settings.seed}:${good.id}:global`);
    for (const tile of selectedGlobal) {
      addGeneratedDeposit(depositsByRegion, occupiedHexIds, good.id, deposit, tile, params.artifact.settings.seed, "global");
    }
    const perRegionCount = resolveCount(deposit.generation?.perRegion, `${params.artifact.settings.seed}:${good.id}:region`);
    if (perRegionCount > 0) {
      for (const [regionId, tiles] of [...tilesByRegion.entries()].sort(([a], [b]) => a.localeCompare(b))) {
        const candidates = tiles.filter((tile) => !occupiedHexIds.has(tile.id) && matchesDepositRules(tile, deposit));
        const selected = pickStableTiles(candidates, perRegionCount, `${params.artifact.settings.seed}:${good.id}:${regionId}`);
        for (const tile of selected) {
          addGeneratedDeposit(depositsByRegion, occupiedHexIds, good.id, deposit, tile, params.artifact.settings.seed, "per_region");
        }
      }
    }
  }

  return Object.fromEntries(
    Object.entries(depositsByRegion).map(([regionId, rows]) => [
      regionId,
      rows.sort((a, b) => a.hexId.localeCompare(b.hexId) || a.goodId.localeCompare(b.goodId) || a.id.localeCompare(b.id)),
    ]),
  );
}

export function createResourceDepositFromExplorationResult(params: {
  result: ResourceExplorationResult;
  good: ResourceDepositGoodDefinition;
  currentTurnId?: number | null;
}): RegionResourceDeposit | null {
  const definition = params.good.deposit;
  if (!definition?.enabled) return null;
  const maxAmount = Math.max(params.result.amount, Number(params.result.maxAmount ?? definition.maxAmount));
  return {
    id: `resource_deposit:${sanitizeStableIdPart(params.result.goodId)}_${sanitizeStableIdPart(params.result.hexId)}`,
    goodId: params.result.goodId,
    hexId: params.result.hexId as HexId,
    regionId: params.result.regionId as RegionId,
    amount: round3(Math.max(0, params.result.amount)),
    maxAmount: round3(maxAmount),
    initialAmount: round3(Math.max(0, params.result.amount)),
    visibility: params.result.visibility ?? "known",
    source: "exploration",
    depletionMode: definition.depletionMode,
    regenPerTurn: definition.regenPerTurn ?? null,
    minRenewableAmount: definition.minRenewableAmount ?? null,
    discoveredTurnId: params.result.discoveredTurnId ?? params.currentTurnId ?? null,
    discoveredByCountryId: params.result.discoveredByCountryId ?? null,
  };
}

function addGeneratedDeposit(
  depositsByRegion: Record<string, RegionResourceDeposit[]>,
  occupiedHexIds: Set<string>,
  goodId: string,
  definition: GoodDepositDefinition,
  tile: HexTile,
  seed: string,
  sourceGeneratorId: string,
): void {
  if (occupiedHexIds.has(tile.id)) return;
  const amount = stableRange(definition.minAmount, definition.maxAmount, `${seed}:${goodId}:${tile.id}:amount`);
  depositsByRegion[tile.regionId] ??= [];
  depositsByRegion[tile.regionId].push({
    id: `resource_deposit:${sanitizeStableIdPart(goodId)}_${sanitizeStableIdPart(tile.id)}`,
    goodId,
    hexId: tile.id,
    regionId: tile.regionId,
    amount,
    maxAmount: round3(Math.max(amount, definition.maxAmount)),
    initialAmount: amount,
    visibility: definition.visibility ?? "known",
    source: "generated",
    depletionMode: definition.depletionMode,
    regenPerTurn: definition.regenPerTurn ?? null,
    minRenewableAmount: definition.minRenewableAmount ?? null,
    discoveredTurnId: null,
    discoveredByCountryId: null,
    sourceGeneratorId,
  });
  occupiedHexIds.add(tile.id);
}

function matchesDepositRules(tile: HexTile, definition: GoodDepositDefinition): boolean {
  const rules = definition.generation;
  if (!rules) return false;
  if (rules.allowedHexTypes?.length && !rules.allowedHexTypes.includes(tile.terrain)) return false;
  if (rules.deniedHexTypes?.includes(tile.terrain)) return false;
  if (rules.allowedLandscapes?.length && !rules.allowedLandscapes.includes(tile.terrain)) return false;
  if (rules.deniedLandscapes?.includes(tile.terrain)) return false;
  if (rules.allowedClimates?.length && !rules.allowedClimates.includes(tile.temperatureBand)) return false;
  if (rules.deniedClimates?.includes(tile.temperatureBand)) return false;
  if (rules.allowedFeatures?.length && !rules.allowedFeatures.includes(tile.feature)) return false;
  if (rules.deniedFeatures?.includes(tile.feature)) return false;
  if (typeof rules.elevationMin === "number" && tile.elevation < rules.elevationMin) return false;
  if (typeof rules.elevationMax === "number" && tile.elevation > rules.elevationMax) return false;
  return true;
}

function resolveCount(rule: GoodDepositCountRule | undefined, seed: string): number {
  if (!rule || typeof rule !== "object") return 0;
  const count = Number((rule as { count?: number }).count);
  if (Number.isFinite(count)) return Math.max(0, Math.floor(count));
  const min = Math.max(0, Math.floor(Number((rule as { min?: number }).min ?? 0)));
  const max = Math.max(min, Math.floor(Number((rule as { max?: number }).max ?? min)));
  if (max <= min) return min;
  return min + Math.floor(stableUnit(seed) * (max - min + 1));
}

function pickStableTiles(tiles: HexTile[], count: number, seed: string): HexTile[] {
  if (count <= 0) return [];
  return [...tiles]
    .sort((a, b) => stableUnit(`${seed}:${a.id}`) - stableUnit(`${seed}:${b.id}`))
    .slice(0, Math.min(count, tiles.length));
}

function stableRange(minRaw: number, maxRaw: number, seed: string): number {
  const min = Math.max(0, Number(minRaw));
  const max = Math.max(min, Number(maxRaw));
  return round3(min + stableUnit(seed) * (max - min));
}

function stableUnit(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 0xffffffff;
}

function round3(value: number): number {
  return Number((Number.isFinite(value) ? value : 0).toFixed(3));
}

function sanitizeStableIdPart(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9:_-]+/g, "_").replace(/^_+|_+$/g, "") || "unknown";
}

function getGeneratedResourceDepositsPath(scenarioDir: string): string {
  return resolve(scenarioDir, ".generated", GENERATED_RESOURCE_DEPOSITS_FILE);
}
