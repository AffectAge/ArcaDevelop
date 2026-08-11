import {
  GameSession,
  compileScenario,
  type CommandHandler,
  type TurnSystem,
} from "./engine";
import type {
  EngineCommandEnvelope,
  JsonObject,
  ScenarioBundle,
} from "./types";

export const engineV2DemoScenario: ScenarioBundle = {
  manifest: {
    schemaVersion: 2,
    engineVersion: "2",
    id: "engine-v2-demo",
    name: "Arcanorum Engine v2 Demo",
    startDate: "1836-01-01",
    seed: "arcanorum-engine-v2",
    defines: {
      daysPerTurn: 7,
      maxQueuedCommands: 1_000,
      maxQueuedCommandsPerCountry: 100,
      commandHistoryLimit: 10_000,
    },
  },
  common: {
    goods: [
      {
        id: "grain",
        nameKey: "goods.grain",
        categoryId: "staple",
        basePrice: 2.4,
        color: "#b99856",
      },
      {
        id: "clothes",
        nameKey: "goods.clothes",
        categoryId: "consumer",
        basePrice: 6.5,
        color: "#8f6b57",
      },
    ],
    popTypes: [
      {
        id: "farmers",
        nameKey: "pop_types.farmers",
        strata: "poor",
        promotesTo: ["craftsmen"],
        needs: { grain: 1, clothes: 0.1 },
      },
      {
        id: "craftsmen",
        nameKey: "pop_types.craftsmen",
        strata: "poor",
        demotesTo: ["farmers"],
        needs: { grain: 1, clothes: 0.25 },
      },
    ],
    unitTypes: [
      {
        id: "infantry",
        nameKey: "unit_types.infantry",
        domain: "land",
        attack: 4,
        defense: 5,
        speed: 1,
        supplyUse: 1,
      },
    ],
    buildingTypes: [
      {
        id: "grain_farm",
        nameKey: "buildings.grain_farm",
        maxLevel: 20,
        workforce: { farmers: 10_000 },
        inputGoods: {},
        outputGoods: { grain: 20 },
      },
      {
        id: "textile_mill",
        nameKey: "buildings.textile_mill",
        maxLevel: 20,
        workforce: { craftsmen: 10_000 },
        inputGoods: {},
        outputGoods: { clothes: 8 },
      },
    ],
    technologies: [
      {
        id: "mechanical_production",
        nameKey: "technologies.mechanical_production",
        cost: 4_000,
        modifiers: [
          { stat: "building_throughput", operation: "multiply", value: 1.1 },
        ],
      },
    ],
  },
  history: {
    countries: [
      {
        id: "arc",
        tag: "ARC",
        nameKey: "countries.arc",
        color: "#315f66",
        capitalProvinceId: "province:1",
        marketId: "market:arc",
        treasury: 1_000,
        taxRate: 0.25,
        baseTaxIncome: 80,
        primaryCultureId: "arcanian",
        acceptedCultureIds: ["arcanian"],
        governmentId: "constitutional_monarchy",
        technologyIds: ["mechanical_production"],
      },
      {
        id: "bor",
        tag: "BOR",
        nameKey: "countries.bor",
        color: "#7c3f35",
        capitalProvinceId: "province:3",
        marketId: "market:bor",
        treasury: 750,
        taxRate: 0.2,
        baseTaxIncome: 60,
        primaryCultureId: "borean",
        governmentId: "monarchy",
      },
    ],
    regions: [
      {
        id: "region:north",
        nameKey: "regions.north",
        capitalProvinceId: "province:1",
      },
      {
        id: "region:south",
        nameKey: "regions.south",
        capitalProvinceId: "province:3",
      },
    ],
    provinces: [
      {
        id: "province:1",
        legacyId: 1,
        nameKey: "provinces.1",
        regionId: "region:north",
        terrainId: "plains",
        ownerCountryId: "arc",
        neighborProvinceIds: ["province:2"],
        infrastructure: 3,
      },
      {
        id: "province:2",
        legacyId: 2,
        nameKey: "provinces.2",
        regionId: "region:north",
        terrainId: "hills",
        ownerCountryId: "arc",
        neighborProvinceIds: ["province:1", "province:3"],
        infrastructure: 2,
      },
      {
        id: "province:3",
        legacyId: 3,
        nameKey: "provinces.3",
        regionId: "region:south",
        terrainId: "plains",
        ownerCountryId: "bor",
        neighborProvinceIds: ["province:2"],
        infrastructure: 2,
      },
    ],
    pops: [
      {
        id: "pop:arc:1:farmers",
        provinceId: "province:1",
        countryId: "arc",
        typeId: "farmers",
        cultureId: "arcanian",
        religionId: "solar",
        size: 120_000,
        literacy: 0.32,
        needsSatisfaction: 0.72,
        employmentBuildingId: "building:farm:1",
      },
      {
        id: "pop:arc:2:craftsmen",
        provinceId: "province:2",
        countryId: "arc",
        typeId: "craftsmen",
        cultureId: "arcanian",
        religionId: "solar",
        size: 35_000,
        literacy: 0.44,
        needsSatisfaction: 0.68,
        employmentBuildingId: "building:textile:1",
      },
      {
        id: "pop:bor:3:farmers",
        provinceId: "province:3",
        countryId: "bor",
        typeId: "farmers",
        cultureId: "borean",
        religionId: "solar",
        size: 90_000,
        literacy: 0.21,
        needsSatisfaction: 0.65,
        employmentBuildingId: "building:farm:3",
      },
    ],
    units: [
      {
        id: "unit:arc:1",
        ownerCountryId: "arc",
        typeId: "infantry",
        provinceId: "province:1",
      },
      {
        id: "unit:bor:1",
        ownerCountryId: "bor",
        typeId: "infantry",
        provinceId: "province:3",
      },
    ],
    markets: [
      {
        id: "market:arc",
        memberCountryIds: ["arc"],
        stockpile: { grain: 500, clothes: 100 },
        prices: { grain: 2.4, clothes: 6.5 },
      },
      {
        id: "market:bor",
        memberCountryIds: ["bor"],
        stockpile: { grain: 350, clothes: 70 },
        prices: { grain: 2.6, clothes: 7.1 },
      },
    ],
    buildings: [
      {
        id: "building:farm:1",
        provinceId: "province:1",
        ownerCountryId: "arc",
        typeId: "grain_farm",
        workforce: 10_000,
      },
      {
        id: "building:textile:1",
        provinceId: "province:2",
        ownerCountryId: "arc",
        typeId: "textile_mill",
        workforce: 9_000,
      },
      {
        id: "building:farm:3",
        provinceId: "province:3",
        ownerCountryId: "bor",
        typeId: "grain_farm",
        workforce: 10_000,
      },
    ],
  },
  localisation: {
    ru: {
      "countries.arc": "Арканорум",
      "countries.bor": "Борея",
    },
  },
};

type SetTaxRatePayload = JsonObject & {
  countryId: string;
  taxRate: number;
};

export const setTaxRateCommandHandler: CommandHandler<SetTaxRatePayload> = {
  kind: "country.set_tax_rate",
  order: 100,
  validate: ({ world }, command) => {
    const countryId = command.payload.countryId;
    const taxRate = command.payload.taxRate;
    if (typeof countryId !== "string" || !world.tables.countries[countryId]) {
      return [{ code: "COUNTRY_NOT_FOUND", message: "Target country does not exist." }];
    }
    if (command.actorCountryId !== countryId) {
      return [{ code: "COUNTRY_NOT_CONTROLLED", message: "A country may only set its own tax rate." }];
    }
    if (typeof taxRate !== "number" || !Number.isFinite(taxRate) || taxRate < 0 || taxRate > 1) {
      return [{ code: "INVALID_TAX_RATE", message: "Tax rate must be between 0 and 1." }];
    }
    return [];
  },
  execute: ({ writer, emit }, command) => {
    writer.patch("countries", command.payload.countryId, {
      taxRate: command.payload.taxRate,
    });
    emit({
      type: "country.tax_rate_changed",
      audience: { type: "country", countryId: command.payload.countryId },
      payload: {
        countryId: command.payload.countryId,
        taxRate: command.payload.taxRate,
      },
    });
  },
};

export const taxIncomeSystem: TurnSystem = {
  id: "economy.tax-income",
  phase: "production",
  order: 100,
  run: ({ world, writer, emit }) => {
    for (const country of Object.values(world.tables.countries).sort((a, b) =>
      a.id.localeCompare(b.id),
    )) {
      const income = Math.round(country.baseTaxIncome * country.taxRate * 100) / 100;
      writer.patch("countries", country.id, {
        treasury: Math.round((country.treasury + income) * 100) / 100,
      });
      emit({
        type: "economy.tax_income",
        audience: { type: "country", countryId: country.id },
        payload: { countryId: country.id, amount: income },
      });
    }
  },
};

export const populationGrowthSystem: TurnSystem = {
  id: "population.natural-growth",
  phase: "population",
  order: 100,
  run: ({ world, writer, random }) => {
    for (const pop of Object.values(world.tables.pops).sort((a, b) => a.id.localeCompare(b.id))) {
      const weeklyRate = 0.00015 + random.next() * 0.00005;
      const growth = Math.max(0, Math.floor(pop.size * weeklyRate * pop.needsSatisfaction));
      if (growth > 0) writer.patch("pops", pop.id, { size: pop.size + growth });
    }
  },
};

export function createEngineV2DemoSession(): GameSession {
  return new GameSession(compileScenario(engineV2DemoScenario), {
    commandHandlers: [setTaxRateCommandHandler],
    systems: [populationGrowthSystem, taxIncomeSystem],
  });
}

export function createSetTaxRateCommand(input: {
  id: string;
  actorCountryId: string;
  expectedVersion: number;
  taxRate: number;
}): EngineCommandEnvelope<SetTaxRatePayload> {
  return {
    id: input.id,
    kind: "country.set_tax_rate",
    actorCountryId: input.actorCountryId,
    expectedVersion: input.expectedVersion,
    payload: {
      countryId: input.actorCountryId,
      taxRate: input.taxRate,
    },
  };
}
