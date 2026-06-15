const { existsSync, mkdirSync, readFileSync, writeFileSync } = require("fs");
const { resolve } = require("path");

const root = process.cwd();
const scenarioDir = resolve(root, "apps/server/data/scenarios/balanced-economy");
const scenarioLibraryPath = resolve(scenarioDir, "content-library.json");
const fallbackLibraryPath = resolve(root, "apps/server/data/content-library.json");
const sourceLibraryPath = existsSync(scenarioLibraryPath) ? scenarioLibraryPath : fallbackLibraryPath;
const source = JSON.parse(readFileSync(sourceLibraryPath, "utf8"));
const content = source.content ?? source;

const ids = {
  farmer: "019299f7-7854-4f8c-8724-ec8d021e5d31",
  miner: "0b93b497-db9e-4788-83f4-9e7e12cf3a8e",
  energy: "95124bb7-549e-4292-9719-cb1030cbd66e",
  peat: "39a4b3da-d82a-4f4a-828c-1355dc0936a8",
  nuclearFuel: "156a58bb-3e5f-4fa4-9c8e-f929db64e7a4",
  oil: "7d1c7f9e-c580-4e42-8cea-1b9dcc317faf",
  biofuel: "4349dd41-87fd-403a-8283-bbad2f04732b",
  fusionFuel: "07f3ef5a-24be-4236-b112-fdc9fbf27286",
  gas: "c84afdb6-d7ff-4521-8347-fc8d58b5d39c",
  power: "5fbe96dd-9a15-4b5d-a64c-5ea02e05ee60",
  coal: "68f51d4c-fb46-4792-9069-231f5e8c4ed2",
  infraCategory: "e9dc8ca5-0d4e-489e-b3b1-2255bae8b3c2",
};

const G = {
  grain: "good:grain", vegetables: "good:vegetables", meat: "good:meat", fish: "good:fish", dairy: "good:dairy",
  flour: "good:flour", bread: "good:bread", sugar: "good:sugar", oilseed: "good:oilseed", vegetableOil: "good:vegetable_oil",
  beans: "good:beans", fodder: "good:fodder", mushrooms: "good:mushrooms", timber: "good:timber", paper: "good:paper",
  stone: "good:stone", silicates: "good:silicates", porcelain: "good:porcelain", ironOre: "good:iron_ore", copperOre: "good:copper_ore",
  preciousOre: "good:precious_ore", gems: "good:gems", steel: "good:steel", nonferrous: "good:nonferrous_metals", jewelry: "good:jewelry",
  tools: "good:tools", machinery: "good:machinery", engines: "good:engines", vehicles: "good:vehicles", railcars: "good:railcars",
  ships: "good:ships", aircraft: "good:aircraft", tractors: "good:tractors", constructionMachinery: "good:construction_machinery",
  miningEquipment: "good:mining_equipment", energyEquipment: "good:energy_equipment", electronics: "good:electronics", appliances: "good:appliances",
  robots: "good:robots", cotton: "good:cotton", textiles: "good:textiles", clothes: "good:clothes", knitwear: "good:knitwear",
  leather: "good:leather", fur: "good:fur", shoes: "good:shoes", chemicals: "good:chemicals", fertilizer: "good:fertilizer",
  explosives: "good:explosives", plastics: "good:plastics", rubber: "good:rubber", pharmaceuticals: "good:pharmaceuticals",
  cosmetics: "good:cosmetics", householdChemicals: "good:household_chemicals", organicChemicals: "good:organic_chemicals",
  inorganicChemicals: "good:inorganic_chemicals", wine: "good:wine", beer: "good:beer", spirits: "good:spirits", softDrinks: "good:soft_drinks",
  pasta: "good:pasta", confectionery: "good:confectionery", preparedFood: "good:prepared_food", cannedFish: "good:canned_fish",
  processedMeat: "good:processed_meat", processedVegetables: "good:processed_vegetables", weapons: "good:weapons", artillery: "good:artillery",
  tanks: "good:tanks", drones: "good:drones", rockets: "good:rockets", spacecraft: "good:spacecraft", education: "good:education",
  healthcare: "good:healthcare", finance: "good:finance", commerce: "good:commerce", communications: "good:communications", tourism: "good:tourism",
  logistics: "good:logistics", research: "good:research", security: "good:security",
};

const professions = [
  ["profession:default", "Безработные", "#64748b", 0],
  [ids.farmer, "Фермер", "#86efac", 0.55],
  [ids.miner, "Шахтёр", "#f59e0b", 0.8],
  [ids.energy, "Энергетик", "#38bdf8", 1.05],
  ["profession:laborer", "Рабочий", "#a3a3a3", 0.65],
  ["profession:artisan", "Ремесленник", "#fbbf24", 0.85],
  ["profession:machinist", "Машинист", "#60a5fa", 1],
  ["profession:technician", "Техник", "#67e8f9", 1.15],
  ["profession:engineer", "Инженер", "#a78bfa", 1.45],
  ["profession:chemist", "Химик", "#34d399", 1.35],
  ["profession:clerk", "Служащий", "#f0abfc", 0.9],
  ["profession:manager", "Управленец", "#facc15", 1.6],
  ["profession:sailor", "Моряк", "#22d3ee", 0.95],
  ["profession:driver", "Водитель", "#93c5fd", 0.9],
  ["profession:doctor", "Врач", "#f472b6", 1.6],
  ["profession:teacher", "Преподаватель", "#c4b5fd", 1.35],
  ["profession:scientist", "Учёный", "#818cf8", 1.75],
  ["profession:financier", "Финансист", "#fde047", 1.55],
  ["profession:service", "Работник услуг", "#fb923c", 0.75],
  ["profession:soldier", "Солдат", "#94a3b8", 0.95],
  ["profession:officer", "Офицер", "#e2e8f0", 1.55],
].map(([id, name, color, baseWage]) => ({
  id, name, description: "", color, logoUrl: null, malePortraitUrl: null, femalePortraitUrl: null,
  baseWage, needsProfile: null, ideologyWeights: {}, interestGroupWeights: {}, professionWeights: {},
  religionWeights: {}, buildingWeights: {}, lawPreferences: {}, defaultPartyId: null, lawGroupId: null,
  defaultLawId: null, parliamentPower: null, prerequisiteTechnologyIds: [], unlockBuildingIds: [],
  unlockLawIds: [], modifiers: [], decision: null, event: null, ideologyAttractionRules: [],
}));

const sectors = [
  ["sector:agriculture", "Сельское хозяйство", "#84cc16"],
  ["sector:mining", "Добыча", "#f59e0b"],
  ["sector:energy", "Энергетика", "#38bdf8"],
  ["sector:industry", "Промышленность", "#94a3b8"],
  ["sector:consumer", "Потребительские товары", "#fb7185"],
  ["sector:infrastructure", "Инфраструктура", "#60a5fa"],
  ["sector:services", "Услуги", "#c084fc"],
  ["sector:military", "Военная промышленность", "#64748b"],
  ["sector:advanced", "Высокие технологии", "#a78bfa"],
].map(([id, name, color]) => ({ id, name, description: "", color, logoUrl: null }));

const industries = [
  ["industry:farms", "Фермы", "sector:agriculture"],
  ["industry:food", "Пищевая промышленность", "sector:consumer"],
  ["industry:light", "Лёгкая промышленность", "sector:consumer"],
  ["industry:mining", "Добывающая промышленность", "sector:mining"],
  ["industry:energy", "Энергетика", "sector:energy"],
  ["industry:metallurgy", "Металлургия", "sector:industry"],
  ["industry:chemicals", "Химия", "sector:industry"],
  ["industry:machinery", "Машиностроение", "sector:industry"],
  ["industry:infrastructure", "Инфраструктура", "sector:infrastructure"],
  ["industry:services", "Услуги", "sector:services"],
  ["industry:military", "Военная промышленность", "sector:military"],
  ["industry:advanced", "Высокие технологии", "sector:advanced"],
].map(([id, name, sectorId]) => ({ id, name, description: "", color: "#a78bfa", logoUrl: null, sectorId }));

function ensureGood(id, name, basePrice, color = "#a78bfa") {
  if (content.goods.some((good) => good.id === id)) return;
  content.goods.push({
    id, name, description: "", color, logoUrl: null, malePortraitUrl: null, femalePortraitUrl: null,
    needsProfile: null, ideologyWeights: {}, interestGroupWeights: {}, professionWeights: {}, religionWeights: {},
    buildingWeights: {}, lawPreferences: {}, defaultPartyId: null, lawGroupId: null, defaultLawId: null,
    parliamentPower: null, prerequisiteTechnologyIds: [], unlockBuildingIds: [], unlockLawIds: [],
    modifiers: [], decision: null, event: null, ideologyAttractionRules: [], resourceCategoryId: null,
    isResourceDiscoverable: false, basePrice, minPrice: Math.max(1, Math.round(basePrice * 0.45)),
    maxPrice: Math.round(basePrice * 2.2), infraPerUnit: 0.05, infrastructureCostPerUnit: 0.05,
    explorationBaseWeight: 1, explorationSmallVeinChancePct: 60, explorationMediumVeinChancePct: 30,
    explorationLargeVeinChancePct: 10, explorationSmallVeinMin: 10, explorationSmallVeinMax: 100,
    explorationMediumVeinMin: 100, explorationMediumVeinMax: 500, explorationLargeVeinMin: 500,
    explorationLargeVeinMax: 2000,
  });
}

ensureGood(G.security, "Безопасность", 60, "#94a3b8");

content.professions = professions;
content.sectors = sectors;
content.industries = industries;

const prices = new Map(content.goods.map((good) => [good.id, Number(good.basePrice) || 1]));
const wages = new Map(professions.map((profession) => [profession.id, Number(profession.baseWage) || 0]));
const price = (id) => prices.get(id) ?? 1;
const amount = (goodId, value) => ({ goodId, amount: Number(value.toFixed(2)) });
const workers = (professionId, value) => ({ professionId, workers: Math.round(value) });
const norm = (text) => String(text).toLowerCase();
const has = (name, ...parts) => parts.some((part) => norm(name).includes(norm(part)));

function wf(kind) {
  const table = {
    farm: [workers(ids.farmer, 850), workers("profession:laborer", 250), workers("profession:clerk", 35)],
    mine: [workers(ids.miner, 900), workers("profession:laborer", 260), workers("profession:engineer", 55)],
    energy: [workers(ids.energy, 540), workers("profession:engineer", 120), workers("profession:laborer", 180)],
    food: [workers("profession:laborer", 600), workers("profession:machinist", 180), workers("profession:clerk", 70)],
    light: [workers("profession:laborer", 720), workers("profession:artisan", 220), workers("profession:clerk", 70)],
    industry: [workers("profession:laborer", 700), workers("profession:machinist", 260), workers("profession:engineer", 95)],
    chem: [workers("profession:laborer", 520), workers("profession:chemist", 240), workers("profession:engineer", 90)],
    heavy: [workers("profession:machinist", 520), workers("profession:engineer", 180), workers("profession:laborer", 480)],
    infra: [workers("profession:driver", 420), workers("profession:engineer", 95), workers("profession:laborer", 300)],
    port: [workers("profession:sailor", 460), workers("profession:driver", 220), workers("profession:laborer", 250)],
    service: [workers("profession:service", 420), workers("profession:clerk", 280), workers("profession:manager", 80)],
    education: [workers("profession:teacher", 460), workers("profession:clerk", 180), workers("profession:manager", 50)],
    health: [workers("profession:doctor", 360), workers("profession:service", 240), workers("profession:manager", 55)],
    finance: [workers("profession:financier", 330), workers("profession:clerk", 320), workers("profession:manager", 95)],
    research: [workers("profession:scientist", 340), workers("profession:engineer", 210), workers("profession:manager", 70)],
    military: [workers("profession:laborer", 520), workers("profession:machinist", 260), workers("profession:engineer", 130), workers("profession:officer", 40)],
    advanced: [workers("profession:engineer", 260), workers("profession:scientist", 180), workers("profession:technician", 260), workers("profession:manager", 80)],
  };
  return table[kind] ?? table.industry;
}

function costOf(inputs, workforce) {
  const inputCost = inputs.reduce((sum, input) => sum + price(input.goodId) * input.amount, 0);
  const wageCost = workforce.reduce((sum, row) => sum + (wages.get(row.professionId) ?? 0) * row.workers, 0);
  return inputCost + wageCost;
}

function balancedOutputs(inputs, workforce, outputs, margin = 1.22) {
  if (!outputs.length) return outputs;
  const cost = costOf(inputs, workforce);
  const weights = outputs.map((output) => Math.max(1, price(output.goodId) * (output.weight ?? 1)));
  const totalWeight = weights.reduce((sum, value) => sum + value, 0);
  return outputs.map((output, index) => amount(output.goodId, (cost * margin * weights[index]) / totalWeight / price(output.goodId)));
}

function patch(building, cfg) {
  const workforce = cfg.workforceRequirements ?? wf(cfg.workforce ?? "industry");
  const inputs = [...(cfg.inputs ?? [])];
  const outputs = [...(cfg.outputs ?? [])];
  const costTier = cfg.costTier ?? 1;
  const targetMargin = cfg.margin ?? 1.22;
  const balanced = cfg.autoBalance === false ? outputs : balancedOutputs(inputs, workforce, outputs, targetMargin);
  const extractionGoodId = cfg.extractionGoodId ?? null;
  let extractionAmountPerTurn = 0;
  if (extractionGoodId) {
    extractionAmountPerTurn = Number((costOf(inputs, workforce) * targetMargin / price(extractionGoodId)).toFixed(2));
  }

  Object.assign(building, {
    costConstruction: Math.round(140 * costTier),
    costDucats: Math.round(110 * costTier),
    startingDucats: Math.round(38 * costTier),
    maxLevel: cfg.maxLevel ?? 10,
    maxDurability: 100,
    upgradeCostDucats: Math.round(82 * costTier),
    upgradeCostConstruction: Math.round(105 * costTier),
    sectorId: cfg.sectorId,
    industryId: cfg.industryId,
    extractionGoodId,
    extractionAmountPerTurn,
    extractionRequiresDeposit: Boolean(extractionGoodId),
    inputs,
    outputs: extractionGoodId ? [] : balanced,
    workforceRequirements: workforce,
    infrastructureUse: cfg.infrastructureUse ?? 4,
    marketInfrastructureByCategory: cfg.marketInfrastructureByCategory ?? {},
    allowedCountryIds: building.allowedCountryIds ?? [],
    deniedCountryIds: building.deniedCountryIds ?? [],
    countryBuildLimits: building.countryBuildLimits ?? [],
    globalBuildLimit: cfg.globalBuildLimit ?? null,
  });
}

function classify(b) {
  const n = b.name;

  if (has(n, "угольная шахта")) return patch(b, { sectorId: "sector:mining", industryId: "industry:mining", extractionGoodId: ids.coal, inputs: [amount(ids.power, 4), amount(G.tools, 3), amount(G.miningEquipment, 1.2)], workforce: "mine", costTier: 1.5, infrastructureUse: 5, margin: 1.2 });
  if (has(n, "нефтяная вышка", "нефтяная платформа")) return patch(b, { sectorId: "sector:mining", industryId: "industry:mining", extractionGoodId: ids.oil, inputs: [amount(ids.power, 5), amount(G.miningEquipment, 2), amount(G.chemicals, 1.5)], workforce: "mine", costTier: has(n, "платформа") ? 2.2 : 1.7, infrastructureUse: 6, margin: 1.24 });
  if (has(n, "газовая вышка", "газовая платформа")) return patch(b, { sectorId: "sector:mining", industryId: "industry:mining", extractionGoodId: ids.gas, inputs: [amount(ids.power, 5), amount(G.miningEquipment, 1.8), amount(G.chemicals, 1.2)], workforce: "mine", costTier: has(n, "платформа") ? 2.2 : 1.65, infrastructureUse: 6, margin: 1.24 });
  if (has(n, "торфяник")) return patch(b, { sectorId: "sector:mining", industryId: "industry:mining", extractionGoodId: ids.peat, inputs: [amount(G.tools, 2), amount(ids.power, 2)], workforce: "mine", costTier: 1.1, infrastructureUse: 4, margin: 1.18 });
  if (has(n, "урановая шахта")) return patch(b, { sectorId: "sector:mining", industryId: "industry:mining", extractionGoodId: ids.nuclearFuel, inputs: [amount(ids.power, 8), amount(G.miningEquipment, 2.5), amount(G.chemicals, 3)], workforce: "mine", costTier: 2.4, infrastructureUse: 7, margin: 1.28 });
  if (has(n, "шахта чёрных руд")) return patch(b, { sectorId: "sector:mining", industryId: "industry:mining", extractionGoodId: G.ironOre, inputs: [amount(ids.power, 5), amount(G.miningEquipment, 1.5), amount(G.explosives, 1)], workforce: "mine", costTier: 1.5, infrastructureUse: 5, margin: 1.2 });
  if (has(n, "шахта цветных руд")) return patch(b, { sectorId: "sector:mining", industryId: "industry:mining", extractionGoodId: G.copperOre, inputs: [amount(ids.power, 5), amount(G.miningEquipment, 1.5), amount(G.explosives, 1)], workforce: "mine", costTier: 1.55, infrastructureUse: 5, margin: 1.2 });
  if (has(n, "драгоценных руд")) return patch(b, { sectorId: "sector:mining", industryId: "industry:mining", extractionGoodId: G.preciousOre, inputs: [amount(ids.power, 5), amount(G.miningEquipment, 1.3), amount(G.chemicals, 1.5)], workforce: "mine", costTier: 1.8, infrastructureUse: 5, margin: 1.25 });
  if (has(n, "драгоценных камней")) return patch(b, { sectorId: "sector:mining", industryId: "industry:mining", extractionGoodId: G.gems, inputs: [amount(G.tools, 4), amount(ids.power, 3)], workforce: "mine", costTier: 1.7, infrastructureUse: 4, margin: 1.26 });
  if (has(n, "карьер")) return patch(b, { sectorId: "sector:mining", industryId: "industry:mining", extractionGoodId: G.stone, inputs: [amount(G.tools, 3), amount(ids.power, 3)], workforce: "mine", costTier: 1.25, infrastructureUse: 6, margin: 1.17 });
  if (has(n, "гидроминеральный", "горнохимический")) return patch(b, { sectorId: "sector:mining", industryId: "industry:mining", extractionGoodId: G.inorganicChemicals, inputs: [amount(ids.power, 4), amount(G.miningEquipment, 1.2)], workforce: "mine", costTier: 1.5, infrastructureUse: 5, margin: 1.2 });

  if (has(n, "угольная электростанция")) return patch(b, { sectorId: "sector:energy", industryId: "industry:energy", inputs: [amount(ids.coal, 24), amount(G.energyEquipment, 1)], outputs: [amount(ids.power, 1)], workforce: "energy", costTier: 1.75, infrastructureUse: 3, margin: 1.16 });
  if (has(n, "торфяная электростанция")) return patch(b, { sectorId: "sector:energy", industryId: "industry:energy", inputs: [amount(ids.peat, 28), amount(G.energyEquipment, 0.8)], outputs: [amount(ids.power, 1)], workforce: "energy", costTier: 1.45, infrastructureUse: 3, margin: 1.14 });
  if (has(n, "газовая электростанция")) return patch(b, { sectorId: "sector:energy", industryId: "industry:energy", inputs: [amount(ids.gas, 22), amount(G.energyEquipment, 1.1)], outputs: [amount(ids.power, 1)], workforce: "energy", costTier: 1.85, infrastructureUse: 2, margin: 1.17 });
  if (has(n, "нефтяная электростанция")) return patch(b, { sectorId: "sector:energy", industryId: "industry:energy", inputs: [amount(ids.oil, 18), amount(G.energyEquipment, 1.1)], outputs: [amount(ids.power, 1)], workforce: "energy", costTier: 1.85, infrastructureUse: 2, margin: 1.16 });
  if (has(n, "атомная электростанция")) return patch(b, { sectorId: "sector:energy", industryId: "industry:energy", inputs: [amount(ids.nuclearFuel, 5), amount(G.energyEquipment, 2)], outputs: [amount(ids.power, 1)], workforce: "energy", costTier: 3.2, infrastructureUse: 2, margin: 1.2 });
  if (has(n, "термоядерная")) return patch(b, { sectorId: "sector:energy", industryId: "industry:energy", inputs: [amount(ids.fusionFuel, 3), amount(G.energyEquipment, 3), amount(G.research, 2)], outputs: [amount(ids.power, 1)], workforce: "advanced", costTier: 4, infrastructureUse: 2, margin: 1.23 });
  if (has(n, "гидро", "ветровая", "солнечная", "геотермальная")) return patch(b, { sectorId: "sector:energy", industryId: "industry:energy", inputs: [amount(G.energyEquipment, 2), amount(G.machinery, 1)], outputs: [amount(ids.power, 1)], workforce: "energy", costTier: has(n, "гидро") ? 2.6 : 2, infrastructureUse: 2, margin: 1.18 });
  if (has(n, "биотоплевная")) return patch(b, { sectorId: "sector:energy", industryId: "industry:energy", inputs: [amount(ids.biofuel, 20), amount(G.energyEquipment, 1)], outputs: [amount(ids.power, 1)], workforce: "energy", costTier: 1.8, infrastructureUse: 2, margin: 1.16 });

  if (has(n, "ферма зерновых")) return patch(b, { sectorId: "sector:agriculture", industryId: "industry:farms", inputs: [amount(G.tools, 2), amount(G.fertilizer, 3)], outputs: [amount(G.grain, 1), amount(G.fodder, 0.4)], workforce: "farm", costTier: 1.05, infrastructureUse: 3, margin: 1.16 });
  if (has(n, "ферма овощей", "бахчевых")) return patch(b, { sectorId: "sector:agriculture", industryId: "industry:farms", inputs: [amount(G.tools, 2), amount(G.fertilizer, 3)], outputs: [amount(G.vegetables, 1)], workforce: "farm", costTier: 1.05, infrastructureUse: 3, margin: 1.16 });
  if (has(n, "кормовая ферма")) return patch(b, { sectorId: "sector:agriculture", industryId: "industry:farms", inputs: [amount(G.tools, 2), amount(G.fertilizer, 2)], outputs: [amount(G.fodder, 1)], workforce: "farm", costTier: 0.95, infrastructureUse: 3, margin: 1.14 });
  if (has(n, "бобовых")) return patch(b, { sectorId: "sector:agriculture", industryId: "industry:farms", inputs: [amount(G.tools, 2), amount(G.fertilizer, 2)], outputs: [amount(G.beans, 1), amount(G.fodder, 0.25)], workforce: "farm", costTier: 1, infrastructureUse: 3, margin: 1.15 });
  if (has(n, "масличных")) return patch(b, { sectorId: "sector:agriculture", industryId: "industry:farms", inputs: [amount(G.tools, 2), amount(G.fertilizer, 2.5)], outputs: [amount(G.oilseed, 1)], workforce: "farm", costTier: 1, infrastructureUse: 3, margin: 1.15 });
  if (has(n, "технических", "хлопчатобумажный")) return patch(b, { sectorId: "sector:agriculture", industryId: "industry:farms", inputs: [amount(G.tools, 2), amount(G.fertilizer, 3)], outputs: [amount(G.cotton, 1)], workforce: "farm", costTier: 1.05, infrastructureUse: 3, margin: 1.16 });
  if (has(n, "тонизирующих")) return patch(b, { sectorId: "sector:agriculture", industryId: "industry:farms", inputs: [amount(G.tools, 2), amount(G.fertilizer, 2)], outputs: [amount(G.vegetables, 0.7), amount(G.commerce, 0.3)], workforce: "farm", costTier: 1.1, infrastructureUse: 3, margin: 1.17 });
  if (has(n, "животноводческий")) return patch(b, { sectorId: "sector:agriculture", industryId: "industry:farms", inputs: [amount(G.fodder, 18), amount(G.tools, 2)], outputs: [amount(G.meat, 1), amount(G.dairy, 0.8), amount(G.leather, 0.25)], workforce: "farm", costTier: 1.25, infrastructureUse: 4, margin: 1.16 });
  if (has(n, "грибная")) return patch(b, { sectorId: "sector:agriculture", industryId: "industry:farms", inputs: [amount(G.tools, 2), amount(ids.power, 2)], outputs: [amount(G.mushrooms, 1)], workforce: "farm", costTier: 1.1, infrastructureUse: 2, margin: 1.16 });
  if (has(n, "рыболовный", "акваферма")) return patch(b, { sectorId: "sector:agriculture", industryId: "industry:farms", inputs: [amount(G.tools, 2), amount(G.ships, has(n, "порт") ? 0.8 : 0.2)], outputs: [amount(G.fish, 1)], workforce: has(n, "порт") ? "port" : "farm", costTier: 1.25, infrastructureUse: 4, margin: 1.17 });
  if (has(n, "охотничье")) return patch(b, { sectorId: "sector:agriculture", industryId: "industry:farms", inputs: [amount(G.tools, 2), amount(G.weapons, 0.5)], outputs: [amount(G.meat, 0.7), amount(G.fur, 0.5)], workforce: "farm", costTier: 1.05, infrastructureUse: 3, margin: 1.18 });
  if (has(n, "лесопильный")) return patch(b, { sectorId: "sector:agriculture", industryId: "industry:farms", inputs: [amount(G.tools, 4), amount(ids.power, 3)], outputs: [amount(G.timber, 1)], workforce: "farm", costTier: 1.25, infrastructureUse: 5, margin: 1.17 });

  if (has(n, "морской порт", "аэропорт", "логистический", "трубопровод", "газовый порт", "нефтяной порт")) return patch(b, { sectorId: "sector:infrastructure", industryId: "industry:infrastructure", inputs: [amount(ids.power, 6), amount(G.machinery, 1.2), amount(G.vehicles, has(n, "аэропорт") ? 1.2 : 0.5)], outputs: [amount(G.logistics, 1)], workforce: has(n, "порт") ? "port" : "infra", costTier: has(n, "аэропорт") ? 2.4 : 1.8, infrastructureUse: has(n, "трубопровод") ? -10 : -8, marketInfrastructureByCategory: { [ids.infraCategory]: has(n, "трубопровод") ? 22 : 16 }, margin: 1.12 });

  if (has(n, "образовательный")) return patch(b, { sectorId: "sector:services", industryId: "industry:services", inputs: [amount(G.paper, 4), amount(ids.power, 3), amount(G.communications, 2)], outputs: [amount(G.education, 1), amount(G.research, 0.2)], workforce: "education", costTier: 1.5, infrastructureUse: 1, margin: 1.1 });
  if (has(n, "больница")) return patch(b, { sectorId: "sector:services", industryId: "industry:services", inputs: [amount(G.pharmaceuticals, 6), amount(ids.power, 4), amount(G.householdChemicals, 2)], outputs: [amount(G.healthcare, 1)], workforce: "health", costTier: 1.7, infrastructureUse: 1, margin: 1.1 });
  if (has(n, "банк")) return patch(b, { sectorId: "sector:services", industryId: "industry:services", inputs: [amount(ids.power, 4), amount(G.communications, 5), amount(G.security, 1)], outputs: [amount(G.finance, 1)], workforce: "finance", costTier: 1.7, infrastructureUse: 1, margin: 1.12 });
  if (has(n, "офисный", "центр связи", "торговый", "туристический")) {
    const output = has(n, "связи") ? G.communications : has(n, "торгов") ? G.commerce : has(n, "турист") ? G.tourism : G.commerce;
    return patch(b, { sectorId: "sector:services", industryId: "industry:services", inputs: [amount(ids.power, 4), amount(G.paper, 2), amount(G.communications, output === G.communications ? 1 : 3)], outputs: [amount(output, 1)], workforce: "service", costTier: 1.45, infrastructureUse: 1, margin: 1.11 });
  }

  if (has(n, "металлургический комбинат чёрных")) return patch(b, { sectorId: "sector:industry", industryId: "industry:metallurgy", inputs: [amount(G.ironOre, 32), amount(ids.coal, 16), amount(ids.power, 6)], outputs: [amount(G.steel, 1)], workforce: "heavy", costTier: 2.1, infrastructureUse: 7, margin: 1.19 });
  if (has(n, "металлургический комбинат цветных")) return patch(b, { sectorId: "sector:industry", industryId: "industry:metallurgy", inputs: [amount(G.copperOre, 26), amount(ids.power, 10), amount(G.chemicals, 3)], outputs: [amount(G.nonferrous, 1)], workforce: "heavy", costTier: 2.1, infrastructureUse: 6, margin: 1.2 });
  if (has(n, "силикатный")) return patch(b, { sectorId: "sector:industry", industryId: "industry:metallurgy", inputs: [amount(G.stone, 18), amount(ids.power, 5), amount(G.chemicals, 2)], outputs: [amount(G.silicates, 1)], workforce: "industry", costTier: 1.5, infrastructureUse: 5, margin: 1.18 });
  if (has(n, "целлюлозно")) return patch(b, { sectorId: "sector:industry", industryId: "industry:light", inputs: [amount(G.timber, 20), amount(ids.power, 5), amount(G.chemicals, 2)], outputs: [amount(G.paper, 1)], workforce: "industry", costTier: 1.6, infrastructureUse: 5, margin: 1.17 });

  if (has(n, "неорганической химии")) return patch(b, { sectorId: "sector:industry", industryId: "industry:chemicals", inputs: [amount(G.inorganicChemicals, 18), amount(ids.power, 6)], outputs: [amount(G.chemicals, 1)], workforce: "chem", costTier: 1.7, infrastructureUse: 4, margin: 1.18 });
  if (has(n, "органической химии", "нефтехимический")) return patch(b, { sectorId: "sector:industry", industryId: "industry:chemicals", inputs: [amount(ids.oil, 12), amount(ids.gas, 10), amount(ids.power, 6)], outputs: [amount(G.organicChemicals, 1), amount(G.plastics, 0.35)], workforce: "chem", costTier: 1.9, infrastructureUse: 5, margin: 1.2 });
  if (has(n, "агрохимический")) return patch(b, { sectorId: "sector:industry", industryId: "industry:chemicals", inputs: [amount(G.chemicals, 16), amount(ids.gas, 8), amount(ids.power, 4)], outputs: [amount(G.fertilizer, 1)], workforce: "chem", costTier: 1.7, infrastructureUse: 4, margin: 1.17 });
  if (has(n, "полимерный")) return patch(b, { sectorId: "sector:industry", industryId: "industry:chemicals", inputs: [amount(G.organicChemicals, 16), amount(ids.power, 5)], outputs: [amount(G.plastics, 1)], workforce: "chem", costTier: 1.8, infrastructureUse: 4, margin: 1.18 });
  if (has(n, "эластомеров")) return patch(b, { sectorId: "sector:industry", industryId: "industry:chemicals", inputs: [amount(G.organicChemicals, 12), amount(G.chemicals, 8), amount(ids.power, 4)], outputs: [amount(G.rubber, 1)], workforce: "chem", costTier: 1.8, infrastructureUse: 4, margin: 1.18 });
  if (has(n, "взрывчатых")) return patch(b, { sectorId: "sector:industry", industryId: "industry:chemicals", inputs: [amount(G.chemicals, 14), amount(G.fertilizer, 8), amount(ids.power, 4)], outputs: [amount(G.explosives, 1)], workforce: "chem", costTier: 1.8, infrastructureUse: 4, margin: 1.2 });
  if (has(n, "фармацевтический")) return patch(b, { sectorId: "sector:consumer", industryId: "industry:chemicals", inputs: [amount(G.chemicals, 12), amount(G.organicChemicals, 8), amount(G.research, 1)], outputs: [amount(G.pharmaceuticals, 1)], workforce: "chem", costTier: 2, infrastructureUse: 3, margin: 1.22 });
  if (has(n, "косметический")) return patch(b, { sectorId: "sector:consumer", industryId: "industry:chemicals", inputs: [amount(G.chemicals, 10), amount(G.organicChemicals, 6), amount(G.vegetableOil, 4)], outputs: [amount(G.cosmetics, 1)], workforce: "chem", costTier: 1.6, infrastructureUse: 3, margin: 1.18 });
  if (has(n, "бытовой химии")) return patch(b, { sectorId: "sector:consumer", industryId: "industry:chemicals", inputs: [amount(G.chemicals, 12), amount(G.plastics, 4), amount(ids.power, 4)], outputs: [amount(G.householdChemicals, 1)], workforce: "chem", costTier: 1.55, infrastructureUse: 3, margin: 1.17 });

  if (has(n, "мукомольный")) return patch(b, { sectorId: "sector:consumer", industryId: "industry:food", inputs: [amount(G.grain, 32), amount(ids.power, 3)], outputs: [amount(G.flour, 1)], workforce: "food", costTier: 1.2, infrastructureUse: 3, margin: 1.13 });
  if (has(n, "хлебозавод")) return patch(b, { sectorId: "sector:consumer", industryId: "industry:food", inputs: [amount(G.flour, 26), amount(G.sugar, 2), amount(ids.power, 3)], outputs: [amount(G.bread, 1)], workforce: "food", costTier: 1.25, infrastructureUse: 3, margin: 1.14 });
  if (has(n, "сахарный")) return patch(b, { sectorId: "sector:consumer", industryId: "industry:food", inputs: [amount(G.vegetables, 24), amount(ids.power, 4)], outputs: [amount(G.sugar, 1)], workforce: "food", costTier: 1.25, infrastructureUse: 4, margin: 1.14 });
  if (has(n, "молочный")) return patch(b, { sectorId: "sector:consumer", industryId: "industry:food", inputs: [amount(G.dairy, 30), amount(ids.power, 4)], outputs: [amount(G.preparedFood, 0.35), amount(G.dairy, 0.8)], workforce: "food", costTier: 1.25, infrastructureUse: 3, margin: 1.14 });
  if (has(n, "масложировой")) return patch(b, { sectorId: "sector:consumer", industryId: "industry:food", inputs: [amount(G.oilseed, 28), amount(ids.power, 4)], outputs: [amount(G.vegetableOil, 1)], workforce: "food", costTier: 1.25, infrastructureUse: 3, margin: 1.14 });
  if (has(n, "плодоовощной")) return patch(b, { sectorId: "sector:consumer", industryId: "industry:food", inputs: [amount(G.vegetables, 28), amount(G.sugar, 4), amount(ids.power, 4)], outputs: [amount(G.processedVegetables, 1)], workforce: "food", costTier: 1.25, infrastructureUse: 3, margin: 1.15 });
  if (has(n, "рыбоперерабатывающий")) return patch(b, { sectorId: "sector:consumer", industryId: "industry:food", inputs: [amount(G.fish, 26), amount(ids.power, 4)], outputs: [amount(G.cannedFish, 1)], workforce: "food", costTier: 1.25, infrastructureUse: 3, margin: 1.15 });
  if (has(n, "мясокомбинат")) return patch(b, { sectorId: "sector:consumer", industryId: "industry:food", inputs: [amount(G.meat, 24), amount(ids.power, 4)], outputs: [amount(G.processedMeat, 1)], workforce: "food", costTier: 1.3, infrastructureUse: 3, margin: 1.15 });
  if (has(n, "винодельня")) return patch(b, { sectorId: "sector:consumer", industryId: "industry:food", inputs: [amount(G.vegetables, 20), amount(G.sugar, 5)], outputs: [amount(G.wine, 1)], workforce: "food", costTier: 1.25, infrastructureUse: 3, margin: 1.17 });
  if (has(n, "пивоваренный")) return patch(b, { sectorId: "sector:consumer", industryId: "industry:food", inputs: [amount(G.grain, 22), amount(G.sugar, 3), amount(ids.power, 3)], outputs: [amount(G.beer, 1)], workforce: "food", costTier: 1.25, infrastructureUse: 3, margin: 1.16 });
  if (has(n, "спиртовой")) return patch(b, { sectorId: "sector:consumer", industryId: "industry:food", inputs: [amount(G.grain, 18), amount(G.sugar, 6), amount(ids.power, 3)], outputs: [amount(G.spirits, 1)], workforce: "food", costTier: 1.3, infrastructureUse: 3, margin: 1.17 });
  if (has(n, "газированных")) return patch(b, { sectorId: "sector:consumer", industryId: "industry:food", inputs: [amount(G.sugar, 10), amount(G.plastics, 3), amount(ids.power, 3)], outputs: [amount(G.softDrinks, 1)], workforce: "food", costTier: 1.2, infrastructureUse: 3, margin: 1.15 });
  if (has(n, "макаронная")) return patch(b, { sectorId: "sector:consumer", industryId: "industry:food", inputs: [amount(G.flour, 24), amount(ids.power, 3)], outputs: [amount(G.pasta, 1)], workforce: "food", costTier: 1.2, infrastructureUse: 3, margin: 1.14 });
  if (has(n, "кондитерская")) return patch(b, { sectorId: "sector:consumer", industryId: "industry:food", inputs: [amount(G.flour, 14), amount(G.sugar, 12), amount(G.vegetableOil, 4)], outputs: [amount(G.confectionery, 1)], workforce: "food", costTier: 1.25, infrastructureUse: 3, margin: 1.16 });
  if (has(n, "готовых блюд")) return patch(b, { sectorId: "sector:consumer", industryId: "industry:food", inputs: [amount(G.processedMeat, 8), amount(G.processedVegetables, 8), amount(G.bread, 6), amount(ids.power, 4)], outputs: [amount(G.preparedFood, 1)], workforce: "food", costTier: 1.35, infrastructureUse: 3, margin: 1.15 });

  if (has(n, "текстильный")) return patch(b, { sectorId: "sector:consumer", industryId: "industry:light", inputs: [amount(G.cotton, 26), amount(ids.power, 4)], outputs: [amount(G.textiles, 1)], workforce: "light", costTier: 1.25, infrastructureUse: 3, margin: 1.14 });
  if (has(n, "трикотажная")) return patch(b, { sectorId: "sector:consumer", industryId: "industry:light", inputs: [amount(G.textiles, 20), amount(ids.power, 3)], outputs: [amount(G.knitwear, 1)], workforce: "light", costTier: 1.2, infrastructureUse: 3, margin: 1.15 });
  if (has(n, "швейная")) return patch(b, { sectorId: "sector:consumer", industryId: "industry:light", inputs: [amount(G.textiles, 18), amount(G.leather, 3), amount(ids.power, 3)], outputs: [amount(G.clothes, 1)], workforce: "light", costTier: 1.25, infrastructureUse: 3, margin: 1.15 });
  if (has(n, "кожевенный")) return patch(b, { sectorId: "sector:consumer", industryId: "industry:light", inputs: [amount(G.leather, 18), amount(G.chemicals, 4), amount(ids.power, 3)], outputs: [amount(G.leather, 0.9), amount(G.shoes, 0.25)], workforce: "light", costTier: 1.25, infrastructureUse: 3, margin: 1.14 });
  if (has(n, "меховая")) return patch(b, { sectorId: "sector:consumer", industryId: "industry:light", inputs: [amount(G.fur, 16), amount(G.textiles, 6)], outputs: [amount(G.clothes, 0.7), amount(G.fur, 0.4)], workforce: "light", costTier: 1.2, infrastructureUse: 3, margin: 1.15 });
  if (has(n, "обувная")) return patch(b, { sectorId: "sector:consumer", industryId: "industry:light", inputs: [amount(G.leather, 14), amount(G.rubber, 5), amount(G.textiles, 4)], outputs: [amount(G.shoes, 1)], workforce: "light", costTier: 1.25, infrastructureUse: 3, margin: 1.15 });
  if (has(n, "фарфоро")) return patch(b, { sectorId: "sector:consumer", industryId: "industry:light", inputs: [amount(G.silicates, 18), amount(ids.power, 5)], outputs: [amount(G.porcelain, 1)], workforce: "industry", costTier: 1.4, infrastructureUse: 4, margin: 1.16 });
  if (has(n, "ювелирный")) return patch(b, { sectorId: "sector:consumer", industryId: "industry:light", inputs: [amount(G.preciousOre, 8), amount(G.gems, 4), amount(ids.power, 2)], outputs: [amount(G.jewelry, 1)], workforce: "light", costTier: 1.5, infrastructureUse: 2, margin: 1.18 });

  if (has(n, "военная верфь")) return patch(b, { sectorId: "sector:military", industryId: "industry:military", inputs: [amount(G.steel, 18), amount(G.engines, 6), amount(G.electronics, 5)], outputs: [amount(G.ships, 0.7), amount(G.weapons, 0.4)], workforce: "military", costTier: 2.8, infrastructureUse: 6, margin: 1.22 });
  if (has(n, "военный авиационный")) return patch(b, { sectorId: "sector:military", industryId: "industry:military", inputs: [amount(G.aircraft, 0.4), amount(G.electronics, 8), amount(G.weapons, 5)], outputs: [amount(G.aircraft, 0.8), amount(G.weapons, 0.5)], workforce: "military", costTier: 3, infrastructureUse: 5, margin: 1.22 });
  if (has(n, "артиллерийский")) return patch(b, { sectorId: "sector:military", industryId: "industry:military", inputs: [amount(G.steel, 16), amount(G.explosives, 8), amount(G.machinery, 4)], outputs: [amount(G.artillery, 1)], workforce: "military", costTier: 2.3, infrastructureUse: 5, margin: 1.21 });
  if (has(n, "бронетанковый")) return patch(b, { sectorId: "sector:military", industryId: "industry:military", inputs: [amount(G.steel, 18), amount(G.engines, 5), amount(G.artillery, 0.4), amount(G.electronics, 4)], outputs: [amount(G.tanks, 1)], workforce: "military", costTier: 2.8, infrastructureUse: 5, margin: 1.22 });
  if (has(n, "завод дронов")) return patch(b, { sectorId: "sector:military", industryId: "industry:advanced", inputs: [amount(G.electronics, 14), amount(G.engines, 3), amount(G.plastics, 8)], outputs: [amount(G.drones, 1)], workforce: "advanced", costTier: 2.7, infrastructureUse: 4, margin: 1.24 });
  if (has(n, "ракетный завод")) return patch(b, { sectorId: "sector:military", industryId: "industry:advanced", inputs: [amount(G.electronics, 10), amount(G.explosives, 10), amount(G.engines, 5), amount(G.research, 2)], outputs: [amount(G.rockets, 1)], workforce: "advanced", costTier: 3.2, infrastructureUse: 5, margin: 1.25 });

  if (has(n, "космический завод", "ракетно-космический")) return patch(b, { sectorId: "sector:advanced", industryId: "industry:advanced", inputs: [amount(G.rockets, 0.6), amount(G.electronics, 16), amount(G.nonferrous, 10), amount(G.research, 4)], outputs: [amount(G.spacecraft, 1), amount(G.research, 0.2)], workforce: "advanced", costTier: 3.8, infrastructureUse: 5, margin: 1.25 });
  if (has(n, "робототехнический")) return patch(b, { sectorId: "sector:advanced", industryId: "industry:advanced", inputs: [amount(G.electronics, 16), amount(G.machinery, 8), amount(G.research, 2)], outputs: [amount(G.robots, 1)], workforce: "advanced", costTier: 3, infrastructureUse: 4, margin: 1.23 });
  if (has(n, "бытовой техники")) return patch(b, { sectorId: "sector:consumer", industryId: "industry:machinery", inputs: [amount(G.electronics, 8), amount(G.steel, 8), amount(G.plastics, 6)], outputs: [amount(G.appliances, 1)], workforce: "heavy", costTier: 2, infrastructureUse: 4, margin: 1.18 });

  if (has(n, "инструментальный")) return patch(b, { sectorId: "sector:industry", industryId: "industry:machinery", inputs: [amount(G.steel, 14), amount(ids.power, 5)], outputs: [amount(G.tools, 1)], workforce: "industry", costTier: 1.5, infrastructureUse: 4, margin: 1.16 });
  if (has(n, "станкостроительный", "промышленного оборудования")) return patch(b, { sectorId: "sector:industry", industryId: "industry:machinery", inputs: [amount(G.steel, 14), amount(G.tools, 6), amount(ids.power, 6)], outputs: [amount(G.machinery, 1)], workforce: "heavy", costTier: 1.9, infrastructureUse: 5, margin: 1.18 });
  if (has(n, "двигателестроительный")) return patch(b, { sectorId: "sector:industry", industryId: "industry:machinery", inputs: [amount(G.steel, 12), amount(G.nonferrous, 6), amount(G.machinery, 4)], outputs: [amount(G.engines, 1)], workforce: "heavy", costTier: 2, infrastructureUse: 5, margin: 1.18 });
  if (has(n, "автомобильный")) return patch(b, { sectorId: "sector:industry", industryId: "industry:machinery", inputs: [amount(G.engines, 4), amount(G.steel, 14), amount(G.rubber, 5), amount(G.electronics, 4)], outputs: [amount(G.vehicles, 1)], workforce: "heavy", costTier: 2.2, infrastructureUse: 5, margin: 1.19 });
  if (has(n, "вагоностроительный")) return patch(b, { sectorId: "sector:industry", industryId: "industry:machinery", inputs: [amount(G.steel, 20), amount(G.engines, 3), amount(G.machinery, 5)], outputs: [amount(G.railcars, 1)], workforce: "heavy", costTier: 2.1, infrastructureUse: 5, margin: 1.18 });
  if (has(n, "судостроительная")) return patch(b, { sectorId: "sector:industry", industryId: "industry:machinery", inputs: [amount(G.steel, 22), amount(G.engines, 5), amount(G.electronics, 3)], outputs: [amount(G.ships, 1)], workforce: "heavy", costTier: 2.4, infrastructureUse: 6, margin: 1.19 });
  if (has(n, "авиастроительный")) return patch(b, { sectorId: "sector:industry", industryId: "industry:machinery", inputs: [amount(G.engines, 6), amount(G.nonferrous, 10), amount(G.electronics, 8)], outputs: [amount(G.aircraft, 1)], workforce: "heavy", costTier: 2.8, infrastructureUse: 5, margin: 1.2 });
  if (has(n, "тракторный", "сельскохозяйственной техники")) return patch(b, { sectorId: "sector:industry", industryId: "industry:machinery", inputs: [amount(G.engines, 3), amount(G.steel, 12), amount(G.tools, 5)], outputs: [amount(G.tractors, 1)], workforce: "heavy", costTier: 2, infrastructureUse: 5, margin: 1.18 });
  if (has(n, "строительной техники", "экскаваторный")) return patch(b, { sectorId: "sector:industry", industryId: "industry:machinery", inputs: [amount(G.engines, 4), amount(G.steel, 16), amount(G.machinery, 4)], outputs: [amount(G.constructionMachinery, 1)], workforce: "heavy", costTier: 2.1, infrastructureUse: 5, margin: 1.18 });
  if (has(n, "горно-шахтного")) return patch(b, { sectorId: "sector:industry", industryId: "industry:machinery", inputs: [amount(G.steel, 16), amount(G.machinery, 5), amount(G.electronics, 2)], outputs: [amount(G.miningEquipment, 1)], workforce: "heavy", costTier: 2, infrastructureUse: 5, margin: 1.18 });
  if (has(n, "энергомашиностроительный")) return patch(b, { sectorId: "sector:industry", industryId: "industry:machinery", inputs: [amount(G.steel, 14), amount(G.nonferrous, 6), amount(G.electronics, 4)], outputs: [amount(G.energyEquipment, 1)], workforce: "heavy", costTier: 2, infrastructureUse: 5, margin: 1.18 });
  if (has(n, "металлургического оборудования", "химическое машиностроительное", "нефтегазовое машиностроительное", "лесопромышленный", "оборудования пищевой", "оборудования лёгкой")) return patch(b, { sectorId: "sector:industry", industryId: "industry:machinery", inputs: [amount(G.steel, 12), amount(G.machinery, 5), amount(G.tools, 4), amount(ids.power, 5)], outputs: [amount(G.machinery, 0.65), amount(G.tools, 0.35)], workforce: "heavy", costTier: 1.9, infrastructureUse: 5, margin: 1.18 });

  return patch(b, { sectorId: "sector:industry", industryId: "industry:machinery", inputs: [amount(G.steel, 10), amount(ids.power, 5), amount(G.tools, 4)], outputs: [amount(G.machinery, 1)], workforce: "industry", costTier: 1.6, infrastructureUse: 4, margin: 1.16 });
}

content.buildings.forEach(classify);

const scenario = {
  id: "balanced-economy",
  name: "Сбалансированная экономика",
  description: "Отдельная content library с логичными цепочками зданий, товаров и профессий. Использует текущую карту.",
  startTurn: 1,
  calendar: { startYear: 1836, turnsPerYear: 12 },
  mapRoot: "active",
  tags: ["economy", "content-library", "balance"],
  content: { files: ["content-library.json"] },
};

const readme = `# Сбалансированная экономика

Content-only сценарий. Использует текущую карту через \`mapRoot: "active"\`.

Что настроено:
- все здания из content library получили сектор, индустрию, стоимость, работников, потребление и производство;
- добывающие здания используют \`extractionGoodId\` и требуют залежи, без дублирующего output того же ресурса;
- добавлены необходимые профессии для сельского хозяйства, шахт, энергетики, промышленности, услуг, армии и высоких технологий;
- товары связаны в цепочки: сырьё -> материалы -> оборудование -> финальные товары/услуги;
- объёмы output/extraction рассчитаны от цен товаров, зарплат и входных ресурсов с целевой маржой.

Сценарий можно выбирать отдельно, не перезаписывая активную библиотеку.
`;

mkdirSync(scenarioDir, { recursive: true });
writeFileSync(resolve(scenarioDir, "scenario.json"), JSON.stringify(scenario, null, 2) + "\n", "utf8");
writeFileSync(scenarioLibraryPath, JSON.stringify({ content }, null, 2) + "\n", "utf8");
writeFileSync(resolve(scenarioDir, "README.md"), readme, "utf8");

console.log(`balanced-economy: ${content.buildings.length} buildings, ${content.goods.length} goods, ${content.professions.length} professions`);
