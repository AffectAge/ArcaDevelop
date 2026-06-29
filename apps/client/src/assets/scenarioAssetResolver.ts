import { apiBase } from "../lib/apiBase";

export type ScenarioAssetEntry = {
  id: string;
  type: "icon" | "atlas" | "image";
  path: string;
  width: number;
  height: number;
};

export type ScenarioAssetRegistryPayload = {
  activeScenarioId?: string | null;
  assets?: ScenarioAssetEntry[] | null;
};

export function resolveScenarioAssetUrl(
  assetId: string | null | undefined,
  registry: ScenarioAssetRegistryPayload | null | undefined,
): string | null {
  if (!assetId || !assetId.startsWith("asset:") || !registry?.activeScenarioId || !Array.isArray(registry.assets)) return null;
  const asset = registry.assets.find((item) => item.id === assetId);
  if (!asset || !isSafeScenarioAssetPath(asset.path)) return null;
  return `${apiBase}/scenario-assets/${encodeURIComponent(registry.activeScenarioId)}/${asset.path}`;
}

export function resolveAuthoredAssetUrl(
  value: string | null | undefined,
  registry: ScenarioAssetRegistryPayload | null | undefined,
): string | null | undefined {
  if (!value) return value;
  if (value.startsWith("asset:")) return resolveScenarioAssetUrl(value, registry);
  return value;
}

function isSafeScenarioAssetPath(path: string): boolean {
  return path.startsWith("assets/") && !path.includes("://") && !path.includes("../") && !path.startsWith("/");
}
