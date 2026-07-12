import type express from "express";
import type { Country, ResourceTotals, WorldBase, WsOutMessage } from "@arcanorum/shared";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { AdminCountryDbRecord } from "./adminCountryRoutes";
import type { GameContentEntry, GameSettings } from "../runtime/gameSettingsTypes";
import type { ImageDimensionRule } from "../uploads/uploadValidation";
import type { RouteAuth } from "../security/routeAuth";

export type AuthRegistrationUploadMiddleware = {
  fields: (fields: Array<{ name: string; maxCount?: number }>) => express.RequestHandler;
};

export type AuthRegistrationCountryRecord = AdminCountryDbRecord & {
  passwordHash: string;
};

export type AuthRegistrationWorldState = {
  resourcesByCountry: Record<string, ResourceTotals>;
  hexOwner: Record<string, string>;
  colonyProgressByRegion: Record<string, Record<string, number>>;
  civilianUnitsById: WorldBase["civilianUnitsById"];
  countryPopulationAcceptanceByCountryId?: WorldBase["countryPopulationAcceptanceByCountryId"];
  countryIdentityByCountryId?: WorldBase["countryIdentityByCountryId"];
};

export type CountryBlockInfo = {
  blocked: boolean;
  reason: "PERMANENT" | "TURN" | "TIME" | null;
  blockedUntilTurn: number | null;
  blockedUntilAt: Date | null;
};

export const registerSchema = z.object({
  countryName: z.string().min(2).max(32),
  countryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  cultureGroupId: z.string().min(1).max(120),
  cultureName: z.string().min(2).max(48),
  cultureColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  religionGroupId: z.string().min(1).max(120),
  religionName: z.string().min(2).max(48),
  religionColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  raceId: z.string().min(1).max(120),
  password: z.string().min(8),
});

export const loginSchema = z.object({
  countryId: z.string().min(1),
  password: z.string().min(1),
  rememberMe: z.boolean(),
});

export const registrationReviewSchema = z.object({
  approve: z.boolean(),
});

export type AuthRegistrationRoutesDependencies = {
  routeAuth: RouteAuth;
  upload: AuthRegistrationUploadMiddleware;
  flagImageRule: ImageDimensionRule;
  crestImageRule: ImageDimensionRule;
  identityLogoImageRule: ImageDimensionRule;
  masks: {
    resourcesByCountry: number;
    hexOwner: number;
    colonyProgressByRegion: number;
    unitState: number;
  };
  getTurnId: () => number;
  getWorldBase: () => WorldBase & AuthRegistrationWorldState;
  getRegistrationRequiresAdminApproval: () => boolean;
  getInitialColonizationPoints: () => number;
  getInitialConstructionPoints: () => number;
  getGameSettings: () => GameSettings;
  countryIdentityNameExists: (kind: "culture" | "religion", name: string) => Promise<boolean>;
  countAdminCountries: () => Promise<number>;
  createCountry: (data: {
    id: string;
    name: string;
    color: string;
    flagUrl: string | null;
    crestUrl: string | null;
    cultureId: string;
    cultureName: string;
    cultureColor: string;
    cultureLogoUrl: string | null;
    religionId: string;
    religionName: string;
    religionColor: string;
    religionLogoUrl: string | null;
    cultureGroupId: string;
    religionGroupId: string;
    raceId: string;
    passwordHash: string;
    isAdmin: boolean;
    isRegistrationApproved: boolean;
  }) => Promise<AdminCountryDbRecord>;
  findCountryForLogin: (countryId: string) => Promise<AuthRegistrationCountryRecord | null>;
  findCountry: (countryId: string) => Promise<AdminCountryDbRecord | null>;
  approveCountryRegistration: (countryId: string) => Promise<AdminCountryDbRecord>;
  findFullCountry: (countryId: string) => Promise<AuthRegistrationCountryRecord | null>;
  deleteCountry: (countryId: string) => Promise<void>;
  countryFromDb: (row: AdminCountryDbRecord) => Country;
  hashPassword: (password: string) => Promise<string>;
  comparePassword: (password: string, passwordHash: string) => Promise<boolean>;
  createAuthToken: (
    payload: { id: string; countryId: string; isAdmin: boolean },
    rememberMe: boolean,
  ) => string;
  getCountryBlockInfo: (
    country: { isLocked: boolean; blockedUntilTurn: number | null; blockedUntilAt: Date | null },
    currentTurn: number,
    now: Date,
  ) => CountryBlockInfo;
  cleanupExpiredPunishments: (currentTurn: number, now: Date) => Promise<void>;
  validateImageRule: (file: Express.Multer.File, rule: ImageDimensionRule) => boolean;
  removeUploadedFile: (file: Express.Multer.File | undefined) => void;
  removeUploadedByUrl: (url?: string | null) => void;
  makeVersionedUploadUrl: (relativePath: string) => string;
  invalidateCountryQueryCache: () => void;
  ensureCountryInWorldBase: (countryId: string) => void;
  createStarterColonizerForCountry: (countryId: string) => boolean;
  addCountryToEconomyTick: (countryId: string) => void;
  removeCountryFromEconomyTick: (countryId: string) => void;
  removeCountryFromActiveColonizationIndex: (countryId: string) => void;
  setLastLoginAt: (countryId: string, timestamp: string) => void;
  savePersistentState: () => void;
  cloneWorldBaseSectionSnapshot: (mask: number) => unknown;
  broadcastWorldDeltaFromSectionSnapshot: (previousWorldBase: unknown) => void;
  makeRegistrationApprovalUiNotification: (
    country: Pick<AdminCountryDbRecord, "id" | "name" | "color" | "flagUrl" | "crestUrl"> & { createdAt?: Date | null },
  ) => Extract<WsOutMessage, { type: "UI_NOTIFY" }>["notification"];
  sendUiNotificationToAdmins: (notification: Extract<WsOutMessage, { type: "UI_NOTIFY" }>["notification"]) => void;
  removeQueuedUiNotification: (notificationId: string) => void;
  makeOfficialNews: (input: {
    turn: number;
    category: "politics";
    title: string;
    message: string;
    countryId: string;
    priority: "medium";
    visibility: "public";
  }) => Extract<WsOutMessage, { type: "NEWS_EVENT" }>["event"];
  broadcast: (message: WsOutMessage) => void;
  getClientEventLogRetentionTurns: () => number;
};

export function registerAuthRegistrationRoutes(
  app: express.Express,
  deps: AuthRegistrationRoutesDependencies,
): void {
  app.post(
    "/auth/register",
    deps.upload.fields([
      { name: "flag", maxCount: 1 },
      { name: "crest", maxCount: 1 },
      { name: "cultureLogo", maxCount: 1 },
      { name: "religionLogo", maxCount: 1 },
    ]),
    async (req, res) => {
      const parsed = registerSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "INVALID_PAYLOAD", issues: parsed.error.issues });
      }

      const files = req.files as
        | {
            flag?: Express.Multer.File[];
            crest?: Express.Multer.File[];
            cultureLogo?: Express.Multer.File[];
            religionLogo?: Express.Multer.File[];
          }
        | undefined;
      const flagFile = files?.flag?.[0];
      const crestFile = files?.crest?.[0];
      const cultureLogoFile = files?.cultureLogo?.[0];
      const religionLogoFile = files?.religionLogo?.[0];
      const uploadedFiles = [flagFile, crestFile, cultureLogoFile, religionLogoFile];

      if (flagFile && !deps.validateImageRule(flagFile, deps.flagImageRule)) {
        uploadedFiles.forEach((file) => deps.removeUploadedFile(file));
        return res
          .status(400)
          .json({ error: "IMAGE_DIMENSIONS_TOO_LARGE", field: "flag", max: "192x128" });
      }

      if (crestFile && !deps.validateImageRule(crestFile, deps.crestImageRule)) {
        uploadedFiles.forEach((file) => deps.removeUploadedFile(file));
        return res
          .status(400)
          .json({ error: "IMAGE_DIMENSIONS_TOO_LARGE", field: "crest", max: "128x146" });
      }

      if (cultureLogoFile && !deps.validateImageRule(cultureLogoFile, deps.identityLogoImageRule)) {
        uploadedFiles.forEach((file) => deps.removeUploadedFile(file));
        return res
          .status(400)
          .json({ error: "IMAGE_DIMENSIONS_TOO_LARGE", field: "cultureLogo", max: "64x64" });
      }

      if (religionLogoFile && !deps.validateImageRule(religionLogoFile, deps.identityLogoImageRule)) {
        uploadedFiles.forEach((file) => deps.removeUploadedFile(file));
        return res
          .status(400)
          .json({ error: "IMAGE_DIMENSIONS_TOO_LARGE", field: "religionLogo", max: "64x64" });
      }

      const {
        countryName,
        countryColor,
        cultureGroupId,
        cultureName,
        cultureColor,
        religionGroupId,
        religionName,
        religionColor,
        raceId,
        password,
      } = parsed.data;
      const gameSettings = deps.getGameSettings();
      if (!entryExists(gameSettings.content.cultureGroups, cultureGroupId)) {
        uploadedFiles.forEach((file) => deps.removeUploadedFile(file));
        return res.status(400).json({ error: "UNKNOWN_CULTURE_GROUP" });
      }
      if (!entryExists(gameSettings.content.religionGroups, religionGroupId)) {
        uploadedFiles.forEach((file) => deps.removeUploadedFile(file));
        return res.status(400).json({ error: "UNKNOWN_RELIGION_GROUP" });
      }
      if (!entryExists(gameSettings.content.races, raceId)) {
        uploadedFiles.forEach((file) => deps.removeUploadedFile(file));
        return res.status(400).json({ error: "UNKNOWN_RACE" });
      }
      if (await deps.countryIdentityNameExists("culture", cultureName)) {
        uploadedFiles.forEach((file) => deps.removeUploadedFile(file));
        return res.status(409).json({ error: "CULTURE_NAME_EXISTS" });
      }
      if (await deps.countryIdentityNameExists("religion", religionName)) {
        uploadedFiles.forEach((file) => deps.removeUploadedFile(file));
        return res.status(409).json({ error: "RELIGION_NAME_EXISTS" });
      }
      const passwordHash = await deps.hashPassword(password);

      try {
        const countryId = `country:${randomUUID()}`;
        const cultureId = `culture:${countryId}`;
        const religionId = `religion:${countryId}`;
        const isAdminCountry = (await deps.countAdminCountries()) <= 0;
        const requiresApproval = deps.getRegistrationRequiresAdminApproval() && !isAdminCountry;
        const country = await deps.createCountry({
          id: countryId,
          name: countryName,
          color: countryColor,
          flagUrl: flagFile ? deps.makeVersionedUploadUrl(`flags/${flagFile.filename}`) : null,
          crestUrl: crestFile ? deps.makeVersionedUploadUrl(`crests/${crestFile.filename}`) : null,
          cultureId,
          cultureName,
          cultureColor,
          cultureLogoUrl: cultureLogoFile ? deps.makeVersionedUploadUrl(`culture-logos/${cultureLogoFile.filename}`) : null,
          religionId,
          religionName,
          religionColor,
          religionLogoUrl: religionLogoFile ? deps.makeVersionedUploadUrl(`religion-logos/${religionLogoFile.filename}`) : null,
          cultureGroupId,
          religionGroupId,
          raceId,
          passwordHash,
          isAdmin: isAdminCountry,
          isRegistrationApproved: !requiresApproval,
        });
        deps.invalidateCountryQueryCache();

        const previousWorldBase = deps.cloneWorldBaseSectionSnapshot(
          deps.masks.resourcesByCountry | deps.masks.unitState,
        );
        const worldBase = deps.getWorldBase();
        worldBase.countryPopulationAcceptanceByCountryId ??= {};
        worldBase.countryIdentityByCountryId ??= {};
        worldBase.countryPopulationAcceptanceByCountryId[country.id] = {
          acceptedCultureIds: [cultureId],
          acceptedReligionIds: [religionId],
          acceptedRaceIds: [raceId],
        };
        worldBase.countryIdentityByCountryId[country.id] = {
          cultureId,
          religionId,
          raceId,
          cultureGroupId,
          religionGroupId,
        };
        addRuntimeIdentityContent(gameSettings, {
          cultureId,
          cultureName,
          cultureColor,
          cultureLogoUrl: country.cultureLogoUrl,
          religionId,
          religionName,
          religionColor,
          religionLogoUrl: country.religionLogoUrl,
        });
        if (!worldBase.resourcesByCountry[country.id]) {
          worldBase.resourcesByCountry[country.id] = {
            culture: 5,
            science: 5,
            religion: 5,
            colonization: deps.getInitialColonizationPoints(),
            construction: deps.getInitialConstructionPoints(),
            ducats: 20,
            gold: 80,
          };
          deps.addCountryToEconomyTick(country.id);
        } else {
          deps.addCountryToEconomyTick(country.id);
        }
        deps.createStarterColonizerForCountry(country.id);

        deps.savePersistentState();
        deps.broadcastWorldDeltaFromSectionSnapshot(previousWorldBase);
        if (requiresApproval) {
          deps.sendUiNotificationToAdmins(deps.makeRegistrationApprovalUiNotification(country));
        }
        deps.broadcast({
          type: "NEWS_EVENT",
          event: deps.makeOfficialNews({
            turn: deps.getTurnId(),
            category: "politics",
            title: "Новая страна",
            message: requiresApproval
              ? `Зарегистрирована страна ${country.name} (ожидает подтверждения)`
              : `Зарегистрирована страна ${country.name}`,
            countryId: country.id,
            priority: "medium",
            visibility: "public",
          }),
        });
        return res.status(201).json(deps.countryFromDb(country));
      } catch {
        uploadedFiles.forEach((file) => deps.removeUploadedFile(file));
        return res.status(409).json({ error: "COUNTRY_EXISTS" });
      }
    },
  );

  app.post("/auth/login", async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "INVALID_PAYLOAD", issues: parsed.error.issues });
    }

    const { countryId, password, rememberMe } = parsed.data;
    const now = new Date();
    const turnId = deps.getTurnId();
    await deps.cleanupExpiredPunishments(turnId, now);
    const country = await deps.findCountryForLogin(countryId);

    if (!country) {
      return res.status(404).json({ error: "COUNTRY_NOT_FOUND" });
    }

    const block = deps.getCountryBlockInfo(country, turnId, now);

    if (block.blocked) {
      if (block.reason === "PERMANENT") {
        return res.status(403).json({ error: "ACCOUNT_LOCKED", reason: "PERMANENT", lockReason: country.lockReason ?? null });
      }

      if (block.reason === "TURN") {
        return res.status(403).json({
          error: "ACCOUNT_LOCKED",
          reason: "TURN",
          blockedUntilTurn: block.blockedUntilTurn,
          currentTurn: turnId,
          lockReason: country.lockReason ?? null,
        });
      }

      return res.status(403).json({
        error: "ACCOUNT_LOCKED",
        reason: "TIME",
        blockedUntilAt: block.blockedUntilAt?.toISOString() ?? null,
        lockReason: country.lockReason ?? null,
      });
    }

    const ok = await deps.comparePassword(password, country.passwordHash);
    if (!ok) {
      return res.status(401).json({ error: "INVALID_PASSWORD" });
    }
    if (country.isRegistrationApproved === false) {
      return res.status(403).json({ error: "REGISTRATION_PENDING_APPROVAL" });
    }

    deps.ensureCountryInWorldBase(country.id);
    deps.setLastLoginAt(country.id, new Date().toISOString());
    const token = deps.createAuthToken(
      { id: `player-${country.id}`, countryId: country.id, isAdmin: country.isAdmin },
      rememberMe,
    );
    return res.json({
      token,
      playerId: `player-${country.id}`,
      countryId: country.id,
      isAdmin: country.isAdmin,
      worldBase: deps.getWorldBase(),
      turnId,
      clientSettings: { eventLogRetentionTurns: deps.getClientEventLogRetentionTurns() },
    });
  });

  app.patch("/admin/registrations/:countryId/review", async (req, res) => {
    if (!(await deps.routeAuth.requireAdmin(req, res))) return;
    const parsed = registrationReviewSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "INVALID_PAYLOAD", issues: parsed.error.issues });
    }
    const targetId = String(req.params.countryId);
    const target = await deps.findCountry(targetId);
    if (!target) {
      return res.status(404).json({ error: "COUNTRY_NOT_FOUND" });
    }
    if (target.isRegistrationApproved) {
      return res.status(400).json({ error: "REGISTRATION_ALREADY_REVIEWED" });
    }

    if (parsed.data.approve) {
      const updated = await deps.approveCountryRegistration(targetId);
      deps.invalidateCountryQueryCache();
      deps.removeQueuedUiNotification(`registration-approval:${targetId}`);
      deps.broadcast({
        type: "NEWS_EVENT",
        event: deps.makeOfficialNews({
          turn: deps.getTurnId(),
          category: "politics",
          title: "Регистрация подтверждена",
          message: `Администратор подтвердил регистрацию страны ${updated.name}`,
          countryId: updated.id,
          priority: "medium",
          visibility: "public",
        }),
      });
      return res.json({ ok: true, approved: true, country: deps.countryFromDb(updated) });
    }

    const fullTarget = await deps.findFullCountry(targetId);
    if (!fullTarget) {
      return res.status(404).json({ error: "COUNTRY_NOT_FOUND" });
    }
    deps.removeUploadedByUrl(fullTarget.flagUrl);
    deps.removeUploadedByUrl(fullTarget.crestUrl);
    const previousWorldBase = deps.cloneWorldBaseSectionSnapshot(
      deps.masks.resourcesByCountry | deps.masks.hexOwner | deps.masks.colonyProgressByRegion | deps.masks.unitState,
    );
    await deps.deleteCountry(targetId);
    deps.invalidateCountryQueryCache();

    const worldBase = deps.getWorldBase();
    delete worldBase.resourcesByCountry[targetId];
    for (const [unitId, unit] of Object.entries(worldBase.civilianUnitsById)) {
      if (unit.countryId === targetId) delete worldBase.civilianUnitsById[unitId];
    }
    deps.removeCountryFromEconomyTick(targetId);
    for (const [hexId, ownerId] of Object.entries(worldBase.hexOwner)) {
      if (ownerId === targetId) delete worldBase.hexOwner[hexId];
    }
    for (const [hexId, progressByCountry] of Object.entries(worldBase.colonyProgressByRegion)) {
      if (progressByCountry[targetId] != null) {
        delete progressByCountry[targetId];
        if (Object.keys(progressByCountry).length === 0) delete worldBase.colonyProgressByRegion[hexId];
      }
    }
    deps.removeCountryFromActiveColonizationIndex(targetId);
    deps.savePersistentState();
    deps.removeQueuedUiNotification(`registration-approval:${targetId}`);
    deps.broadcastWorldDeltaFromSectionSnapshot(previousWorldBase);
    deps.broadcast({
      type: "NEWS_EVENT",
      event: deps.makeOfficialNews({
        turn: deps.getTurnId(),
        category: "politics",
        title: "Регистрация отклонена",
        message: `Администратор отклонил регистрацию страны ${target.name}`,
        countryId: target.id,
        priority: "medium",
        visibility: "public",
      }),
    });
    return res.json({ ok: true, approved: false, countryId: target.id });
  });
}

function entryExists(entries: GameContentEntry[], id: string): boolean {
  return entries.some((entry) => entry.id === id);
}

function addRuntimeIdentityContent(
  gameSettings: GameSettings,
  identity: {
    cultureId: string;
    cultureName: string;
    cultureColor: string;
    cultureLogoUrl: string | null;
    religionId: string;
    religionName: string;
    religionColor: string;
    religionLogoUrl: string | null;
  },
): void {
  const makeEntry = (id: string, name: string, color: string, logoUrl: string | null): GameContentEntry => ({
    id,
    name,
    description: "",
    color,
    logoUrl,
    malePortraitUrl: null,
    femalePortraitUrl: null,
  });
  if (!gameSettings.content.cultures.some((entry) => entry.id === identity.cultureId)) {
    gameSettings.content.cultures.push(makeEntry(identity.cultureId, identity.cultureName, identity.cultureColor, identity.cultureLogoUrl));
  }
  if (!gameSettings.content.religions.some((entry) => entry.id === identity.religionId)) {
    gameSettings.content.religions.push(makeEntry(identity.religionId, identity.religionName, identity.religionColor, identity.religionLogoUrl));
  }
}
