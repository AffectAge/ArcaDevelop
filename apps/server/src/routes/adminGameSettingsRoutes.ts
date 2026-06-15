import type express from "express";
import { z } from "zod";
import type { RouteAuth } from "../security/routeAuth";

export type AdminGameSettingsRoutesDependencies = {
  routeAuth: RouteAuth;
  getGameSettings: () => unknown;
  applyGameSettingsUpdate: (input: GameSettingsPatchInput, actorCountryId: string) => unknown;
  maxSettingNumber: number;
};

export function createGameSettingsPatchSchema(maxSettingNumber: number) {
  return z.object({
    economy: z
      .object({
        baseCulturePerTurn: z.coerce.number().int().min(0).max(maxSettingNumber).optional(),
        baseSciencePerTurn: z.coerce.number().int().min(0).max(maxSettingNumber).optional(),
        baseReligionPerTurn: z.coerce.number().int().min(0).max(maxSettingNumber).optional(),
        baseConstructionPerTurn: z.coerce.number().int().min(0).max(maxSettingNumber).optional(),
        baseDucatsPerTurn: z.coerce.number().int().min(0).max(maxSettingNumber).optional(),
        baseGoldPerTurn: z.coerce.number().int().min(0).max(maxSettingNumber).optional(),
        demolitionCostConstructionPercent: z.coerce.number().int().min(0).max(100).optional(),
        marketPriceSmoothing: z.coerce.number().min(0).max(1).optional(),
        buildingDurabilityDecayPerTurn: z.coerce.number().min(0).max(maxSettingNumber).optional(),
        buildingDurabilityRecoveryPerTurn: z.coerce.number().min(0).max(maxSettingNumber).optional(),
        pollutionProductivityEffectPer1000: z.coerce.number().min(0).max(maxSettingNumber).optional(),
        explorationBaseEmptyChancePct: z.coerce.number().min(0).max(100).optional(),
        explorationDepletionPerAttemptPct: z.coerce.number().min(0).max(100).optional(),
        explorationDurationTurns: z.coerce.number().int().min(1).max(3650).optional(),
        explorationRollsPerExpedition: z.coerce.number().int().min(1).max(100).optional(),
      })
      .optional(),
    markets: z
      .object({
        countryMarketByCountryId: z.record(z.string().trim().min(1).max(120)).optional(),
        sanctionsById: z.record(z.unknown()).optional(),
        infrastructureTransitAgreementsById: z.record(z.unknown()).optional(),
        infrastructureConstructionRightsById: z.record(z.unknown()).optional(),
      })
      .optional(),
    colonization: z
      .object({
        maxActiveColonizations: z.coerce.number().int().min(1).max(1000).optional(),
        pointsPerTurn: z.coerce.number().int().min(0).max(maxSettingNumber).optional(),
        pointsCostPer1000Km2: z.coerce.number().int().min(1).max(maxSettingNumber).optional(),
        ducatsCostPer1000Km2: z.coerce.number().int().min(0).max(maxSettingNumber).optional(),
      })
      .optional(),
    customization: z
      .object({
        renameDucats: z.coerce.number().int().min(0).max(maxSettingNumber).optional(),
        recolorDucats: z.coerce.number().int().min(0).max(maxSettingNumber).optional(),
        flagDucats: z.coerce.number().int().min(0).max(maxSettingNumber).optional(),
        crestDucats: z.coerce.number().int().min(0).max(maxSettingNumber).optional(),
        provinceRenameDucats: z.coerce.number().int().min(0).max(maxSettingNumber).optional(),
      })
      .optional(),
    registration: z.object({ requireAdminApproval: z.boolean().optional() }).optional(),
    eventLog: z.object({ retentionTurns: z.coerce.number().int().min(1).max(100).optional() }).optional(),
    turnTimer: z
      .object({
        enabled: z.boolean().optional(),
        secondsPerTurn: z.coerce.number().int().min(10).max(2_592_000).optional(),
        pauseWhenNoPlayersOnline: z.boolean().optional(),
      })
      .optional(),
    map: z
      .object({
        showAntarctica: z.boolean().optional(),
        backgroundImageUrl: z.string().max(400).nullable().optional(),
      })
      .optional(),
  });
}

export type GameSettingsPatchInput = z.infer<ReturnType<typeof createGameSettingsPatchSchema>>;

export function registerAdminGameSettingsRoutes(
  app: express.Express,
  deps: AdminGameSettingsRoutesDependencies,
): void {
  const schema = createGameSettingsPatchSchema(deps.maxSettingNumber);

  app.get("/admin/game-settings", async (req, res) => {
    if (!(await deps.routeAuth.requireAdmin(req, res))) return;
    return res.json(deps.getGameSettings());
  });

  app.patch("/admin/game-settings", async (req, res) => {
    const auth = await deps.routeAuth.requireAdmin(req, res);
    if (!auth) return;
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "INVALID_PAYLOAD", issues: parsed.error.issues });
    }
    return res.json(deps.applyGameSettingsUpdate(parsed.data, auth.countryId));
  });
}
