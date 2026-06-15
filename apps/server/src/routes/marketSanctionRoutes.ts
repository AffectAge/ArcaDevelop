import type express from "express";
import { z } from "zod";
import type { RouteAuth } from "../security/routeAuth";

export type MarketSanctionEntry = {
  id: string;
  initiatorCountryId: string;
  direction: "import" | "export" | "both";
  targetType: "country" | "market";
  targetId: string;
  goods?: string[];
  mode: "ban" | "cap";
  capAmountPerTurn?: number | null;
  startTurn: number;
  durationTurns: number;
  enabled?: boolean;
};

export type MarketSanctionMarket = {
  id: string;
  ownerCountryId: string;
  memberCountryIds: string[];
};

export function createMarketSanctionCreateSchema(maxSettingNumber: number) {
  return z.object({
    direction: z.enum(["import", "export", "both"]),
    targetType: z.enum(["country", "market"]),
    targetId: z.string().trim().min(1).max(120),
    goods: z.array(z.string().trim().min(1).max(120)).max(200).optional(),
    mode: z.enum(["ban", "cap"]),
    capAmountPerTurn: z.coerce.number().min(0).max(maxSettingNumber).nullable().optional(),
    startTurn: z.coerce.number().int().min(1).optional(),
    durationTurns: z.coerce.number().int().min(1).max(maxSettingNumber),
    enabled: z.boolean().optional(),
  });
}

export function createMarketSanctionPatchSchema(maxSettingNumber: number) {
  return z.object({
    direction: z.enum(["import", "export", "both"]).optional(),
    targetType: z.enum(["country", "market"]).optional(),
    targetId: z.string().trim().min(1).max(120).optional(),
    goods: z.array(z.string().trim().min(1).max(120)).max(200).optional(),
    mode: z.enum(["ban", "cap"]).optional(),
    capAmountPerTurn: z.coerce.number().min(0).max(maxSettingNumber).nullable().optional(),
    startTurn: z.coerce.number().int().min(1).optional(),
    durationTurns: z.coerce.number().int().min(1).max(maxSettingNumber).optional(),
    enabled: z.boolean().optional(),
  });
}

export type MarketSanctionRoutesDependencies = {
  routeAuth: RouteAuth;
  maxSettingNumber: number;
  createId: () => string;
  getTurnId: () => number;
  getMarketById: (marketId: string) => MarketSanctionMarket | null | undefined;
  getSanctionsById: () => Record<string, MarketSanctionEntry>;
  countryExists: (countryId: string) => Promise<boolean>;
  getValidGoodIds: () => Set<string>;
  enrichMarketSanctions: (sanctions: MarketSanctionEntry[]) => Promise<unknown[]>;
  round3: (value: number) => number;
  savePersistentState: () => void;
};

export function registerMarketSanctionRoutes(
  app: express.Express,
  deps: MarketSanctionRoutesDependencies,
): void {
  const createSchema = createMarketSanctionCreateSchema(deps.maxSettingNumber);
  const patchSchema = createMarketSanctionPatchSchema(deps.maxSettingNumber);

  app.get("/markets/:marketId/sanctions", async (req, res) => {
    const auth = deps.routeAuth.requireAuth(req, res);
    if (!auth) return;
    const marketId = String(req.params.marketId || "").trim();
    const market = deps.getMarketById(marketId);
    if (!market) {
      return res.status(404).json({ error: "MARKET_NOT_FOUND" });
    }
    const isOwner = market.ownerCountryId === auth.countryId;
    const isMember = market.memberCountryIds.includes(auth.countryId);
    if (!isOwner && !isMember) {
      return res.status(403).json({ error: "FORBIDDEN" });
    }
    const sanctions = Object.values(deps.getSanctionsById() ?? {})
      .filter((sanction) => sanction.initiatorCountryId === market.ownerCountryId)
      .sort((a, b) => b.startTurn - a.startTurn || a.id.localeCompare(b.id));
    return res.json({
      sanctions: await deps.enrichMarketSanctions(sanctions),
      ownerCountryId: market.ownerCountryId,
      turnId: deps.getTurnId(),
    });
  });

  app.post("/markets/:marketId/sanctions", async (req, res) => {
    const auth = deps.routeAuth.requireAuth(req, res);
    if (!auth) return;
    const marketId = String(req.params.marketId || "").trim();
    const market = deps.getMarketById(marketId);
    if (!market) {
      return res.status(404).json({ error: "MARKET_NOT_FOUND" });
    }
    if (market.ownerCountryId !== auth.countryId) {
      return res.status(403).json({ error: "MARKET_OWNER_ONLY" });
    }
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "INVALID_PAYLOAD", issues: parsed.error.issues });
    }
    const payload = parsed.data;
    const targetError = await validateSanctionTarget(payload.targetType, payload.targetId, deps);
    if (targetError) return res.status(404).json({ error: targetError });

    const goodsResult = normalizeSanctionGoods(payload.goods, deps.getValidGoodIds());
    if (!goodsResult.ok) return res.status(400).json({ error: "NO_VALID_GOODS" });
    if (payload.mode === "cap" && (payload.capAmountPerTurn == null || payload.capAmountPerTurn <= 0)) {
      return res.status(400).json({ error: "CAP_AMOUNT_REQUIRED" });
    }
    const sanctionId = deps.createId();
    const sanction: MarketSanctionEntry = {
      id: sanctionId,
      initiatorCountryId: market.ownerCountryId,
      direction: payload.direction,
      targetType: payload.targetType,
      targetId: payload.targetId,
      goods: goodsResult.goods,
      mode: payload.mode,
      capAmountPerTurn: payload.mode === "cap" ? deps.round3(Math.max(0, Number(payload.capAmountPerTurn ?? 0))) : null,
      startTurn: payload.startTurn ?? deps.getTurnId(),
      durationTurns: payload.durationTurns,
      enabled: payload.enabled ?? true,
    };
    deps.getSanctionsById()[sanctionId] = sanction;
    deps.savePersistentState();
    return res.status(201).json({ sanction: (await deps.enrichMarketSanctions([sanction]))[0] });
  });

  app.patch("/markets/:marketId/sanctions/:sanctionId", async (req, res) => {
    const auth = deps.routeAuth.requireAuth(req, res);
    if (!auth) return;
    const marketId = String(req.params.marketId || "").trim();
    const market = deps.getMarketById(marketId);
    if (!market) {
      return res.status(404).json({ error: "MARKET_NOT_FOUND" });
    }
    if (market.ownerCountryId !== auth.countryId) {
      return res.status(403).json({ error: "MARKET_OWNER_ONLY" });
    }
    const sanctionId = String(req.params.sanctionId || "").trim();
    const sanction = deps.getSanctionsById()[sanctionId];
    if (!sanction || sanction.initiatorCountryId !== market.ownerCountryId) {
      return res.status(404).json({ error: "SANCTION_NOT_FOUND" });
    }
    const parsed = patchSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "INVALID_PAYLOAD", issues: parsed.error.issues });
    }
    const payload = parsed.data;
    const nextTargetType = payload.targetType ?? sanction.targetType;
    const nextTargetId = payload.targetId ?? sanction.targetId;
    const targetError = await validateSanctionTarget(nextTargetType, nextTargetId, deps);
    if (targetError) return res.status(404).json({ error: targetError });

    if (Array.isArray(payload.goods)) {
      const goodsResult = normalizeSanctionGoods(payload.goods, deps.getValidGoodIds());
      if (!goodsResult.ok) return res.status(400).json({ error: "NO_VALID_GOODS" });
      sanction.goods = goodsResult.goods;
    }
    sanction.direction = payload.direction ?? sanction.direction;
    sanction.targetType = nextTargetType;
    sanction.targetId = nextTargetId;
    sanction.mode = payload.mode ?? sanction.mode;
    sanction.startTurn = payload.startTurn ?? sanction.startTurn;
    sanction.durationTurns = payload.durationTurns ?? sanction.durationTurns;
    sanction.enabled = payload.enabled ?? sanction.enabled;
    if (sanction.mode === "cap") {
      const cap = payload.capAmountPerTurn ?? sanction.capAmountPerTurn;
      if (cap == null || cap <= 0) {
        return res.status(400).json({ error: "CAP_AMOUNT_REQUIRED" });
      }
      sanction.capAmountPerTurn = deps.round3(Math.max(0, Number(cap)));
    } else {
      sanction.capAmountPerTurn = null;
    }
    deps.savePersistentState();
    return res.json({ sanction: (await deps.enrichMarketSanctions([sanction]))[0] });
  });

  app.delete("/markets/:marketId/sanctions/:sanctionId", (req, res) => {
    const auth = deps.routeAuth.requireAuth(req, res);
    if (!auth) return;
    const marketId = String(req.params.marketId || "").trim();
    const market = deps.getMarketById(marketId);
    if (!market) {
      return res.status(404).json({ error: "MARKET_NOT_FOUND" });
    }
    if (market.ownerCountryId !== auth.countryId) {
      return res.status(403).json({ error: "MARKET_OWNER_ONLY" });
    }
    const sanctionId = String(req.params.sanctionId || "").trim();
    const sanction = deps.getSanctionsById()[sanctionId];
    if (!sanction || sanction.initiatorCountryId !== market.ownerCountryId) {
      return res.status(404).json({ error: "SANCTION_NOT_FOUND" });
    }
    delete deps.getSanctionsById()[sanctionId];
    deps.savePersistentState();
    return res.json({ ok: true });
  });
}

async function validateSanctionTarget(
  targetType: MarketSanctionEntry["targetType"],
  targetId: string,
  deps: Pick<MarketSanctionRoutesDependencies, "countryExists" | "getMarketById">,
): Promise<"TARGET_COUNTRY_NOT_FOUND" | "TARGET_MARKET_NOT_FOUND" | null> {
  if (targetType === "country") {
    return (await deps.countryExists(targetId)) ? null : "TARGET_COUNTRY_NOT_FOUND";
  }
  return deps.getMarketById(targetId) ? null : "TARGET_MARKET_NOT_FOUND";
}

function normalizeSanctionGoods(
  input: string[] | undefined,
  validGoodIds: Set<string>,
): { ok: true; goods: string[] } | { ok: false } {
  const raw = input ?? [];
  const goods = [...new Set(raw.map((goodId) => goodId.trim()).filter(Boolean))].filter((goodId) =>
    validGoodIds.has(goodId),
  );
  if (raw.length > 0 && goods.length === 0) return { ok: false };
  return { ok: true, goods };
}
