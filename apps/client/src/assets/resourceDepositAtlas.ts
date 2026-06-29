import type { RegionResourceDeposit } from "@arcanorum/shared";

export const RESOURCE_DEPOSIT_ATLAS_FRAME_SIZE = 64;
export const RESOURCE_DEPOSIT_ATLAS_TIERS = 4;
export const RESOURCE_DEPOSIT_ATLAS_VARIANTS = 3;
export const RESOURCE_DEPOSIT_ATLAS_COLUMNS = RESOURCE_DEPOSIT_ATLAS_TIERS * RESOURCE_DEPOSIT_ATLAS_VARIANTS;
export const RESOURCE_DEPOSIT_ATLAS_ROWS = [
  "good:wood",
  "good:fish",
  "good:stone",
  "good:coal",
  "good:iron_ore",
  "good:grain",
  "good:wool",
] as const;
export const RESOURCE_DEPOSIT_ATLAS_WIDTH = RESOURCE_DEPOSIT_ATLAS_FRAME_SIZE * RESOURCE_DEPOSIT_ATLAS_COLUMNS;
export const RESOURCE_DEPOSIT_ATLAS_HEIGHT = RESOURCE_DEPOSIT_ATLAS_FRAME_SIZE * RESOURCE_DEPOSIT_ATLAS_ROWS.length;
export const RESOURCE_DEPOSIT_ATLAS_FALLBACK_URL = "/game-assets/resources/fallback-resource-deposit-atlas.png";

export function getResourceDepositAtlasUrl(scenarioId: string | null | undefined): string {
  const normalizedScenarioId = scenarioId && /^[a-zA-Z0-9_-]+$/.test(scenarioId) ? scenarioId : "default";
  return `/scenario-assets/${normalizedScenarioId}/assets/resources/resource-deposit-atlas.png`;
}

export function getResourceDepositAtlasRow(goodId: string): number {
  const index = RESOURCE_DEPOSIT_ATLAS_ROWS.indexOf(goodId as (typeof RESOURCE_DEPOSIT_ATLAS_ROWS)[number]);
  return index >= 0 ? index : 0;
}

export function resolveResourceDepositTier(deposit: Pick<RegionResourceDeposit, "amount" | "maxAmount">): number {
  const maxAmount = Math.max(0, Number(deposit.maxAmount ?? 0));
  if (maxAmount <= 0) return 0;
  const ratio = Math.max(0, Math.min(1, Number(deposit.amount ?? 0) / maxAmount));
  if (ratio >= 0.8) return 3;
  if (ratio >= 0.5) return 2;
  if (ratio >= 0.25) return 1;
  return 0;
}

export function resolveResourceDepositVariant(seed: string, variants = RESOURCE_DEPOSIT_ATLAS_VARIANTS): number {
  if (variants <= 1) return 0;
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % variants;
}

export function resolveResourceDepositAtlasFrame(deposit: Pick<RegionResourceDeposit, "goodId" | "hexId" | "amount" | "maxAmount">): number {
  const tier = resolveResourceDepositTier(deposit);
  const variant = resolveResourceDepositVariant(`${deposit.goodId}:${deposit.hexId}`);
  return tier * RESOURCE_DEPOSIT_ATLAS_VARIANTS + variant;
}
