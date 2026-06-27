import express from "express";
import { describe, expect, it, vi } from "vitest";
import type { Division, DivisionStats, DivisionTemplate, EquipmentVariant } from "@arcanorum/shared";
import type { RouteAuth } from "../security/routeAuth";
import { registerMilitaryRoutes, type MilitaryRoutesDependencies } from "./militaryRoutes";

const stats: DivisionStats = {
  manpower: 1000,
  attack: 1,
  defense: 2,
  breakthrough: 1,
  organization: 10,
  hp: 20,
  speed: 4,
  supplyUse: 0.5,
};

describe("militaryRoutes", () => {
  it("serves overview after ensuring country state", async () => {
    const deps = makeDeps();
    const app = makeApp(deps);

    const response = await request(app, "/military/overview");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: "military", countryId: "country-a" });
    expect(deps.ensureCountryInWorldBase).toHaveBeenCalledWith("country-a");
  });

  it("creates an army template through injected world accessors", async () => {
    const deps = makeDeps();
    const app = makeApp(deps);

    const response = await request(app, "/army/templates", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "First Division",
        battalions: [{ battalionTypeId: "infantry", count: 2 }],
      }),
    });

    expect(response.status).toBe(200);
    expect(deps.setCountryDivisionTemplates).toHaveBeenCalledWith(
      "country-a",
      [
        expect.objectContaining({
          id: "id-1",
          countryId: "country-a",
          name: "First Division",
          battalions: [{ id: "id-2", battalionTypeId: "infantry", count: 2 }],
          stats,
        }),
      ],
    );
    expect(deps.savePersistentState).toHaveBeenCalledOnce();
    expect(deps.broadcastWorldDeltaFromSectionSnapshot).toHaveBeenCalledOnce();
  });

  it("prevents deleting templates used by existing divisions", async () => {
    const deps = makeDeps({
      templates: {
        "country-a": [makeTemplate({ id: "template-a" })],
      },
      divisions: {
        "division-a": makeDivision({ templateId: "template-a" }),
      },
    });
    const app = makeApp(deps);

    const response = await request(app, "/army/templates/template-a", { method: "DELETE" });

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "TEMPLATE_IN_USE" });
    expect(deps.setCountryDivisionTemplates).not.toHaveBeenCalled();
  });

  it("creates an equipment variant through injected equipment catalogs", async () => {
    const deps = makeDeps();
    const app = makeApp(deps);

    const response = await request(app, "/military/equipment/variants", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        classId: "equipment_class:test",
        name: "Test Spear Kit",
        moduleIdsBySlotId: { weapon: "equipment_module:spear" },
      }),
    });

    expect(response.status).toBe(200);
    expect(Object.values(deps.getEquipmentVariantsById())).toEqual([
      expect.objectContaining({
        id: "equipment_variant:country-a:id-1",
        countryId: "country-a",
        classId: "equipment_class:test",
        name: "Test Spear Kit",
        stats: { attack: 3 },
        goodsCost: [{ goodId: "good:wood", amount: 1 }],
      }),
    ]);
    expect(deps.savePersistentState).toHaveBeenCalledOnce();
    expect(deps.broadcastWorldDeltaFromSectionSnapshot).toHaveBeenCalledOnce();
  });

  it("saves military template equipment requirements", async () => {
    const deps = makeDeps();
    const app = makeApp(deps);

    const response = await request(app, "/military/templates", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        kind: "land",
        name: "Equipped Division",
        components: [{ typeId: "infantry", count: 2 }],
        equipmentRequirements: [
          { equipmentClassId: "equipment_class:test", role: "attack", count: 200 },
        ],
      }),
    });

    expect(response.status).toBe(200);
    expect(deps.setCountryDivisionTemplates).toHaveBeenCalledWith(
      "country-a",
      [
        expect.objectContaining({
          id: "id-1",
          name: "Equipped Division",
          equipmentRequirements: [
            {
              id: "equipment_class:test:attack",
              equipmentClassId: "equipment_class:test",
              role: "attack",
              count: 200,
            },
          ],
        }),
      ],
    );
  });
});

function makeApp(deps: MilitaryRoutesDependencies): express.Express {
  const app = express();
  app.use(express.json());
  registerMilitaryRoutes(app, deps);
  return app;
}

function makeDeps(overrides?: {
  templates?: Record<string, DivisionTemplate[]>;
  divisions?: Record<string, Division>;
}): MilitaryRoutesDependencies {
  const templates = overrides?.templates ?? {};
  const divisions = overrides?.divisions ?? {};
  const equipmentVariants: Record<string, EquipmentVariant> = {};
  let nextId = 1;
  return {
    routeAuth: createAllowedRouteAuth(),
    upload: { single: () => (_req, _res, next) => next() },
    masks: {
      divisionTemplatesByCountry: 1,
      divisionsById: 2,
      resourcesByCountry: 4,
      militaryFormationQueueByCountry: 8,
      unitEquipmentState: 16,
    },
    createId: () => `id-${nextId++}`,
    getTurnId: () => 3,
    ensureCountryInWorldBase: vi.fn(),
    buildArmyOverview: (countryId) => ({ ok: "army", countryId }),
    buildMilitaryOverview: (countryId) => ({ ok: "military", countryId }),
    getCountryDivisionTemplates: (countryId) => templates[countryId] ?? [],
    setCountryDivisionTemplates: vi.fn((countryId, nextTemplates) => {
      templates[countryId] = nextTemplates;
    }),
    getCountryDivisionsById: () => divisions,
    getCountryMilitaryQueue: () => [],
    setCountryMilitaryQueue: vi.fn(),
    getEquipmentClasses: () => [
      { id: "equipment_class:test", branch: "land", slotIds: ["weapon"], roles: ["attack"], baseStats: { attack: 1 } },
    ],
    getEquipmentModules: () => [
      {
        id: "equipment_module:spear",
        classId: "equipment_class:test",
        slotId: "weapon",
        stats: { attack: 2 },
        goodsCost: [{ goodId: "good:wood", amount: 1 }],
      },
    ],
    getEquipmentVariantsById: () => equipmentVariants,
    getCountryEquipmentProductionLines: () => [],
    setCountryEquipmentProductionLines: vi.fn(),
    getHexOwner: () => "country-a",
    normalizeMilitaryTemplateComponents: (_input, _kind, fallbackBattalions) =>
      fallbackBattalions?.map((battalion) => ({
        id: battalion.id,
        typeId: battalion.battalionTypeId,
        count: battalion.count,
        role: "line",
      })) ?? [{ id: "component-a", typeId: "infantry", count: 2, role: "line" }],
    componentsToDivisionBattalions: (components) =>
      components.map((component) => ({
        id: component.id,
        battalionTypeId: component.typeId,
        count: component.count,
      })),
    getMilitaryContentById: () => ({ id: "infantry" }),
    getBattalionContentById: () => ({ id: "infantry" }),
    calculateMilitaryStats: () => stats,
    calculateDivisionStats: () => stats,
    calculateMilitaryFormationCost: () => ({ ducats: 0, manpower: 1000, equipmentNeeds: [] }),
    calculateDivisionTrainingCost: () => ({ ducats: 0, manpower: 1000, equipmentNeeds: [] }),
    calculateFormationTurns: () => 1,
    spendMilitaryFormationCost: () => ({ ok: true }),
    spendDivisionTrainingCost: () => ({ ok: true }),
    cloneWorldBaseSectionSnapshot: vi.fn(() => ({ snapshot: true })),
    savePersistentState: vi.fn(),
    broadcastWorldDeltaFromSectionSnapshot: vi.fn(),
    removeUploadedFile: vi.fn(),
    removeUploadedByUrl: vi.fn(),
    makeVersionedUploadUrl: (relativePath) => `/scenario-assets/demo/assets/uploads/${relativePath}?v=1`,
    validateTemplateIcon: () => "ok",
  };
}

function createAllowedRouteAuth(): RouteAuth {
  return {
    requireAuth: vi.fn().mockReturnValue({ countryId: "country-a" }),
    requireAuthOrCleanup: vi.fn().mockReturnValue({ countryId: "country-a" }),
    requireAdmin: vi.fn(),
    requireAdminOrCleanup: vi.fn(),
    requireSelfOrAdmin: vi.fn(),
  } as unknown as RouteAuth;
}

function makeTemplate(overrides?: Partial<DivisionTemplate>): DivisionTemplate {
  return {
    id: "template",
    countryId: "country-a",
    name: "Template",
    battalions: [{ id: "battalion-a", battalionTypeId: "infantry", count: 1 }],
    stats,
    createdTurnId: 1,
    updatedTurnId: 1,
    ...overrides,
  };
}

function makeDivision(overrides?: Partial<Division>): Division {
  return {
    id: "division",
    countryId: "country-a",
    templateId: "template",
    name: "Division",
    hexId: "hex:0:0",
    strength: 1,
    organization: 10,
    stats,
    status: "idle",
    path: [],
    createdTurnId: 1,
    lastMovedTurnId: null,
    ...overrides,
  };
}

async function request(app: express.Express, path: string, init?: RequestInit): Promise<Response> {
  const server = app.listen(0);
  try {
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("server did not bind to a port");
    return await fetch(`http://127.0.0.1:${address.port}${path}`, init);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}
