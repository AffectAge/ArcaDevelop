import type { TreatyConstructionExpirationPolicy } from "@arcanorum/shared";
import {
  DEFAULT_TRADEABLE_TRANSPORT_MODES,
  MARKET_PRICE_HISTORY_LENGTH,
  normalizeGoodTransportModesList,
  type GoodTransportMode,
} from "../mechanics/marketTurnMechanics";
import type {
  InfrastructureConstructionRightsEntry,
  InfrastructureTransitAgreementEntry,
  MarketSanctionEntry,
  MarketTradePolicyEntry,
  TransportCorridorEntry,
  TransportCorridorRoutePoint,
  TransportCorridorStatus,
} from "./gameSettingsTypes";

const DEFAULT_TRANSPORT_CORRIDOR_BUILD_COST_PER_SEGMENT = 100;

function round3(value: number): number {
  return Number((Number.isFinite(value) ? value : 0).toFixed(3));
}

export function normalizeMarketId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const next = value.trim();
  if (!next) return null;
  return next;
}

export function normalizeMarketVisibility(value: unknown): "public" | "private" {
  return value === "private" ? "private" : "public";
}


export function normalizeHexIdList(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return [
    ...new Set(
      input
        .filter((row): row is string => typeof row === "string" && row.trim().length > 0)
        .map((row) => row.trim()),
    ),
  ];
}

export function normalizeTransportCorridorRoutePoints(input: unknown): TransportCorridorRoutePoint[] {
  if (!Array.isArray(input)) return [];
  return input.flatMap((raw) => {
    if (!raw || typeof raw !== "object") return [];
    const row = raw as Record<string, unknown>;
    const hexId = typeof row.hexId === "string" ? row.hexId.trim() : "";
    const lng = Number(row.lng);
    const lat = Number(row.lat);
    if (!hexId || !Number.isFinite(lng) || !Number.isFinite(lat)) return [];
    if (lng < -180 || lng > 180 || lat < -90 || lat > 90) return [];
    return [{ hexId, lng, lat }];
  });
}


export function normalizeInfrastructureConstructionExpirationPolicy(input: unknown): TreatyConstructionExpirationPolicy {
  return input === "nationalize_to_territory_owner" ? "nationalize_to_territory_owner" : "disable_without_transit";
}


export function normalizeTransportCorridorStatus(input: unknown): TransportCorridorStatus {
  return input === "active" || input === "closed" || input === "building" ? input : "building";
}


export function getTransportCorridorBuildCost(mode: GoodTransportMode, segments: number): number {
  const multiplier =
    mode === "sea" ? 2 : mode === "air" ? 2.4 : mode === "pipeline" ? 1.8 : mode === "powerGrid" ? 1.7 : 1;
  return Math.max(1, Math.floor(DEFAULT_TRANSPORT_CORRIDOR_BUILD_COST_PER_SEGMENT * Math.max(1, segments) * multiplier));
}


export function normalizeCategoryAmountMap(input: unknown): Record<string, number> {
  if (!input || typeof input !== "object") return {};
  const source = input as Record<string, unknown>;
  const normalized: Record<string, number> = {};
  for (const [key, rawValue] of Object.entries(source)) {
    const nextKey = key.trim();
    if (!nextKey) continue;
    if (typeof rawValue !== "number" || !Number.isFinite(rawValue)) continue;
    const value = round3(Math.max(0, Number(rawValue)));
    if (value <= 0) continue;
    normalized[nextKey] = value;
  }
  return normalized;
}

export function normalizeNumberMap(input: unknown): Record<string, number> {
  if (!input || typeof input !== "object") return {};
  const source = input as Record<string, unknown>;
  const normalized: Record<string, number> = {};
  for (const [key, rawValue] of Object.entries(source)) {
    const nextKey = key.trim();
    if (!nextKey) continue;
    if (typeof rawValue !== "number" || !Number.isFinite(rawValue)) continue;
    normalized[nextKey] = round3(Number(rawValue));
  }
  return normalized;
}

export function normalizeNumberHistoryMap(input: unknown): Record<string, number[]> {
  if (!input || typeof input !== "object") return {};
  const source = input as Record<string, unknown>;
  const normalized: Record<string, number[]> = {};
  for (const [key, rawValue] of Object.entries(source)) {
    const nextKey = key.trim();
    if (!nextKey || !Array.isArray(rawValue)) continue;
    const values = rawValue
      .filter((value): value is number => typeof value === "number" && Number.isFinite(value))
      .map((value) => round3(value))
      .slice(-MARKET_PRICE_HISTORY_LENGTH);
    normalized[nextKey] = values;
  }
  return normalized;
}

export function normalizeMarketTradePolicyEntry(input: unknown): MarketTradePolicyEntry {
  const source = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const normalizeLayer = (
    value: unknown,
  ): {
    allowImportFromWorld?: boolean;
    allowExportToWorld?: boolean;
    maxImportAmountPerTurnFromWorld?: number | null;
    maxExportAmountPerTurnToWorld?: number | null;
  } => {
    const row = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
    return {
      allowImportFromWorld:
        typeof row.allowImportFromWorld === "boolean" ? row.allowImportFromWorld : undefined,
      allowExportToWorld:
        typeof row.allowExportToWorld === "boolean" ? row.allowExportToWorld : undefined,
      maxImportAmountPerTurnFromWorld:
        typeof row.maxImportAmountPerTurnFromWorld === "number" && Number.isFinite(row.maxImportAmountPerTurnFromWorld)
          ? Math.max(0, row.maxImportAmountPerTurnFromWorld)
          : undefined,
      maxExportAmountPerTurnToWorld:
        typeof row.maxExportAmountPerTurnToWorld === "number" && Number.isFinite(row.maxExportAmountPerTurnToWorld)
          ? Math.max(0, row.maxExportAmountPerTurnToWorld)
          : undefined,
    };
  };

  const normalizeOverrides = (
    value: unknown,
  ): Record<
    string,
    {
      allowImportFromWorld?: boolean;
      allowExportToWorld?: boolean;
      maxImportAmountPerTurnFromWorld?: number | null;
      maxExportAmountPerTurnToWorld?: number | null;
    }
  > => {
    if (!value || typeof value !== "object") return {};
    const map = value as Record<string, unknown>;
    const result: Record<string, ReturnType<typeof normalizeLayer>> = {};
    for (const [id, row] of Object.entries(map)) {
      const key = id.trim();
      if (!key) continue;
      result[key] = normalizeLayer(row);
    }
    return result;
  };

  return {
    ...normalizeLayer(source),
    overridesByCountryId: normalizeOverrides(source.overridesByCountryId),
    overridesByMarketId: normalizeOverrides(source.overridesByMarketId),
  };
}

export function normalizeMarketTradePolicyMap(input: unknown): Record<string, MarketTradePolicyEntry> {
  if (!input || typeof input !== "object") return {};
  const source = input as Record<string, unknown>;
  const normalized: Record<string, MarketTradePolicyEntry> = {};
  for (const [resourceId, rawValue] of Object.entries(source)) {
    const key = resourceId.trim();
    if (!key) continue;
    normalized[key] = normalizeMarketTradePolicyEntry(rawValue);
  }
  return normalized;
}

export function normalizeCountryResourceTradePolicyMap(
  input: unknown,
): Record<string, Record<string, MarketTradePolicyEntry>> {
  if (!input || typeof input !== "object") return {};
  const source = input as Record<string, unknown>;
  const normalized: Record<string, Record<string, MarketTradePolicyEntry>> = {};
  for (const [countryId, rawValue] of Object.entries(source)) {
    const key = countryId.trim();
    if (!key) continue;
    normalized[key] = normalizeMarketTradePolicyMap(rawValue);
  }
  return normalized;
}

export function normalizeMarketSanctionsMap(input: unknown, fallbackStartTurn: number): Record<string, MarketSanctionEntry> {
  if (!input || typeof input !== "object") return {};
  const source = input as Record<string, unknown>;
  const normalized: Record<string, MarketSanctionEntry> = {};
  for (const [entryId, rawValue] of Object.entries(source)) {
    const fallbackId = entryId.trim();
    if (!fallbackId) continue;
    const value = rawValue && typeof rawValue === "object" ? (rawValue as Record<string, unknown>) : {};
    const id = typeof value.id === "string" && value.id.trim() ? value.id.trim() : fallbackId;
    const initiatorCountryId =
      typeof value.initiatorCountryId === "string" && value.initiatorCountryId.trim()
        ? value.initiatorCountryId.trim()
        : "";
    const targetId = typeof value.targetId === "string" && value.targetId.trim() ? value.targetId.trim() : "";
    if (!initiatorCountryId || !targetId) continue;
    const directionRaw = typeof value.direction === "string" ? value.direction : "both";
    const direction: MarketSanctionEntry["direction"] =
      directionRaw === "import" || directionRaw === "export" ? directionRaw : "both";
    const targetTypeRaw = typeof value.targetType === "string" ? value.targetType : "country";
    const targetType: MarketSanctionEntry["targetType"] = targetTypeRaw === "market" ? "market" : "country";
    const modeRaw = typeof value.mode === "string" ? value.mode : "ban";
    const mode: MarketSanctionEntry["mode"] = modeRaw === "cap" ? "cap" : "ban";
    const goods = Array.isArray(value.goods)
      ? [
          ...new Set(
            value.goods.filter((row): row is string => typeof row === "string").map((row) => row.trim()).filter(Boolean),
          ),
        ]
      : [];
    const capAmountPerTurn =
      typeof value.capAmountPerTurn === "number" && Number.isFinite(value.capAmountPerTurn)
        ? round3(Math.max(0, Number(value.capAmountPerTurn)))
        : null;
    const startTurn =
      typeof value.startTurn === "number" && Number.isFinite(value.startTurn)
        ? Math.max(1, Math.floor(value.startTurn))
        : Math.max(1, Math.floor(fallbackStartTurn));
    const durationTurns =
      typeof value.durationTurns === "number" && Number.isFinite(value.durationTurns)
        ? Math.max(1, Math.floor(value.durationTurns))
        : 1;
    const enabled = typeof value.enabled === "boolean" ? value.enabled : true;
    normalized[id] = {
      id,
      initiatorCountryId,
      direction,
      targetType,
      targetId,
      goods,
      mode,
      capAmountPerTurn: mode === "cap" ? capAmountPerTurn ?? 0 : null,
      startTurn,
      durationTurns,
      enabled,
    };
  }
  return normalized;
}

export function normalizeInfrastructureTransitAgreementsMap(input: unknown): Record<string, InfrastructureTransitAgreementEntry> {
  if (!input || typeof input !== "object") return {};
  const source = input as Record<string, unknown>;
  const normalized: Record<string, InfrastructureTransitAgreementEntry> = {};
  for (const [entryId, rawValue] of Object.entries(source)) {
    const fallbackId = entryId.trim();
    if (!fallbackId) continue;
    const value = rawValue && typeof rawValue === "object" ? (rawValue as Record<string, unknown>) : {};
    const id = typeof value.id === "string" && value.id.trim() ? value.id.trim() : fallbackId;
    const fromCountryId = typeof value.fromCountryId === "string" ? value.fromCountryId.trim() : "";
    const toCountryId = typeof value.toCountryId === "string" ? value.toCountryId.trim() : "";
    if (!fromCountryId || !toCountryId || fromCountryId === toCountryId) continue;
    const transportModes = normalizeGoodTransportModesList(value.transportModes, DEFAULT_TRADEABLE_TRANSPORT_MODES);
    const createdAt =
      typeof value.createdAt === "string" && value.createdAt.trim().length > 0 ? value.createdAt.trim() : new Date().toISOString();
    const updatedAt =
      typeof value.updatedAt === "string" && value.updatedAt.trim().length > 0 ? value.updatedAt.trim() : createdAt;
    normalized[id] = {
      id,
      fromCountryId,
      toCountryId,
      transportModes,
      active: typeof value.active === "boolean" ? value.active : true,
      bilateral: typeof value.bilateral === "boolean" ? value.bilateral : true,
      sourceProposalId: typeof value.sourceProposalId === "string" && value.sourceProposalId.trim() ? value.sourceProposalId.trim() : null,
      sourceClauseId: typeof value.sourceClauseId === "string" && value.sourceClauseId.trim() ? value.sourceClauseId.trim() : null,
      expiresTurnId: typeof value.expiresTurnId === "number" && Number.isFinite(value.expiresTurnId) ? Math.floor(value.expiresTurnId) : null,
      createdAt,
      updatedAt,
    };
  }
  return normalized;
}

export function normalizeInfrastructureConstructionRightsMap(input: unknown): Record<string, InfrastructureConstructionRightsEntry> {
  if (!input || typeof input !== "object") return {};
  const source = input as Record<string, unknown>;
  const normalized: Record<string, InfrastructureConstructionRightsEntry> = {};
  for (const [entryId, rawValue] of Object.entries(source)) {
    const fallbackId = entryId.trim();
    if (!fallbackId) continue;
    const value = rawValue && typeof rawValue === "object" ? (rawValue as Record<string, unknown>) : {};
    const id = typeof value.id === "string" && value.id.trim() ? value.id.trim() : fallbackId;
    const fromCountryId = typeof value.fromCountryId === "string" ? value.fromCountryId.trim() : "";
    const toCountryId = typeof value.toCountryId === "string" ? value.toCountryId.trim() : "";
    if (!fromCountryId || !toCountryId || fromCountryId === toCountryId) continue;
    const createdAt =
      typeof value.createdAt === "string" && value.createdAt.trim().length > 0 ? value.createdAt.trim() : new Date().toISOString();
    const updatedAt =
      typeof value.updatedAt === "string" && value.updatedAt.trim().length > 0 ? value.updatedAt.trim() : createdAt;
    normalized[id] = {
      id,
      fromCountryId,
      toCountryId,
      transportModes: normalizeGoodTransportModesList(value.transportModes, DEFAULT_TRADEABLE_TRANSPORT_MODES),
      active: typeof value.active === "boolean" ? value.active : true,
      bilateral: typeof value.bilateral === "boolean" ? value.bilateral : true,
      expirationPolicy: normalizeInfrastructureConstructionExpirationPolicy(value.expirationPolicy),
      sourceProposalId: typeof value.sourceProposalId === "string" && value.sourceProposalId.trim() ? value.sourceProposalId.trim() : null,
      sourceClauseId: typeof value.sourceClauseId === "string" && value.sourceClauseId.trim() ? value.sourceClauseId.trim() : null,
      expiresTurnId: typeof value.expiresTurnId === "number" && Number.isFinite(value.expiresTurnId) ? Math.floor(value.expiresTurnId) : null,
      createdAt,
      updatedAt,
    };
  }
  return normalized;
}

export function normalizeCorridorForeignConstructionRights(input: unknown): NonNullable<TransportCorridorEntry["foreignConstructionRights"]> {
  if (!Array.isArray(input)) return [];
  return input.flatMap((raw) => {
    if (!raw || typeof raw !== "object") return [];
    const row = raw as Record<string, unknown>;
    const hexId = typeof row.hexId === "string" ? row.hexId.trim() : "";
    const grantorCountryId = typeof row.grantorCountryId === "string" ? row.grantorCountryId.trim() : "";
    const agreementId = typeof row.agreementId === "string" ? row.agreementId.trim() : "";
    if (!hexId || !grantorCountryId || !agreementId) return [];
    return [{
      hexId,
      grantorCountryId,
      agreementId,
      expirationPolicy: normalizeInfrastructureConstructionExpirationPolicy(row.expirationPolicy),
      sourceProposalId: typeof row.sourceProposalId === "string" && row.sourceProposalId.trim() ? row.sourceProposalId.trim() : null,
      sourceClauseId: typeof row.sourceClauseId === "string" && row.sourceClauseId.trim() ? row.sourceClauseId.trim() : null,
    }];
  });
}


