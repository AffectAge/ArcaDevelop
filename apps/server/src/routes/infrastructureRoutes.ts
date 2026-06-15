import type express from "express";
import type { TreatyConstructionExpirationPolicy } from "@arcanorum/shared";
import { z } from "zod";
import type { RouteAuth } from "../security/routeAuth";

export type InfrastructureTransportMode = "land" | "sea" | "air" | "pipeline" | "powerGrid";

export type InfrastructureTransitAgreementEntry = {
  id: string;
  fromCountryId: string;
  toCountryId: string;
  transportModes: InfrastructureTransportMode[];
  active: boolean;
  bilateral: boolean;
  sourceProposalId?: string | null;
  sourceClauseId?: string | null;
  expiresTurnId?: number | null;
  createdAt: string;
  updatedAt: string;
};

export type InfrastructureConstructionRightsEntry = {
  id: string;
  fromCountryId: string;
  toCountryId: string;
  transportModes: InfrastructureTransportMode[];
  active: boolean;
  bilateral: boolean;
  expirationPolicy: TreatyConstructionExpirationPolicy;
  sourceProposalId?: string | null;
  sourceClauseId?: string | null;
  expiresTurnId?: number | null;
  createdAt: string;
  updatedAt: string;
};

export const infrastructureTransitAgreementCreateSchema = z.object({
  toCountryId: z.string().trim().min(1).max(120),
  fromCountryId: z.string().trim().min(1).max(120).optional(),
  transportModes: z.array(z.enum(["land", "sea", "air", "pipeline", "powerGrid"])).min(1).max(16),
  active: z.boolean().optional(),
  bilateral: z.boolean().optional(),
});

export const infrastructureTransitAgreementPatchSchema = z.object({
  transportModes: z.array(z.enum(["land", "sea", "air", "pipeline", "powerGrid"])).min(1).max(16).optional(),
  active: z.boolean().optional(),
  bilateral: z.boolean().optional(),
});

export type InfrastructureRoutesDependencies = {
  routeAuth: RouteAuth;
  createId: () => string;
  ensureMarketModelReady: () => void;
  getTransitAgreementsById: () => Record<string, InfrastructureTransitAgreementEntry>;
  getConstructionRightsById: () => Record<string, InfrastructureConstructionRightsEntry>;
  countryIdsExist: (countryIds: string[]) => Promise<Set<string>>;
  normalizeTransportModes: (input: InfrastructureTransportMode[]) => InfrastructureTransportMode[];
  savePersistentState: () => void;
};

export function registerInfrastructureRoutes(
  app: express.Express,
  deps: InfrastructureRoutesDependencies,
): void {
  app.get("/infrastructure-transit-agreements", (req, res) => {
    const auth = deps.routeAuth.requireAuth(req, res);
    if (!auth) return;
    deps.ensureMarketModelReady();
    const agreements = Object.values(deps.getTransitAgreementsById() ?? {})
      .filter((agreement) => auth.isAdmin || agreement.fromCountryId === auth.countryId || agreement.toCountryId === auth.countryId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id));
    return res.json({ agreements });
  });

  app.get("/infrastructure-construction-rights", (req, res) => {
    const auth = deps.routeAuth.requireAuth(req, res);
    if (!auth) return;
    deps.ensureMarketModelReady();
    const rights = Object.values(deps.getConstructionRightsById() ?? {})
      .filter((right) => auth.isAdmin || right.fromCountryId === auth.countryId || right.toCountryId === auth.countryId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id));
    return res.json({ rights });
  });

  app.post("/infrastructure-transit-agreements", async (req, res) => {
    const auth = deps.routeAuth.requireAuth(req, res);
    if (!auth) return;
    const parsed = infrastructureTransitAgreementCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "INVALID_PAYLOAD", issues: parsed.error.issues });
    }
    const fromCountryId = auth.isAdmin && parsed.data.fromCountryId ? parsed.data.fromCountryId : auth.countryId;
    const toCountryId = parsed.data.toCountryId;
    if (fromCountryId === toCountryId) {
      return res.status(400).json({ error: "TRANSIT_COUNTRIES_MUST_DIFFER" });
    }
    const existingCountryIds = await deps.countryIdsExist([fromCountryId, toCountryId]);
    if (!existingCountryIds.has(fromCountryId) || !existingCountryIds.has(toCountryId)) {
      return res.status(404).json({ error: "COUNTRY_NOT_FOUND" });
    }
    const now = new Date().toISOString();
    const agreementId = deps.createId();
    const agreement: InfrastructureTransitAgreementEntry = {
      id: agreementId,
      fromCountryId,
      toCountryId,
      transportModes: deps.normalizeTransportModes(parsed.data.transportModes),
      active: parsed.data.active ?? true,
      bilateral: parsed.data.bilateral ?? true,
      createdAt: now,
      updatedAt: now,
    };
    deps.getTransitAgreementsById()[agreementId] = agreement;
    deps.savePersistentState();
    return res.status(201).json({ agreement });
  });

  app.patch("/infrastructure-transit-agreements/:agreementId", (req, res) => {
    const auth = deps.routeAuth.requireAuth(req, res);
    if (!auth) return;
    const agreementId = String(req.params.agreementId || "").trim();
    const agreement = deps.getTransitAgreementsById()?.[agreementId];
    if (!agreement) {
      return res.status(404).json({ error: "TRANSIT_AGREEMENT_NOT_FOUND" });
    }
    if (!auth.isAdmin && agreement.fromCountryId !== auth.countryId) {
      return res.status(403).json({ error: "TRANSIT_AGREEMENT_OWNER_ONLY" });
    }
    const parsed = infrastructureTransitAgreementPatchSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "INVALID_PAYLOAD", issues: parsed.error.issues });
    }
    if (parsed.data.transportModes) {
      agreement.transportModes = deps.normalizeTransportModes(parsed.data.transportModes);
    }
    if (typeof parsed.data.active === "boolean") agreement.active = parsed.data.active;
    if (typeof parsed.data.bilateral === "boolean") agreement.bilateral = parsed.data.bilateral;
    agreement.updatedAt = new Date().toISOString();
    deps.savePersistentState();
    return res.json({ agreement });
  });

  app.delete("/infrastructure-transit-agreements/:agreementId", (req, res) => {
    const auth = deps.routeAuth.requireAuth(req, res);
    if (!auth) return;
    const agreementId = String(req.params.agreementId || "").trim();
    const agreements = deps.getTransitAgreementsById();
    const agreement = agreements?.[agreementId];
    if (!agreement) {
      return res.status(404).json({ error: "TRANSIT_AGREEMENT_NOT_FOUND" });
    }
    if (!auth.isAdmin && agreement.fromCountryId !== auth.countryId) {
      return res.status(403).json({ error: "TRANSIT_AGREEMENT_OWNER_ONLY" });
    }
    delete agreements[agreementId];
    deps.savePersistentState();
    return res.json({ ok: true });
  });
}
