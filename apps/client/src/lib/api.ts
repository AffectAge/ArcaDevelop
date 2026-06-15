import type { ActiveModifierRow, Country, CountryDecisionRecord, CountryEventRecord, CountryParliament, CountryParliamentPowerBill, CountryParliamentPowers, CountryTechnologyState, DecisionDefinition, DiplomacyProposal, Division, DivisionTemplate, DivisionTemplateBattalion, GameEventDefinition, IdeologyAttractionRule, LawParliamentPowerEffect, LoginPayload, MilitaryBranch, MilitaryFormationQueueItem, MilitaryTemplateComponent, ModifierDefinition, Order, PopulationPop, RegionPopulation, ServerStatus, TreatyClause, WorldBase, WsOutMessage } from "@arcanorum/shared";

const API = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

export const apiBase = API;

export type ContentCulture = {
  id: string;
  name: string;
  description: string;
  color: string;
  logoUrl: string | null;
  malePortraitUrl?: string | null;
  femalePortraitUrl?: string | null;
  basePrice?: number | null;
  minPrice?: number | null;
  maxPrice?: number | null;
  infraPerUnit?: number | null;
  infrastructureCostPerUnit?: number | null;
  distributionType?: "tradeable" | "localOnly" | "pipeline" | "powerGrid" | "service" | null;
  transportModes?: Array<"land" | "sea" | "air" | "pipeline" | "powerGrid"> | null;
  resourceCategoryId?: string | null;
  isResourceDiscoverable?: boolean | null;
  explorationBaseWeight?: number | null;
  explorationSmallVeinChancePct?: number | null;
  explorationMediumVeinChancePct?: number | null;
  explorationLargeVeinChancePct?: number | null;
  explorationSmallVeinMin?: number | null;
  explorationSmallVeinMax?: number | null;
  explorationMediumVeinMin?: number | null;
  explorationMediumVeinMax?: number | null;
  explorationLargeVeinMin?: number | null;
  explorationLargeVeinMax?: number | null;
  baseWage?: number | null;
  ideologyWeights?: Record<string, number>;
  interestGroupWeights?: Record<string, number>;
  professionWeights?: Record<string, number>;
  religionWeights?: Record<string, number>;
  buildingWeights?: Record<string, number>;
  lawPreferences?: Record<string, number>;
  discipline?: number | null;
  basePoliticalStrength?: number | null;
  solMultiplier?: number | null;
  radicalMultiplier?: number | null;
  loyalistMultiplier?: number | null;
  defaultPartyId?: string | null;
  lawGroupId?: string | null;
  defaultLawId?: string | null;
  order?: number | null;
  enactmentDifficulty?: number | null;
  votingDurationTurns?: number | null;
  parliamentPower?: LawParliamentPowerEffect | null;
  costScience?: number | null;
  prerequisiteTechnologyIds?: string[] | null;
  unlockBuildingIds?: string[] | null;
  unlockLawIds?: string[] | null;
  modifiers?: ModifierDefinition[] | null;
  decision?: DecisionDefinition | null;
  event?: GameEventDefinition | null;
  ideologyAttractionRules?: IdeologyAttractionRule[] | null;
  needsProfile?: {
    tiers: Array<{
      id: string;
      minStandardOfLiving: number;
      needs: Array<{
        id: string;
        label: string;
        category: "survival" | "basic" | "comfort" | "luxury";
        amountPerPerson: number;
        weight: number;
        goods: Array<{ goodId: string; weight: number }>;
      }>;
    }>;
  } | null;
  costConstruction?: number | null;
  costDucats?: number | null;
  startingDucats?: number | null;
  maxLevel?: number | null;
  maxDurability?: number | null;
  upgradeCostDucats?: number | null;
  upgradeCostConstruction?: number | null;
  extractionGoodId?: string | null;
  sectorId?: string | null;
  industryId?: string | null;
  extractionAmountPerTurn?: number | null;
  extractionRequiresDeposit?: boolean | null;
  inputs?: Array<{ goodId: string; amount: number; affectedByFertility?: boolean }> | null;
  outputs?: Array<{ goodId: string; amount: number; affectedByFertility?: boolean }> | null;
  workforceRequirements?: Array<{ professionId: string; workers: number }> | null;
  allowedCountryIds?: string[] | null;
  deniedCountryIds?: string[] | null;
  allowedProvinceTypes?: string[] | null;
  deniedProvinceTypes?: string[] | null;
  allowedClimates?: string[] | null;
  deniedClimates?: string[] | null;
  allowedLandscapes?: string[] | null;
  deniedLandscapes?: string[] | null;
  allowedContinents?: string[] | null;
  deniedContinents?: string[] | null;
  allowedStrategicRegions?: string[] | null;
  deniedStrategicRegions?: string[] | null;
  minRadiation?: number | null;
  maxRadiation?: number | null;
  pollutionProductivityMode?: "penalty" | "bonus" | "ignore";
  countryBuildLimits?: Array<{ countryId: string; limit: number | null }> | null;
  globalBuildLimit?: number | null;
  manpower?: number | null;
  attack?: number | null;
  defense?: number | null;
  breakthrough?: number | null;
  organization?: number | null;
  hp?: number | null;
  speed?: number | null;
  supplyUse?: number | null;
  trainingCostDucats?: number | null;
  trainingCostManpower?: number | null;
  equipmentNeeds?: Array<{ goodId: string; amount: number }> | null;
};
export type ContentEntry = ContentCulture;
export type ContentEntryKind =
  | "cultures"
  | "resourceCategories"
  | "provinceTypes"
  | "provinceClimates"
  | "provinceLandscapes"
  | "provinceContinents"
  | "provinceStrategicRegions"
  | "religions"
  | "professions"
  | "ideologies"
  | "interestGroups"
  | "parties"
  | "lawGroups"
  | "laws"
  | "technologies"
  | "races"
  | "buildings"
  | "goods"
  | "companies"
  | "industries"
  | "sectors"
  | "modifiers"
  | "decisions"
  | "events"
  | "battalions"
  | "shipTypes"
  | "aircraftTypes";

type ContentEntryUpsertPayload = {
  name: string;
  description?: string;
  color: string;
  basePrice?: number | null;
  minPrice?: number | null;
  maxPrice?: number | null;
  infraPerUnit?: number | null;
  infrastructureCostPerUnit?: number | null;
  distributionType?: "tradeable" | "localOnly" | "pipeline" | "powerGrid" | "service" | null;
  transportModes?: Array<"land" | "sea" | "air" | "pipeline" | "powerGrid">;
  resourceCategoryId?: string | null;
  isResourceDiscoverable?: boolean | null;
  explorationBaseWeight?: number | null;
  explorationSmallVeinChancePct?: number | null;
  explorationMediumVeinChancePct?: number | null;
  explorationLargeVeinChancePct?: number | null;
  explorationSmallVeinMin?: number | null;
  explorationSmallVeinMax?: number | null;
  explorationMediumVeinMin?: number | null;
  explorationMediumVeinMax?: number | null;
  explorationLargeVeinMin?: number | null;
  explorationLargeVeinMax?: number | null;
  baseWage?: number | null;
  ideologyWeights?: Record<string, number>;
  interestGroupWeights?: Record<string, number>;
  professionWeights?: Record<string, number>;
  religionWeights?: Record<string, number>;
  buildingWeights?: Record<string, number>;
  lawPreferences?: Record<string, number>;
  discipline?: number | null;
  basePoliticalStrength?: number | null;
  solMultiplier?: number | null;
  radicalMultiplier?: number | null;
  loyalistMultiplier?: number | null;
  defaultPartyId?: string | null;
  lawGroupId?: string | null;
  defaultLawId?: string | null;
  order?: number | null;
  enactmentDifficulty?: number | null;
  votingDurationTurns?: number | null;
  parliamentPower?: LawParliamentPowerEffect | null;
  costScience?: number | null;
  prerequisiteTechnologyIds?: string[] | null;
  unlockBuildingIds?: string[] | null;
  unlockLawIds?: string[] | null;
  modifiers?: ModifierDefinition[] | null;
  decision?: DecisionDefinition | null;
  event?: GameEventDefinition | null;
  ideologyAttractionRules?: IdeologyAttractionRule[] | null;
  needsProfile?: ContentCulture["needsProfile"];
  costConstruction?: number | null;
  costDucats?: number | null;
  startingDucats?: number | null;
  maxLevel?: number | null;
  maxDurability?: number | null;
  upgradeCostDucats?: number | null;
  upgradeCostConstruction?: number | null;
  extractionGoodId?: string | null;
  sectorId?: string | null;
  industryId?: string | null;
  extractionAmountPerTurn?: number | null;
  extractionRequiresDeposit?: boolean | null;
  inputs?: Array<{ goodId: string; amount: number; affectedByFertility?: boolean }>;
  outputs?: Array<{ goodId: string; amount: number; affectedByFertility?: boolean }>;
  workforceRequirements?: Array<{ professionId: string; workers: number }>;
  allowedCountryIds?: string[];
  deniedCountryIds?: string[];
  allowedProvinceTypes?: string[];
  deniedProvinceTypes?: string[];
  allowedClimates?: string[];
  deniedClimates?: string[];
  allowedLandscapes?: string[];
  deniedLandscapes?: string[];
  allowedContinents?: string[];
  deniedContinents?: string[];
  allowedStrategicRegions?: string[];
  deniedStrategicRegions?: string[];
  minRadiation?: number | null;
  maxRadiation?: number | null;
  pollutionProductivityMode?: "penalty" | "bonus" | "ignore";
  countryBuildLimits?: Array<{ countryId: string; limit: number | null }>;
  globalBuildLimit?: number | null;
  manpower?: number | null;
  attack?: number | null;
  defense?: number | null;
  breakthrough?: number | null;
  organization?: number | null;
  hp?: number | null;
  speed?: number | null;
  supplyUse?: number | null;
  trainingCostDucats?: number | null;
  trainingCostManpower?: number | null;
  equipmentNeeds?: Array<{ goodId: string; amount: number }>;
};


function withAssetBase(url?: string | null): string | null | undefined {
  if (!url) {
    return url;
  }

  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }

  if (url.startsWith("/")) {
    return `${API}${url}`;
  }

  return url;
}

function normalizeCountry(country: Country): Country {
  return {
    ...country,
    flagUrl: withAssetBase(country.flagUrl),
    crestUrl: withAssetBase(country.crestUrl),
  };
}

function normalizeContentCulture(culture: ContentCulture): ContentCulture {
  return {
    ...culture,
    logoUrl: withAssetBase(culture.logoUrl) ?? null,
    malePortraitUrl: withAssetBase(culture.malePortraitUrl) ?? null,
    femalePortraitUrl: withAssetBase(culture.femalePortraitUrl) ?? null,
  };
}
function normalizeContentEntry(entry: ContentEntry): ContentEntry {
  return normalizeContentCulture(entry);
}

export async function fetchServerStatus(): Promise<{ status: ServerStatus; turnId: number }> {
  const response = await fetch(`${API}/health`);
  if (!response.ok) {
    throw new Error("SERVER_UNAVAILABLE");
  }
  return response.json();
}

export async function fetchCountries(): Promise<Country[]> {
  const response = await fetch(`${API}/countries`);
  if (!response.ok) {
    throw new Error("COUNTRIES_FAILED");
  }
  const countries = (await response.json()) as Country[];
  return countries.map(normalizeCountry);
}

export async function fetchWorldSnapshot(token: string): Promise<{ worldBase: WorldBase; turnId: number; worldStateVersion: number }> {
  const response = await fetch(`${API}/world/snapshot`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error ?? "WORLD_SNAPSHOT_FAILED");
  }
  return response.json();
}

function authHeaders(token: string): HeadersInit {
  return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
}

async function handleJson<T>(response: Response, fallbackError = "REQUEST_FAILED"): Promise<T> {
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error ?? fallbackError);
  }
  return (await response.json()) as T;
}

export type ArmyOverview = {
  battalionCatalog: ContentEntry[];
  templates: DivisionTemplate[];
  divisions: Division[];
  provinceOptions: Array<{ id: string; name: string; neighbors: string[] }>;
};

export type MilitaryOverview = {
  battalionCatalog: ContentEntry[];
  shipTypeCatalog: ContentEntry[];
  aircraftTypeCatalog: ContentEntry[];
  templates: DivisionTemplate[];
  units: Division[];
  divisions: Division[];
  queue: MilitaryFormationQueueItem[];
  provinceOptions: Array<{ id: string; name: string; neighbors: string[] }>;
  formationSpeed: number;
};

export async function fetchArmyOverview(token: string): Promise<ArmyOverview> {
  const response = await fetch(`${API}/army/overview`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error ?? "ARMY_OVERVIEW_FAILED");
  }
  return (await response.json()) as ArmyOverview;
}

export async function fetchMilitaryOverview(token: string): Promise<MilitaryOverview> {
  const response = await fetch(`${API}/military/overview`, {
    headers: authHeaders(token),
  });
  return handleJson<MilitaryOverview>(response);
}

export async function saveMilitaryTemplate(
  token: string,
  payload: { templateId?: string; kind: MilitaryBranch; name: string; components: MilitaryTemplateComponent[]; iconUrl?: string | null },
): Promise<MilitaryOverview> {
  const response = await fetch(`${API}/military/templates`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
  return handleJson<MilitaryOverview>(response);
}

export async function deleteMilitaryTemplate(token: string, templateId: string): Promise<MilitaryOverview> {
  const response = await fetch(`${API}/military/templates/${encodeURIComponent(templateId)}`, {
    method: "DELETE",
    headers: authHeaders(token),
  });
  return handleJson<MilitaryOverview>(response);
}

export async function uploadMilitaryTemplateIcon(token: string, templateId: string, file: File): Promise<MilitaryOverview> {
  const formData = new FormData();
  formData.append("divisionIcon", file);
  const response = await fetch(`${API}/military/templates/${encodeURIComponent(templateId)}/icon`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  return handleJson<MilitaryOverview>(response);
}

export async function createMilitaryFormation(
  token: string,
  payload: { templateId: string; provinceId: string; name?: string },
): Promise<MilitaryOverview> {
  const response = await fetch(`${API}/military/formations`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
  return handleJson<MilitaryOverview>(response);
}

export async function cancelMilitaryFormation(token: string, queueId: string): Promise<MilitaryOverview> {
  const response = await fetch(`${API}/military/formations/${encodeURIComponent(queueId)}`, {
    method: "DELETE",
    headers: authHeaders(token),
  });
  return handleJson<MilitaryOverview>(response);
}

export async function saveDivisionTemplate(
  token: string,
  payload: { templateId?: string; name: string; battalions: DivisionTemplateBattalion[] },
): Promise<ArmyOverview> {
  const response = await fetch(`${API}/army/templates`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error ?? "SAVE_DIVISION_TEMPLATE_FAILED");
  }
  return (await response.json()) as ArmyOverview;
}

export async function deleteDivisionTemplate(token: string, templateId: string): Promise<ArmyOverview> {
  const response = await fetch(`${API}/army/templates/${encodeURIComponent(templateId)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error ?? "DELETE_DIVISION_TEMPLATE_FAILED");
  }
  return (await response.json()) as ArmyOverview;
}

export async function uploadDivisionTemplateIcon(token: string, templateId: string, file: File): Promise<ArmyOverview> {
  const form = new FormData();
  form.append("divisionIcon", file);
  const response = await fetch(`${API}/army/templates/${encodeURIComponent(templateId)}/icon`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error ?? "UPLOAD_DIVISION_ICON_FAILED");
  }
  return (await response.json()) as ArmyOverview;
}

export async function createDivisionFromTemplate(
  token: string,
  payload: { templateId: string; provinceId: string; name?: string },
): Promise<ArmyOverview> {
  const response = await fetch(`${API}/army/divisions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error ?? "CREATE_DIVISION_FAILED");
  }
  return (await response.json()) as ArmyOverview;
}

export type PoliticsResponse = {
  parliament: CountryParliament;
  parties: ContentEntry[];
  interestGroups: ContentEntry[];
  lawGroups: ContentEntry[];
  laws: ContentEntry[];
  ideologies: ContentEntry[];
};

export async function fetchPolitics(token: string, countryId: string): Promise<PoliticsResponse> {
  const response = await fetch(`${API}/politics/${encodeURIComponent(countryId)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error ?? "POLITICS_FAILED");
  }
  const data = (await response.json()) as PoliticsResponse;
  return {
    ...data,
    parties: data.parties.map(normalizeContentEntry),
    interestGroups: data.interestGroups.map(normalizeContentEntry),
    lawGroups: data.lawGroups.map(normalizeContentEntry),
    laws: data.laws.map(normalizeContentEntry),
    ideologies: data.ideologies.map(normalizeContentEntry),
  };
}

export async function startLawBill(token: string, countryId: string, lawId: string): Promise<{ parliament: CountryParliament; law: ContentEntry }> {
  const response = await fetch(`${API}/politics/${encodeURIComponent(countryId)}/bill`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ lawId }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error ?? "START_LAW_BILL_FAILED");
  }
  const data = (await response.json()) as { parliament: CountryParliament; law: ContentEntry };
  return { ...data, law: normalizeContentEntry(data.law) };
}

export async function startParliamentPowerBill(
  token: string,
  countryId: string,
  title: string,
  powers: CountryParliamentPowers,
): Promise<{ parliament: CountryParliament; bill: CountryParliamentPowerBill }> {
  const response = await fetch(`${API}/politics/${encodeURIComponent(countryId)}/power-bill`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ title, powers }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error ?? "START_POWER_BILL_FAILED");
  }
  return (await response.json()) as { parliament: CountryParliament; bill: CountryParliamentPowerBill };
}

export async function setActiveTechnology(
  token: string,
  countryId: string,
  technologyId: string | null,
  active?: boolean,
): Promise<{ technology: CountryTechnologyState }> {
  const response = await fetch(`${API}/technology/${encodeURIComponent(countryId)}/active`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ technologyId, active }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error ?? "SET_ACTIVE_TECHNOLOGY_FAILED");
  }
  return (await response.json()) as { technology: CountryTechnologyState };
}

export async function fetchCountryModifiers(token: string, countryId: string): Promise<{ modifiers: ActiveModifierRow[] }> {
  const response = await fetch(`${API}/modifiers/${encodeURIComponent(countryId)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error ?? "MODIFIERS_FAILED");
  }
  return (await response.json()) as { modifiers: ActiveModifierRow[] };
}

export type CountryDecisionView = {
  id: string;
  name: string;
  description: string;
  color: string;
  logoUrl: string | null;
  decision: DecisionDefinition;
  visible: boolean;
  available: boolean;
  reason: string | null;
};

function normalizeCountryDecisionView(decision: CountryDecisionView): CountryDecisionView {
  return {
    ...decision,
    logoUrl: withAssetBase(decision.logoUrl) ?? null,
  };
}

export async function fetchCountryDecisions(
  token: string,
  countryId: string,
): Promise<{ decisions: CountryDecisionView[]; record: CountryDecisionRecord }> {
  const response = await fetch(`${API}/decisions/${encodeURIComponent(countryId)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error ?? "DECISIONS_FETCH_FAILED");
  }
  const data = (await response.json()) as { decisions: CountryDecisionView[]; record: CountryDecisionRecord };
  return { ...data, decisions: data.decisions.map(normalizeCountryDecisionView) };
}

export async function takeCountryDecision(
  token: string,
  countryId: string,
  decisionId: string,
): Promise<{ ok: boolean; decisions: CountryDecisionView[]; record: CountryDecisionRecord }> {
  const response = await fetch(`${API}/decisions/${encodeURIComponent(countryId)}/${encodeURIComponent(decisionId)}/take`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.reason ?? err.error ?? "DECISION_TAKE_FAILED");
  }
  const data = (await response.json()) as { ok: boolean; decisions: CountryDecisionView[]; record: CountryDecisionRecord };
  return { ...data, decisions: data.decisions.map(normalizeCountryDecisionView) };
}

export type CountryEventView = {
  pendingId: string;
  id: string;
  name: string;
  description: string;
  color: string;
  logoUrl: string | null;
  event: GameEventDefinition;
  createdTurnId: number;
};

function normalizeCountryEventView(event: CountryEventView): CountryEventView {
  return {
    ...event,
    logoUrl: withAssetBase(event.logoUrl) ?? null,
  };
}

export async function fetchCountryEvents(
  token: string,
  countryId: string,
): Promise<{ events: CountryEventView[]; record: CountryEventRecord }> {
  const response = await fetch(`${API}/events/${encodeURIComponent(countryId)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error ?? "EVENTS_FETCH_FAILED");
  }
  const data = (await response.json()) as { events: CountryEventView[]; record: CountryEventRecord };
  return { ...data, events: data.events.map(normalizeCountryEventView) };
}

export async function chooseCountryEventOption(
  token: string,
  countryId: string,
  pendingId: string,
  optionId: string,
): Promise<{ ok: boolean; events: CountryEventView[]; record: CountryEventRecord }> {
  const response = await fetch(`${API}/events/${encodeURIComponent(countryId)}/${encodeURIComponent(pendingId)}/choose`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ optionId }),
  });
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.reason ?? err.error ?? "EVENT_OPTION_FAILED");
  }
  const data = (await response.json()) as { ok: boolean; events: CountryEventView[]; record: CountryEventRecord };
  return { ...data, events: data.events.map(normalizeCountryEventView) };
}

export type DiplomacyProposalsResponse = {
  proposals: DiplomacyProposal[];
  turnId: number;
};

export async function fetchDiplomacyProposals(token: string): Promise<DiplomacyProposalsResponse> {
  const response = await fetch(`${API}/diplomacy/proposals`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error ?? "DIPLOMACY_PROPOSALS_FAILED");
  }
  return (await response.json()) as DiplomacyProposalsResponse;
}

export async function createDiplomacyProposal(
  token: string,
  payload: { name?: string; toCountryId: string; expiresInTurns?: number; clauses: TreatyClause[] },
): Promise<DiplomacyProposalsResponse & { proposal: DiplomacyProposal }> {
  const response = await fetch(`${API}/diplomacy/proposals`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error ?? "CREATE_DIPLOMACY_PROPOSAL_FAILED");
  }
  return (await response.json()) as DiplomacyProposalsResponse & { proposal: DiplomacyProposal };
}

export async function acceptDiplomacyProposal(
  token: string,
  proposalId: string,
): Promise<DiplomacyProposalsResponse & { proposal: DiplomacyProposal }> {
  const response = await fetch(`${API}/diplomacy/proposals/${encodeURIComponent(proposalId)}/accept`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error ?? "ACCEPT_DIPLOMACY_PROPOSAL_FAILED");
  }
  return (await response.json()) as DiplomacyProposalsResponse & { proposal: DiplomacyProposal };
}

export async function rejectDiplomacyProposal(
  token: string,
  proposalId: string,
): Promise<DiplomacyProposalsResponse & { proposal: DiplomacyProposal }> {
  const response = await fetch(`${API}/diplomacy/proposals/${encodeURIComponent(proposalId)}/reject`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error ?? "REJECT_DIPLOMACY_PROPOSAL_FAILED");
  }
  return (await response.json()) as DiplomacyProposalsResponse & { proposal: DiplomacyProposal };
}

export async function reviseDiplomacyProposal(
  token: string,
  proposalId: string,
  payload: { name?: string; expiresInTurns?: number; clauses: TreatyClause[] },
): Promise<DiplomacyProposalsResponse & { proposal: DiplomacyProposal }> {
  const response = await fetch(`${API}/diplomacy/proposals/${encodeURIComponent(proposalId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error ?? "REVISE_DIPLOMACY_PROPOSAL_FAILED");
  }
  return (await response.json()) as DiplomacyProposalsResponse & { proposal: DiplomacyProposal };
}

export async function renewDiplomacyProposal(
  token: string,
  proposalId: string,
): Promise<DiplomacyProposalsResponse & { proposal: DiplomacyProposal }> {
  const response = await fetch(`${API}/diplomacy/proposals/${encodeURIComponent(proposalId)}/renew`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error ?? "RENEW_DIPLOMACY_PROPOSAL_FAILED");
  }
  return (await response.json()) as DiplomacyProposalsResponse & { proposal: DiplomacyProposal };
}

export async function declineDiplomacyProposalRenewal(
  token: string,
  proposalId: string,
): Promise<DiplomacyProposalsResponse & { proposal: DiplomacyProposal }> {
  const response = await fetch(`${API}/diplomacy/proposals/${encodeURIComponent(proposalId)}/decline-renewal`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error ?? "DECLINE_DIPLOMACY_RENEWAL_FAILED");
  }
  return (await response.json()) as DiplomacyProposalsResponse & { proposal: DiplomacyProposal };
}

export type MarketOverviewItem = {
  goodId: string;
  goodName: string;
  countryPrice: number;
  globalPrice: number;
  countryDemand: number;
  countryOffer: number;
  countryCoveragePct: number;
  globalDemand: number;
  globalOffer: number;
  globalCoveragePct: number;
  countryPriceHistory?: number[];
  globalPriceHistory?: number[];
  countryDemandHistory?: number[];
  countryOfferHistory?: number[];
  globalDemandHistory?: number[];
  globalOfferHistory?: number[];
  countryProductionFactHistory?: number[];
  countryProductionMaxHistory?: number[];
  globalProductionFactHistory?: number[];
  globalProductionMaxHistory?: number[];
};

export type MarketOverviewAlert = {
  id: string;
  severity: "warning" | "critical";
  kind: "critical-deficit" | "infra-overload" | "building-inactive";
  message: string;
  provinceId?: string;
  buildingId?: string;
  instanceId?: string;
  goodId?: string;
};

export type LogisticsSnapshot = {
  turnId: number;
  corridorServiceAreas: Array<{
    corridorId: string;
    marketId: string;
    ownerCountryId: string;
    transportMode: TransportMode;
    provinceIds: string[];
    capacity: number;
    load: number;
    utilization: number;
    status: "building" | "active" | "closed";
  }>;
  coverageByModeByProvince: Record<
    TransportMode,
    Record<
      string,
      {
        capacity: number;
        load: number;
        utilization: number;
        corridorIds: string[];
      }
    >
  >;
  failuresByProvince: Record<
    string,
    Array<{
      provinceId: string;
      sourceProvinceId?: string | null;
      sourceCountryId?: string | null;
      sourceMarketId?: string | null;
      goodId: string;
      reason: "no-corridor" | "no-capacity" | "no-transit";
      amount: number;
      transportModes: TransportMode[];
    }>
  >;
};

export type MarketOverviewResponse = {
  turnId: number;
  countryId: string;
  marketId: string;
  marketCapitalProvinceId?: string | null;
  transportCorridors?: MarketTransportCorridor[];
  logisticsSnapshot?: LogisticsSnapshot;
  goods: MarketOverviewItem[];
  tradeByGood?: Record<
    string,
    {
      countryImportsByCountry?: Record<string, number>;
      countryExportsByCountry?: Record<string, number>;
      globalImportsByMarket?: Record<string, number>;
      globalExportsByMarket?: Record<string, number>;
    }
  >;
  alerts: MarketOverviewAlert[];
};

export type MarketMember = {
  countryId: string;
  countryName: string;
  flagUrl: string | null;
  isOwner: boolean;
};

export type TransportMode = "land" | "sea" | "air" | "pipeline" | "powerGrid";

export type MarketTransportCorridor = {
  id: string;
  marketId: string;
  ownerCountryId: string;
  provinceIds: string[];
  routePoints?: { provinceId: string; lng: number; lat: number }[];
  transportMode: TransportMode;
  level: number;
  status: "building" | "active" | "closed";
  progressConstruction: number;
  costConstruction: number;
  lastLoadByMode?: Record<string, number>;
  lastCapacityByMode?: Record<string, number>;
  lastLoadHistoryByMode?: Record<string, number[]>;
  foreignConstructionRights?: Array<{
    provinceId: string;
    grantorCountryId: string;
    agreementId: string;
    expirationPolicy: "disable_without_transit" | "nationalize_to_territory_owner";
    sourceProposalId?: string | null;
    sourceClauseId?: string | null;
  }>;
  nationalizedAt?: string | null;
  nationalizedFromCountryId?: string | null;
  createdAt: string;
  completedAt?: string | null;
};

export type MarketDetails = {
  id: string;
  name: string;
  logoUrl: string | null;
  ownerCountryId: string;
  ownerCountryName: string;
  capitalProvinceId?: string | null;
  memberCountryIds: string[];
  visibility: "public" | "private";
  createdAt: string;
  members: MarketMember[];
  transportCorridors?: MarketTransportCorridor[];
};

export type MarketInvite = {
  id: string;
  marketId: string;
  fromCountryId: string;
  toCountryId: string;
  kind?: "invite" | "join-request";
  status: "pending" | "accepted" | "rejected" | "canceled";
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
  marketName?: string;
  marketLogoUrl?: string | null;
  fromCountryName?: string;
  fromCountryFlagUrl?: string | null;
  toCountryName?: string;
  toCountryFlagUrl?: string | null;
};

export type MarketCatalogItem = {
  id: string;
  name: string;
  logoUrl: string | null;
  capitalProvinceId?: string | null;
  ownerCountryId: string;
  ownerCountryName: string;
  ownerCountryFlagUrl: string | null;
  memberCountryIds: string[];
  visibility: "public" | "private";
  membersCount: number;
  isMember: boolean;
  canJoinDirectly: boolean;
  canRequestJoin: boolean;
  hasPendingJoinRequest: boolean;
};

export type MarketSanction = {
  id: string;
  initiatorCountryId: string;
  initiatorCountryName?: string;
  direction: "import" | "export" | "both";
  targetType: "country" | "market";
  targetId: string;
  targetName?: string;
  goods?: string[];
  goodsNamed?: Array<{ id: string; name: string }>;
  mode: "ban" | "cap";
  capAmountPerTurn?: number | null;
  startTurn: number;
  durationTurns: number;
  enabled?: boolean;
  activeNow?: boolean;
  expiresAtTurn?: number;
};

export type InfrastructureTransitAgreement = {
  id: string;
  fromCountryId: string;
  toCountryId: string;
  transportModes: TransportMode[];
  active: boolean;
  bilateral: boolean;
  sourceProposalId?: string | null;
  sourceClauseId?: string | null;
  expiresTurnId?: number | null;
  createdAt: string;
  updatedAt: string;
};

export type InfrastructureConstructionRight = {
  id: string;
  fromCountryId: string;
  toCountryId: string;
  transportModes: TransportMode[];
  active: boolean;
  bilateral: boolean;
  expirationPolicy: "disable_without_transit" | "nationalize_to_territory_owner";
  sourceProposalId?: string | null;
  sourceClauseId?: string | null;
  expiresTurnId?: number | null;
  createdAt: string;
  updatedAt: string;
};

export async function fetchMarketOverview(token: string): Promise<MarketOverviewResponse> {
  const response = await fetch(`${API}/economy/market-overview`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error ?? "MARKET_OVERVIEW_FAILED");
  }
  return (await response.json()) as MarketOverviewResponse;
}

export async function fetchMarketDetails(token: string, marketId: string): Promise<{ market: MarketDetails }> {
  const response = await fetch(`${API}/markets/${encodeURIComponent(marketId)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error ?? "MARKET_DETAILS_FAILED");
  }
  const data = (await response.json()) as { market: MarketDetails };
  return {
    market: {
      ...data.market,
      logoUrl: withAssetBase(data.market.logoUrl) ?? null,
      members: (data.market.members ?? []).map((member) => ({
        ...member,
        flagUrl: withAssetBase(member.flagUrl) ?? null,
      })),
    },
  };
}

export async function fetchMarketsCatalog(token: string): Promise<{ markets: MarketCatalogItem[] }> {
  const response = await fetch(`${API}/markets`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error ?? "MARKETS_CATALOG_FAILED");
  }
  const data = (await response.json()) as { markets: MarketCatalogItem[] };
  return {
    markets: (data.markets ?? []).map((market) => ({
      ...market,
      logoUrl: withAssetBase(market.logoUrl) ?? null,
      ownerCountryFlagUrl: withAssetBase(market.ownerCountryFlagUrl) ?? null,
    })),
  };
}

export async function updateMarket(
  token: string,
  marketId: string,
  payload: { name?: string; visibility?: "public" | "private"; logoFile?: File | null },
): Promise<{ market: MarketDetails }> {
  const formData = new FormData();
  if (typeof payload.name === "string") {
    formData.set("name", payload.name);
  }
  if (payload.visibility) {
    formData.set("visibility", payload.visibility);
  }
  if (payload.logoFile) {
    formData.set("marketLogo", payload.logoFile);
  }
  const response = await fetch(`${API}/markets/${encodeURIComponent(marketId)}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error ?? "MARKET_UPDATE_FAILED");
  }
  const data = (await response.json()) as { market: MarketDetails };
  return {
    market: {
      ...data.market,
      logoUrl: withAssetBase(data.market.logoUrl) ?? null,
      members: (data.market.members ?? []).map((member) => ({
        ...member,
        flagUrl: withAssetBase(member.flagUrl) ?? null,
      })),
    },
  };
}

export async function createMarketTransportCorridor(
  token: string,
  marketId: string,
  payload: {
    provinceIds: string[];
    routePoints?: { provinceId: string; lng: number; lat: number }[];
    transportMode: TransportMode;
  },
): Promise<{ corridor: MarketTransportCorridor; corridors: MarketTransportCorridor[] }> {
  const response = await fetch(`${API}/markets/${encodeURIComponent(marketId)}/corridors`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error ?? "MARKET_CORRIDOR_CREATE_FAILED");
  }
  return (await response.json()) as { corridor: MarketTransportCorridor; corridors: MarketTransportCorridor[] };
}

export async function updateMarketTransportCorridor(
  token: string,
  marketId: string,
  corridorId: string,
  payload: {
    action?: "open" | "close" | "upgrade" | "demolish";
  },
): Promise<{ corridor: MarketTransportCorridor | null; corridors: MarketTransportCorridor[] }> {
  const response = await fetch(`${API}/markets/${encodeURIComponent(marketId)}/corridors/${encodeURIComponent(corridorId)}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error ?? "MARKET_CORRIDOR_UPDATE_FAILED");
  }
  return (await response.json()) as { corridor: MarketTransportCorridor | null; corridors: MarketTransportCorridor[] };
}

export async function deleteMarketTransportCorridor(
  token: string,
  marketId: string,
  corridorId: string,
): Promise<{ ok: true; corridorId: string; corridors: MarketTransportCorridor[] }> {
  const response = await fetch(`${API}/markets/${encodeURIComponent(marketId)}/corridors/${encodeURIComponent(corridorId)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error ?? "MARKET_CORRIDOR_DELETE_FAILED");
  }
  return (await response.json()) as { ok: true; corridorId: string; corridors: MarketTransportCorridor[] };
}

export async function createMarketInvite(
  token: string,
  marketId: string,
  payload: { toCountryId: string; expiresInDays?: number },
): Promise<{ invite: MarketInvite }> {
  const response = await fetch(`${API}/markets/${encodeURIComponent(marketId)}/invites`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error ?? "MARKET_INVITE_CREATE_FAILED");
  }
  const data = (await response.json()) as { invite: MarketInvite };
  return {
    invite: {
      ...data.invite,
      marketLogoUrl: withAssetBase(data.invite.marketLogoUrl) ?? null,
      fromCountryFlagUrl: withAssetBase(data.invite.fromCountryFlagUrl) ?? null,
    },
  };
}

export async function fetchCountryMarketInvites(token: string): Promise<{ invites: MarketInvite[] }> {
  const response = await fetch(`${API}/country/market-invites`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error ?? "MARKET_INVITES_FAILED");
  }
  const data = (await response.json()) as { invites: MarketInvite[] };
  return {
    invites: (data.invites ?? []).map((invite) => ({
      ...invite,
      marketLogoUrl: withAssetBase(invite.marketLogoUrl) ?? null,
      fromCountryFlagUrl: withAssetBase(invite.fromCountryFlagUrl) ?? null,
      toCountryFlagUrl: withAssetBase(invite.toCountryFlagUrl) ?? null,
    })),
  };
}

export async function respondMarketInvite(
  token: string,
  inviteId: string,
  action: "accept" | "reject" | "cancel",
): Promise<{ invite: MarketInvite }> {
  const response = await fetch(`${API}/market-invites/${encodeURIComponent(inviteId)}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ action }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error ?? "MARKET_INVITE_ACTION_FAILED");
  }
  const data = (await response.json()) as { invite: MarketInvite };
  return {
    invite: {
      ...data.invite,
      marketLogoUrl: withAssetBase(data.invite.marketLogoUrl) ?? null,
      fromCountryFlagUrl: withAssetBase(data.invite.fromCountryFlagUrl) ?? null,
      toCountryFlagUrl: withAssetBase(data.invite.toCountryFlagUrl) ?? null,
    },
  };
}

export async function fetchMarketInvites(token: string, marketId: string): Promise<{ invites: MarketInvite[] }> {
  const response = await fetch(`${API}/markets/${encodeURIComponent(marketId)}/invites`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error ?? "MARKET_OUTGOING_INVITES_FAILED");
  }
  const data = (await response.json()) as { invites: MarketInvite[] };
  return {
    invites: (data.invites ?? []).map((invite) => ({
      ...invite,
      marketLogoUrl: withAssetBase(invite.marketLogoUrl) ?? null,
      fromCountryFlagUrl: withAssetBase(invite.fromCountryFlagUrl) ?? null,
      toCountryFlagUrl: withAssetBase(invite.toCountryFlagUrl) ?? null,
    })),
  };
}

export async function transferMarketOwner(
  token: string,
  marketId: string,
  nextOwnerCountryId: string,
): Promise<{ market: MarketDetails }> {
  const response = await fetch(`${API}/markets/${encodeURIComponent(marketId)}/transfer-owner`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ nextOwnerCountryId }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error ?? "MARKET_TRANSFER_OWNER_FAILED");
  }
  const data = (await response.json()) as { market: MarketDetails };
  return {
    market: {
      ...data.market,
      logoUrl: withAssetBase(data.market.logoUrl) ?? null,
      members: (data.market.members ?? []).map((member) => ({
        ...member,
        flagUrl: withAssetBase(member.flagUrl) ?? null,
      })),
    },
  };
}

export async function fetchMarketSanctions(
  token: string,
  marketId: string,
): Promise<{ sanctions: MarketSanction[]; ownerCountryId: string; turnId: number }> {
  const response = await fetch(`${API}/markets/${encodeURIComponent(marketId)}/sanctions`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error ?? "MARKET_SANCTIONS_FETCH_FAILED");
  }
  return (await response.json()) as { sanctions: MarketSanction[]; ownerCountryId: string; turnId: number };
}

export async function createMarketSanction(
  token: string,
  marketId: string,
  payload: {
    direction: "import" | "export" | "both";
    targetType: "country" | "market";
    targetId: string;
    goods?: string[];
    mode: "ban" | "cap";
    capAmountPerTurn?: number | null;
    startTurn?: number;
    durationTurns: number;
    enabled?: boolean;
  },
): Promise<{ sanction: MarketSanction }> {
  const response = await fetch(`${API}/markets/${encodeURIComponent(marketId)}/sanctions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error ?? "MARKET_SANCTION_CREATE_FAILED");
  }
  return (await response.json()) as { sanction: MarketSanction };
}

export async function updateMarketSanction(
  token: string,
  marketId: string,
  sanctionId: string,
  payload: Partial<{
    direction: "import" | "export" | "both";
    targetType: "country" | "market";
    targetId: string;
    goods: string[];
    mode: "ban" | "cap";
    capAmountPerTurn: number | null;
    startTurn: number;
    durationTurns: number;
    enabled: boolean;
  }>,
): Promise<{ sanction: MarketSanction }> {
  const response = await fetch(
    `${API}/markets/${encodeURIComponent(marketId)}/sanctions/${encodeURIComponent(sanctionId)}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
  );
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error ?? "MARKET_SANCTION_UPDATE_FAILED");
  }
  return (await response.json()) as { sanction: MarketSanction };
}

export async function deleteMarketSanction(token: string, marketId: string, sanctionId: string): Promise<{ ok: true }> {
  const response = await fetch(
    `${API}/markets/${encodeURIComponent(marketId)}/sanctions/${encodeURIComponent(sanctionId)}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    },
  );
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error ?? "MARKET_SANCTION_DELETE_FAILED");
  }
  return (await response.json()) as { ok: true };
}

export async function fetchInfrastructureTransitAgreements(token: string): Promise<{ agreements: InfrastructureTransitAgreement[] }> {
  const response = await fetch(`${API}/infrastructure-transit-agreements`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error ?? "TRANSIT_AGREEMENTS_FAILED");
  }
  return (await response.json()) as { agreements: InfrastructureTransitAgreement[] };
}

export async function fetchInfrastructureConstructionRights(token: string): Promise<{ rights: InfrastructureConstructionRight[] }> {
  const response = await fetch(`${API}/infrastructure-construction-rights`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error ?? "CONSTRUCTION_RIGHTS_FAILED");
  }
  return (await response.json()) as { rights: InfrastructureConstructionRight[] };
}

export async function createInfrastructureTransitAgreement(
  token: string,
  payload: {
    toCountryId: string;
    fromCountryId?: string;
    transportModes: TransportMode[];
    active?: boolean;
    bilateral?: boolean;
  },
): Promise<{ agreement: InfrastructureTransitAgreement }> {
  const response = await fetch(`${API}/infrastructure-transit-agreements`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error ?? "TRANSIT_AGREEMENT_CREATE_FAILED");
  }
  return (await response.json()) as { agreement: InfrastructureTransitAgreement };
}

export async function updateInfrastructureTransitAgreement(
  token: string,
  agreementId: string,
  payload: { transportModes?: TransportMode[]; active?: boolean; bilateral?: boolean },
): Promise<{ agreement: InfrastructureTransitAgreement }> {
  const response = await fetch(`${API}/infrastructure-transit-agreements/${encodeURIComponent(agreementId)}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error ?? "TRANSIT_AGREEMENT_UPDATE_FAILED");
  }
  return (await response.json()) as { agreement: InfrastructureTransitAgreement };
}

export async function deleteInfrastructureTransitAgreement(token: string, agreementId: string): Promise<{ ok: true }> {
  const response = await fetch(`${API}/infrastructure-transit-agreements/${encodeURIComponent(agreementId)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error ?? "TRANSIT_AGREEMENT_DELETE_FAILED");
  }
  return (await response.json()) as { ok: true };
}

export async function leaveMarket(token: string, marketId: string): Promise<{ ok: boolean; marketIdLeft: string; newMarketId: string }> {
  const response = await fetch(`${API}/markets/${encodeURIComponent(marketId)}/leave`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error ?? "MARKET_LEAVE_FAILED");
  }
  return (await response.json()) as { ok: boolean; marketIdLeft: string; newMarketId: string };
}

export async function joinMarket(token: string, marketId: string): Promise<{ mode: "joined" | "requested"; market?: MarketDetails; invite?: MarketInvite }> {
  const response = await fetch(`${API}/markets/${encodeURIComponent(marketId)}/join`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error ?? "MARKET_JOIN_FAILED");
  }
  const data = (await response.json()) as { mode: "joined" | "requested"; market?: MarketDetails; invite?: MarketInvite };
  return data.mode === "joined" && data.market
    ? {
        mode: "joined",
        market: {
          ...data.market,
          logoUrl: withAssetBase(data.market.logoUrl) ?? null,
          members: (data.market.members ?? []).map((member) => ({
            ...member,
            flagUrl: withAssetBase(member.flagUrl) ?? null,
          })),
        },
      }
    : {
        mode: "requested",
        invite: data.invite
          ? {
              ...data.invite,
              marketLogoUrl: withAssetBase(data.invite.marketLogoUrl) ?? null,
              fromCountryFlagUrl: withAssetBase(data.invite.fromCountryFlagUrl) ?? null,
              toCountryFlagUrl: withAssetBase(data.invite.toCountryFlagUrl) ?? null,
            }
          : undefined,
      };
}

export async function fetchCurrentTurnOrders(token: string): Promise<{ turnId: number; orders: Order[] }> {
  const response = await fetch(`${API}/country/orders/current`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error ?? "CURRENT_ORDERS_FAILED");
  }
  const data = (await response.json()) as { turnId?: unknown; orders?: unknown };
  const turnId = typeof data.turnId === "number" && Number.isFinite(data.turnId) ? Math.floor(data.turnId) : 1;
  const orders = Array.isArray(data.orders) ? (data.orders as Order[]) : [];
  return { turnId, orders };
}

export async function fetchContentCultures(): Promise<ContentCulture[]> {
  const response = await fetch(`${API}/content/cultures`);
  if (!response.ok) {
    throw new Error("CONTENT_CULTURES_FAILED");
  }
  const data = (await response.json()) as { cultures?: ContentCulture[] };
  return (data.cultures ?? []).map(normalizeContentCulture);
}

export async function fetchContentEntries(kind: ContentEntryKind): Promise<ContentEntry[]> {
  const response = await fetch(`${API}/content/entries/${encodeURIComponent(kind)}`);
  if (!response.ok) {
    throw new Error("CONTENT_ENTRIES_FAILED");
  }
  const data = (await response.json()) as { items?: ContentEntry[] };
  return (data.items ?? []).map(normalizeContentEntry);
}

export async function adminFetchContentEntries(token: string, kind: ContentEntryKind): Promise<ContentEntry[]> {
  const response = await fetch(`${API}/admin/content/entries/${encodeURIComponent(kind)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error ?? "ADMIN_CONTENT_ENTRIES_FAILED");
  }
  const data = (await response.json()) as { items?: ContentEntry[] };
  return (data.items ?? []).map(normalizeContentEntry);
}

export async function adminCreateContentEntry(
  token: string,
  kind: ContentEntryKind,
  payload: ContentEntryUpsertPayload,
) {
  const response = await fetch(`${API}/admin/content/entries/${encodeURIComponent(kind)}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error ?? "ADMIN_CREATE_CONTENT_ENTRY_FAILED");
  }
  const data = (await response.json()) as { item: ContentEntry; items: ContentEntry[] };
  return { item: normalizeContentEntry(data.item), items: data.items.map(normalizeContentEntry) };
}

export async function adminUpdateContentEntry(
  token: string,
  kind: ContentEntryKind,
  entryId: string,
  payload: ContentEntryUpsertPayload,
) {
  const response = await fetch(`${API}/admin/content/entries/${encodeURIComponent(kind)}/${encodeURIComponent(entryId)}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error ?? "ADMIN_UPDATE_CONTENT_ENTRY_FAILED");
  }
  const data = (await response.json()) as { item: ContentEntry; items: ContentEntry[] };
  return { item: normalizeContentEntry(data.item), items: data.items.map(normalizeContentEntry) };
}

export async function adminUploadContentEntryLogo(token: string, kind: ContentEntryKind, entryId: string, file: File) {
  const formData = new FormData();
  formData.set("cultureLogo", file);
  const response = await fetch(
    `${API}/admin/content/entries/${encodeURIComponent(kind)}/${encodeURIComponent(entryId)}/logo`,
    {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    },
  );
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error ?? "ADMIN_UPLOAD_CONTENT_ENTRY_LOGO_FAILED");
  }
  const data = (await response.json()) as { item: ContentEntry; items: ContentEntry[] };
  return { item: normalizeContentEntry(data.item), items: data.items.map(normalizeContentEntry) };
}

export async function adminDeleteContentEntryLogo(token: string, kind: ContentEntryKind, entryId: string) {
  const response = await fetch(
    `${API}/admin/content/entries/${encodeURIComponent(kind)}/${encodeURIComponent(entryId)}/logo`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    },
  );
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error ?? "ADMIN_DELETE_CONTENT_ENTRY_LOGO_FAILED");
  }
  const data = (await response.json()) as { item: ContentEntry; items: ContentEntry[] };
  return { item: normalizeContentEntry(data.item), items: data.items.map(normalizeContentEntry) };
}

export async function adminDeleteContentEntry(token: string, kind: ContentEntryKind, entryId: string) {
  const response = await fetch(`${API}/admin/content/entries/${encodeURIComponent(kind)}/${encodeURIComponent(entryId)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error ?? "ADMIN_DELETE_CONTENT_ENTRY_FAILED");
  }
  const data = (await response.json()) as { items: ContentEntry[] };
  return { items: data.items.map(normalizeContentEntry) };
}

export async function adminUploadRacePortrait(
  token: string,
  entryId: string,
  slot: "male" | "female",
  file: File,
) {
  const formData = new FormData();
  formData.set("racePortrait", file);
  const response = await fetch(
    `${API}/admin/content/entries/races/${encodeURIComponent(entryId)}/portraits/${encodeURIComponent(slot)}`,
    {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    },
  );
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error ?? "ADMIN_UPLOAD_RACE_PORTRAIT_FAILED");
  }
  const data = (await response.json()) as { item: ContentEntry; items: ContentEntry[] };
  return { item: normalizeContentEntry(data.item), items: data.items.map(normalizeContentEntry) };
}

export async function adminDeleteRacePortrait(token: string, entryId: string, slot: "male" | "female") {
  const response = await fetch(
    `${API}/admin/content/entries/races/${encodeURIComponent(entryId)}/portraits/${encodeURIComponent(slot)}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    },
  );
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error ?? "ADMIN_DELETE_RACE_PORTRAIT_FAILED");
  }
  const data = (await response.json()) as { item: ContentEntry; items: ContentEntry[] };
  return { item: normalizeContentEntry(data.item), items: data.items.map(normalizeContentEntry) };
}

export async function login(payload: LoginPayload): Promise<{ token: string; playerId: string; countryId: string; isAdmin: boolean; turnId: number; clientSettings?: { eventLogRetentionTurns: number } }> {
  const response = await fetch(`${API}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const err = await response.json();
    if (err?.error === "ACCOUNT_LOCKED") {
      const reasonText = typeof err?.lockReason === "string" && err.lockReason.trim() ? err.lockReason.trim() : null;
      const encodedReasonText = reasonText ? encodeURIComponent(reasonText) : null;
      if (typeof err?.blockedUntilTurn === "number") {
        throw new Error(`ACCOUNT_LOCKED_TURN_${err.blockedUntilTurn}${encodedReasonText ? `__REASON__${encodedReasonText}` : ""}`);
      }

      if (typeof err?.blockedUntilAt === "string") {
        throw new Error(`ACCOUNT_LOCKED_TIME_${err.blockedUntilAt}${encodedReasonText ? `__REASON__${encodedReasonText}` : ""}`);
      }

      if (err?.reason === "PERMANENT") {
        throw new Error(`ACCOUNT_LOCKED_PERMANENT${encodedReasonText ? `__REASON__${encodedReasonText}` : ""}`);
      }
    }
    if (err?.error === "REGISTRATION_PENDING_APPROVAL") {
      throw new Error("REGISTRATION_PENDING_APPROVAL");
    }

    throw new Error(err.error ?? "LOGIN_FAILED");
  }

  return response.json();
}

export async function register(payload: {
  countryName: string;
  countryColor: string;
  password: string;
  flagFile?: File | null;
  crestFile?: File | null;
}): Promise<Country> {
  const formData = new FormData();
  formData.set("countryName", payload.countryName);
  formData.set("countryColor", payload.countryColor);
  formData.set("password", payload.password);

  if (payload.flagFile) {
    formData.set("flag", payload.flagFile);
  }

  if (payload.crestFile) {
    formData.set("crest", payload.crestFile);
  }

  const response = await fetch(`${API}/auth/register`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error ?? "REGISTER_FAILED");
  }

  const country = (await response.json()) as Country;
  return normalizeCountry(country);
}


export async function adminUpdateCountry(
  token: string,
  countryId: string,
  payload: {
    countryName?: string;
    countryColor?: string;
    isAdmin?: boolean;
    ignoreUntilTurn?: number | null;
    marketId?: string | null;
    flagFile?: File | null;
    crestFile?: File | null;
  },
): Promise<Country> {
  const formData = new FormData();

  if (payload.countryName != null) {
    formData.set("countryName", payload.countryName);
  }
  if (payload.countryColor != null) {
    formData.set("countryColor", payload.countryColor);
  }
  if (payload.isAdmin != null) {
    formData.set("isAdmin", String(payload.isAdmin));
  }
  if (payload.ignoreUntilTurn !== undefined) {
    formData.set("ignoreUntilTurn", payload.ignoreUntilTurn == null ? "0" : String(payload.ignoreUntilTurn));
  }
  if (payload.marketId !== undefined) {
    formData.set("marketId", payload.marketId ?? "");
  }
  if (payload.flagFile) {
    formData.set("flag", payload.flagFile);
  }
  if (payload.crestFile) {
    formData.set("crest", payload.crestFile);
  }

  const response = await fetch(`${API}/admin/countries/${countryId}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error ?? "COUNTRY_UPDATE_FAILED");
  }

  return normalizeCountry((await response.json()) as Country);
}

export async function adminDeleteCountry(token: string, countryId: string): Promise<void> {
  const response = await fetch(`${API}/admin/countries/${countryId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error ?? "COUNTRY_DELETE_FAILED");
  }
}


export async function adminSetCountryPunishment(
  token: string,
  countryId: string,
  payload:
    | { action: "unlock"; reasonText?: string }
    | { action: "permanent"; reasonText?: string }
    | { action: "turns"; turns: number; reasonText?: string }
    | { action: "time"; blockedUntilAt: string; reasonText?: string },
): Promise<Country> {
  const response = await fetch(`${API}/admin/countries/${countryId}/punishments`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error ?? "PUNISHMENT_UPDATE_FAILED");
  }

  return normalizeCountry((await response.json()) as Country);
}

export type TurnStatusItem = {
  id: string;
  name: string;
  color?: string;
  flagUrl?: string | null;
  status: "ready" | "waiting" | "blocked" | "ignored";
  blockedReason: "PERMANENT" | "TURN" | "TIME" | null;
  blockedUntilTurn: number | null;
  blockedUntilAt: string | null;
  ignoreUntilTurn: number | null;
  online: boolean;
  lastLoginAt: string | null;
};

export type UiNotificationItem = Extract<WsOutMessage, { type: "UI_NOTIFY" }>["notification"];

export async function fetchTurnStatus(): Promise<{ turnId: number; readyCount: number; requiredCount: number; countries: TurnStatusItem[] }> {
  const response = await fetch(`${API}/turn/status`);
  if (!response.ok) {
    throw new Error("TURN_STATUS_FAILED");
  }
  const data = (await response.json()) as { turnId: number; readyCount: number; requiredCount: number; countries: TurnStatusItem[] };
  return {
    ...data,
    countries: data.countries.map((c) => ({ ...c, flagUrl: withAssetBase(c.flagUrl) ?? null })),
  };
}

export async function fetchPendingUiNotifications(token: string): Promise<UiNotificationItem[]> {
  const response = await fetch(`${API}/notifications/ui/pending`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error ?? "UI_NOTIFICATIONS_PENDING_FAILED");
  }
  const data = (await response.json()) as { notifications: UiNotificationItem[] };
  return data.notifications;
}

export async function markUiNotificationViewed(token: string, notificationId: string): Promise<void> {
  const response = await fetch(`${API}/notifications/ui/${encodeURIComponent(notificationId)}/viewed`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok && response.status !== 404) {
    const err = await response.json();
    throw new Error(err.error ?? "UI_NOTIFICATION_VIEW_FAILED");
  }
}

export type GameSettings = {
  economy: {
    baseCulturePerTurn: number;
    baseSciencePerTurn: number;
    baseReligionPerTurn: number;
    baseConstructionPerTurn: number;
    baseDucatsPerTurn: number;
    baseGoldPerTurn: number;
    demolitionCostConstructionPercent: number;
    marketPriceSmoothing: number;
    buildingDurabilityDecayPerTurn: number;
    buildingDurabilityRecoveryPerTurn: number;
    pollutionProductivityEffectPer1000: number;
    explorationBaseEmptyChancePct: number;
    explorationDepletionPerAttemptPct: number;
    explorationDurationTurns: number;
    explorationRollsPerExpedition: number;
  };
  markets?: {
    countryMarketByCountryId: Record<string, string>;
    sanctionsById?: Record<
      string,
      {
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
      }
    >;
    infrastructureTransitAgreementsById?: Record<
      string,
      {
        id: string;
        fromCountryId: string;
        toCountryId: string;
        transportModes: TransportMode[];
        active: boolean;
        bilateral: boolean;
        createdAt: string;
        updatedAt: string;
      }
    >;
  };
  colonization: {
    maxActiveColonizations: number;
    pointsPerTurn: number;
    pointsCostPer1000Km2: number;
    ducatsCostPer1000Km2: number;
  };
  customization: {
    renameDucats: number;
    recolorDucats: number;
    flagDucats: number;
    crestDucats: number;
    provinceRenameDucats: number;
  };
  registration: {
    requireAdminApproval: boolean;
  };
  eventLog: {
    retentionTurns: number;
  };
  turnTimer: {
    enabled: boolean;
    secondsPerTurn: number;
    pauseWhenNoPlayersOnline?: boolean;
    currentTurnStartedAtMs?: number;
  };
  map: {
    showAntarctica: boolean;
    backgroundImageUrl: string | null;
  };
  resourceIcons: {
    population: string | null;
    culture: string | null;
    science: string | null;
    religion: string | null;
    colonization: string | null;
    construction: string | null;
    ducats: string | null;
    gold: string | null;
  };
};

export type CustomizationPrices = GameSettings["customization"];
export type ResourceIconsMap = GameSettings["resourceIcons"];
export type CivilopediaEntry = {
  id: string;
  category: string;
  title: string;
  summary: string;
  keywords: string[];
  imageUrl: string | null;
  relatedEntryIds: string[];
  sections: Array<{ title: string; paragraphs: string[] }>;
};

function normalizeResourceIcons(icons?: Partial<ResourceIconsMap> | null): ResourceIconsMap {
  return {
    population: withAssetBase(icons?.population) ?? null,
    culture: withAssetBase(icons?.culture) ?? null,
    science: withAssetBase(icons?.science) ?? null,
    religion: withAssetBase(icons?.religion) ?? null,
    colonization: withAssetBase(icons?.colonization) ?? null,
    construction: withAssetBase(icons?.construction) ?? null,
    ducats: withAssetBase(icons?.ducats) ?? null,
    gold: withAssetBase(icons?.gold) ?? null,
  };
}

function normalizeMapSettings(map?: Partial<GameSettings["map"]> | null): GameSettings["map"] {
  return {
    showAntarctica: typeof map?.showAntarctica === "boolean" ? map.showAntarctica : true,
    backgroundImageUrl: withAssetBase(map?.backgroundImageUrl) ?? null,
  };
}

export async function fetchPublicCustomizationPrices(): Promise<CustomizationPrices> {
  const response = await fetch(`${API}/game-settings/public`);
  if (!response.ok) {
    throw new Error("PUBLIC_GAME_SETTINGS_FAILED");
  }

  const data = (await response.json()) as { customization: CustomizationPrices };
  return data.customization;
}

export type ProvinceIndexItem = {
  id: string;
  name: string;
  regionId?: string | null;
  provinceColor: string;
  regionColor: string;
  areaKm2: number;
  provinceType?: string | null;
  centerX?: number | null;
  centerY?: number | null;
  sourceCenterX?: number | null;
  sourceCenterY?: number | null;
  neighbors?: string[];
  climate?: string | null;
  pollution?: number | null;
  radiation?: number | null;
  landscape?: string | null;
  continent?: string | null;
  strategicRegion?: string | null;
  fertileLandKm2?: number | null;
  fertility?: number | null;
};

export async function fetchProvinceIndex(): Promise<ProvinceIndexItem[]> {
  const response = await fetch(`${API}/provinces/index`);
  if (!response.ok) {
    throw new Error("PROVINCE_INDEX_FAILED");
  }
  const data = (await response.json()) as { provinces: ProvinceIndexItem[] };
  return data.provinces;
}

export async function fetchPublicGameUiSettings(): Promise<Pick<GameSettings, "economy" | "colonization" | "customization" | "eventLog" | "turnTimer" | "map" | "resourceIcons">> {
  const response = await fetch(`${API}/game-settings/public`);
  if (!response.ok) {
    throw new Error("PUBLIC_GAME_SETTINGS_FAILED");
  }
  const data = (await response.json()) as Pick<GameSettings, "economy" | "colonization" | "customization" | "eventLog" | "turnTimer" | "map" | "resourceIcons">;
  return {
    ...data,
    map: normalizeMapSettings(data.map),
    resourceIcons: normalizeResourceIcons(data.resourceIcons),
  };
}

export async function fetchCivilopedia(): Promise<{ categories: string[]; entries: CivilopediaEntry[] }> {
  const response = await fetch(`${API}/civilopedia`);
  if (!response.ok) throw new Error("CIVILOPEDIA_FAILED");
  const data = (await response.json()) as { civilopedia?: { categories?: string[]; entries?: CivilopediaEntry[] } };
  return {
    categories: data.civilopedia?.categories ?? [],
    entries: (data.civilopedia?.entries ?? []).map((entry) => ({
      ...entry,
      imageUrl: withAssetBase(entry.imageUrl) ?? null,
    })),
  };
}

export async function fetchAdminCivilopedia(token: string): Promise<{ categories: string[]; entries: CivilopediaEntry[] }> {
  const response = await fetch(`${API}/admin/civilopedia`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error ?? "ADMIN_CIVILOPEDIA_FAILED");
  }
  const data = (await response.json()) as { civilopedia?: { categories?: string[]; entries?: CivilopediaEntry[] } };
  return {
    categories: data.civilopedia?.categories ?? [],
    entries: (data.civilopedia?.entries ?? []).map((entry) => ({
      ...entry,
      imageUrl: withAssetBase(entry.imageUrl) ?? null,
    })),
  };
}

export async function updateAdminCivilopedia(
  token: string,
  payload: { categories: string[]; entries: CivilopediaEntry[] },
): Promise<{ categories: string[]; entries: CivilopediaEntry[] }> {
  const response = await fetch(`${API}/admin/civilopedia`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error ?? "ADMIN_CIVILOPEDIA_UPDATE_FAILED");
  }
  const data = (await response.json()) as { civilopedia?: { categories?: string[]; entries?: CivilopediaEntry[] } };
  return {
    categories: data.civilopedia?.categories ?? [],
    entries: (data.civilopedia?.entries ?? []).map((entry) => ({
      ...entry,
      imageUrl: withAssetBase(entry.imageUrl) ?? null,
    })),
  };
}

export async function uploadCivilopediaImage(token: string, file: File): Promise<{ imageUrl: string }> {
  const formData = new FormData();
  formData.set("civilopediaImage", file);
  const response = await fetch(`${API}/admin/civilopedia/image`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error ?? "CIVILOPEDIA_IMAGE_UPLOAD_FAILED");
  }
  const data = (await response.json()) as { imageUrl: string };
  return { imageUrl: withAssetBase(data.imageUrl) ?? data.imageUrl };
}

export async function uploadCivilopediaInlineImage(token: string, file: File): Promise<{ imageUrl: string }> {
  const formData = new FormData();
  formData.set("civilopediaImage", file);
  const response = await fetch(`${API}/admin/civilopedia/inline-image`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error ?? "CIVILOPEDIA_INLINE_IMAGE_UPLOAD_FAILED");
  }
  const data = (await response.json()) as { imageUrl: string };
  return { imageUrl: withAssetBase(data.imageUrl) ?? data.imageUrl };
}

export async function fetchGameSettings(token: string): Promise<GameSettings> {
  const response = await fetch(`${API}/admin/game-settings`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error ?? "GAME_SETTINGS_FAILED");
  }

  const data = (await response.json()) as GameSettings;
  return {
    ...data,
    map: normalizeMapSettings(data.map),
    resourceIcons: normalizeResourceIcons(data.resourceIcons),
  };
}

export async function updateGameSettings(
  token: string,
  payload: {
    economy?: {
      baseCulturePerTurn?: number;
      baseSciencePerTurn?: number;
      baseReligionPerTurn?: number;
      baseConstructionPerTurn?: number;
      baseDucatsPerTurn?: number;
      baseGoldPerTurn?: number;
      demolitionCostConstructionPercent?: number;
      marketPriceSmoothing?: number;
      buildingDurabilityDecayPerTurn?: number;
      buildingDurabilityRecoveryPerTurn?: number;
      pollutionProductivityEffectPer1000?: number;
      explorationBaseEmptyChancePct?: number;
      explorationDepletionPerAttemptPct?: number;
      explorationDurationTurns?: number;
      explorationRollsPerExpedition?: number;
    };
    markets?: {
      countryMarketByCountryId?: Record<string, string>;
      sanctionsById?: Record<
        string,
        {
          id?: string;
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
        }
      >;
    };
    colonization?: { maxActiveColonizations?: number; pointsPerTurn?: number; pointsCostPer1000Km2?: number; ducatsCostPer1000Km2?: number };
    customization?: { renameDucats?: number; recolorDucats?: number; flagDucats?: number; crestDucats?: number; provinceRenameDucats?: number };
    registration?: { requireAdminApproval?: boolean };
    eventLog?: { retentionTurns?: number };
    turnTimer?: { enabled?: boolean; secondsPerTurn?: number; pauseWhenNoPlayersOnline?: boolean };
    map?: { showAntarctica?: boolean; backgroundImageUrl?: string | null };
  },
): Promise<GameSettings> {
  const response = await fetch(`${API}/admin/game-settings`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error ?? "GAME_SETTINGS_UPDATE_FAILED");
  }

  const data = (await response.json()) as GameSettings;
  return {
    ...data,
    map: normalizeMapSettings(data.map),
    resourceIcons: normalizeResourceIcons(data.resourceIcons),
  };
}

export type ScenarioDescriptor = {
  id: string;
  name: string;
  description: string | null;
  startTurn: number;
  startDate: string | null;
  active: boolean;
  map: {
    root: string;
    hasVectorTiles: boolean;
    hasRasterTiles: boolean;
    hasProvinces: boolean;
  };
  contentFiles: string[];
  setupFiles: string[];
};

export async function fetchAdminScenarios(token: string): Promise<{ activeScenarioId: string; scenarios: ScenarioDescriptor[] }> {
  const response = await fetch(`${API}/admin/scenarios`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error ?? "SCENARIOS_FETCH_FAILED");
  }
  return (await response.json()) as { activeScenarioId: string; scenarios: ScenarioDescriptor[] };
}

export async function applyAdminScenario(
  token: string,
  scenarioId: string,
): Promise<{ ok: boolean; activeScenarioId: string; scenarioName: string; turnId: number; worldStateVersion: number; reloadRequired: boolean }> {
  const response = await fetch(`${API}/admin/scenarios/${encodeURIComponent(scenarioId)}/apply`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error ?? "SCENARIO_APPLY_FAILED");
  }
  return (await response.json()) as {
    ok: boolean;
    activeScenarioId: string;
    scenarioName: string;
    turnId: number;
    worldStateVersion: number;
    reloadRequired: boolean;
  };
}

export async function demolishCountryBuild(
  token: string,
  payload: { regionId: string; buildingId: string; instanceId?: string },
): Promise<{
  ok: boolean;
  regionId: string;
  buildingId: string;
  removedInstanceId: string;
  removedLevels: number;
  previousCount: number;
  newCount: number;
  demolitionCostConstruction: number;
  demolitionPercent: number;
  constructionLeft: number;
}> {
  const response = await fetch(`${API}/country/build/demolish`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error ?? "BUILD_DEMOLISH_FAILED");
  }
  return (await response.json()) as {
    ok: boolean;
    regionId: string;
    buildingId: string;
    removedInstanceId: string;
    removedLevels: number;
    previousCount: number;
    newCount: number;
    demolitionCostConstruction: number;
    demolitionPercent: number;
    constructionLeft: number;
  };
}

export async function upgradeCountryBuildState(
  token: string,
  payload: { regionId: string; buildingId: string; instanceId?: string },
): Promise<{
  ok: boolean;
  regionId: string;
  buildingId: string;
  instanceId: string;
  queueId: string;
  currentLevel: number;
  targetLevel: number;
  maxLevel: number;
  upgradeCostConstruction: number;
  upgradeCostDucats: number;
}> {
  const response = await fetch(`${API}/country/build/upgrade-state`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error ?? "BUILD_UPGRADE_STATE_FAILED");
  }
  return (await response.json()) as {
    ok: boolean;
    regionId: string;
    buildingId: string;
    instanceId: string;
    queueId: string;
    currentLevel: number;
    targetLevel: number;
    maxLevel: number;
    upgradeCostConstruction: number;
    upgradeCostDucats: number;
  };
}

export async function setCountryBuildAutoUpgradeState(
  token: string,
  payload: { regionId: string; buildingId: string; instanceId?: string; enabled: boolean },
): Promise<{
  ok: boolean;
  regionId: string;
  buildingId: string;
  instanceId: string;
  autoUpgradeEnabled: boolean;
}> {
  const response = await fetch(`${API}/country/build/auto-upgrade-state`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error ?? "BUILD_AUTO_UPGRADE_STATE_FAILED");
  }
  return (await response.json()) as {
    ok: boolean;
    regionId: string;
    buildingId: string;
    instanceId: string;
    autoUpgradeEnabled: boolean;
  };
}

export async function setCountryBuildSubsidyState(
  token: string,
  payload: { regionId: string; buildingId: string; instanceId?: string; enabled: boolean },
): Promise<{
  ok: boolean;
  regionId: string;
  buildingId: string;
  instanceId: string;
  stateSubsidiesEnabled: boolean;
}> {
  const response = await fetch(`${API}/country/build/subsidy-state`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error ?? "BUILD_SUBSIDY_STATE_FAILED");
  }
  return (await response.json()) as {
    ok: boolean;
    regionId: string;
    buildingId: string;
    instanceId: string;
    stateSubsidiesEnabled: boolean;
  };
}

export async function setCountryBuildManualWorkState(
  token: string,
  payload: { regionId: string; buildingId: string; instanceId?: string; enabled: boolean },
): Promise<{
  ok: boolean;
  regionId: string;
  buildingId: string;
  instanceId: string;
  manualWorkEnabled: boolean;
}> {
  const response = await fetch(`${API}/country/build/manual-work-state`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error ?? "BUILD_MANUAL_WORK_STATE_FAILED");
  }
  return (await response.json()) as {
    ok: boolean;
    regionId: string;
    buildingId: string;
    instanceId: string;
    manualWorkEnabled: boolean;
  };
}

export async function setCountryBuildCustomName(
  token: string,
  payload: { regionId: string; buildingId: string; instanceId?: string; customName: string | null },
): Promise<{
  ok: boolean;
  regionId: string;
  buildingId: string;
  instanceId: string;
  customName: string | null;
}> {
  const response = await fetch(`${API}/country/build/custom-name`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error ?? "BUILD_CUSTOM_NAME_FAILED");
  }
  return (await response.json()) as {
    ok: boolean;
    regionId: string;
    buildingId: string;
    instanceId: string;
    customName: string | null;
  };
}

export async function adminReviewRegistration(
  token: string,
  countryId: string,
  approve: boolean,
): Promise<{ ok: true; approved: boolean; country?: Country; countryId?: string }> {
  const response = await fetch(`${API}/admin/registrations/${countryId}/review`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ approve }),
  });
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error ?? "REGISTRATION_REVIEW_FAILED");
  }
  const data = (await response.json()) as { ok: true; approved: boolean; country?: Country; countryId?: string };
  return {
    ...data,
    country: data.country ? normalizeCountry(data.country) : undefined,
  };
}

export async function adminBroadcastUiNotification(
  token: string,
  payload: {
    category: "system" | "politics" | "economy";
    title: string;
    message: string;
  },
): Promise<void> {
  const response = await fetch(`${API}/admin/ui-notifications`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error ?? "ADMIN_UI_NOTIFICATION_FAILED");
  }
}

export async function adminUploadResourceIcons(
  token: string,
  files: Partial<Record<keyof ResourceIconsMap, File | null>>,
): Promise<{ resourceIcons: ResourceIconsMap }> {
  const formData = new FormData();
  (Object.entries(files) as Array<[keyof ResourceIconsMap, File | null | undefined]>).forEach(([key, file]) => {
    if (file) {
      formData.set(key, file);
    }
  });

  const response = await fetch(`${API}/admin/resource-icons`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error ?? "RESOURCE_ICONS_UPDATE_FAILED");
  }

  const data = (await response.json()) as { resourceIcons: ResourceIconsMap };
  return {
    resourceIcons: normalizeResourceIcons(data.resourceIcons),
  };
}

export async function adminUploadUiBackground(token: string, file: File): Promise<{ map: GameSettings["map"] }> {
  const formData = new FormData();
  formData.set("uiBackground", file);

  const response = await fetch(`${API}/admin/ui-background`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error ?? "UI_BACKGROUND_UPDATE_FAILED");
  }
  const data = (await response.json()) as { map: GameSettings["map"] };
  return { map: normalizeMapSettings(data.map) };
}

export async function updateOwnCountryCustomization(
  token: string,
  payload: {
    countryName?: string;
    countryColor?: string;
    flagFile?: File | null;
    crestFile?: File | null;
  },
): Promise<{ country: Country; chargedDucats: number; resources: { ducats: number } }> {
  const formData = new FormData();
  if (payload.countryName != null) {
    formData.set("countryName", payload.countryName);
  }
  if (payload.countryColor != null) {
    formData.set("countryColor", payload.countryColor);
  }
  if (payload.flagFile) {
    formData.set("flag", payload.flagFile);
  }
  if (payload.crestFile) {
    formData.set("crest", payload.crestFile);
  }

  const response = await fetch(`${API}/country/customization`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error ?? "COUNTRY_CUSTOMIZATION_FAILED");
  }

  const data = (await response.json()) as { country: Country; chargedDucats: number; resources: { ducats: number } };
  return {
    ...data,
    country: normalizeCountry(data.country),
  };
}

export type AdminProvinceItem = {
  id: string;
  name: string;
  regionId?: string;
  provinceColor?: string;
  regionColor?: string;
  areaKm2: number;
  provinceType?: string | null;
  climate?: string | null;
  landscape?: string | null;
  ownerCountryId: string | null;
};

export type AdminRegionItem = {
  id: string;
  ownerCountryId: string | null;
  controllerCountryId: string | null;
  colonizationCost: number;
  colonizationDisabled: boolean;
  manualCost?: boolean;
  colonyProgressByCountry: Record<string, number>;
  population?: RegionPopulation | null;
};

export type AdminPopulationScope = "region" | "country" | "world";
export type AdminPopulationStrategy = "random" | "custom";

export async function startCountryColonization(token: string, regionId: string): Promise<void> {
  const response = await fetch(`${API}/country/colonization/start`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ regionId }),
  });
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error ?? "COLONIZATION_START_FAILED");
  }
}

export async function cancelCountryColonization(token: string, regionId: string): Promise<void> {
  const response = await fetch(`${API}/country/colonization/cancel`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ regionId }),
  });
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error ?? "COLONIZATION_CANCEL_FAILED");
  }
}

export async function startCountryExploration(token: string, regionId: string): Promise<void> {
  const response = await fetch(`${API}/country/exploration/start`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ regionId }),
  });
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error ?? "EXPLORATION_START_FAILED");
  }
}

export async function cancelCountryBuild(
  token: string,
  payload: { regionId?: string; queueId?: string; orderId?: string },
): Promise<{ canceledQueuedProject: boolean; canceledPendingOrder: boolean }> {
  const response = await fetch(`${API}/country/build/cancel`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error ?? "BUILD_CANCEL_FAILED");
  }
  return (await response.json()) as { canceledQueuedProject: boolean; canceledPendingOrder: boolean };
}

export async function renameOwnedProvince(
  token: string,
  payload: { provinceId: string; provinceName: string },
): Promise<{ provinceId: string; provinceName: string; chargedDucats: number; resources: { ducats: number } }> {
  const response = await fetch(`${API}/country/province-rename`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error ?? "PROVINCE_RENAME_FAILED");
  }
  return (await response.json()) as { provinceId: string; provinceName: string; chargedDucats: number; resources: { ducats: number } };
}

export async function fetchAdminProvinces(token: string): Promise<AdminProvinceItem[]> {
  const response = await fetch(`${API}/admin/provinces`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error ?? "ADMIN_PROVINCES_FAILED");
  }
  const data = (await response.json()) as { provinces: AdminProvinceItem[] };
  return data.provinces;
}

export async function fetchAdminRegions(token: string): Promise<AdminRegionItem[]> {
  const response = await fetch(`${API}/admin/regions`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error ?? "ADMIN_REGIONS_FAILED");
  }
  const data = (await response.json()) as { regions: AdminRegionItem[] };
  return data.regions;
}

export async function adminUpdateRegion(
  token: string,
  regionId: string,
  payload: {
    colonizationCost?: number;
    colonizationDisabled?: boolean;
    ownerCountryId?: string | null;
    resetColonizationCostToAuto?: boolean;
  },
): Promise<AdminRegionItem> {
  const response = await fetch(`${API}/admin/regions/${encodeURIComponent(regionId)}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error ?? "ADMIN_REGION_UPDATE_FAILED");
  }
  const data = (await response.json()) as { region: AdminRegionItem };
  return data.region;
}

export async function adminResetRegionColonizationCostToAuto(token: string, regionId: string): Promise<AdminRegionItem> {
  return adminUpdateRegion(token, regionId, { resetColonizationCostToAuto: true });
}

export async function adminRecalculateAutoRegionCosts(token: string): Promise<{ updatedCount: number }> {
  const response = await fetch(`${API}/admin/regions/recalculate-auto-costs`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error ?? "ADMIN_RECALCULATE_AUTO_REGION_COSTS_FAILED");
  }
  const data = (await response.json()) as { ok: true; updatedCount: number };
  return { updatedCount: data.updatedCount };
}

export async function adminGeneratePopulation(
  token: string,
  payload: {
    scope: AdminPopulationScope;
    regionId?: string;
    countryId?: string;
    strategy: AdminPopulationStrategy;
    populationTotal?: number;
    pops?: PopulationPop[];
  },
): Promise<{ ok: true; updatedCount: number; scope: AdminPopulationScope; strategy: AdminPopulationStrategy }> {
  const response = await fetch(`${API}/admin/population/generate`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error ?? "ADMIN_POPULATION_GENERATE_FAILED");
  }
  return (await response.json()) as { ok: true; updatedCount: number; scope: AdminPopulationScope; strategy: AdminPopulationStrategy };
}

export async function adminClearPopulation(
  token: string,
  payload: { scope: AdminPopulationScope; regionId?: string; countryId?: string },
): Promise<{ ok: true; updatedCount: number; scope: AdminPopulationScope }> {
  const response = await fetch(`${API}/admin/population/clear`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error ?? "ADMIN_POPULATION_CLEAR_FAILED");
  }
  return (await response.json()) as { ok: true; updatedCount: number; scope: AdminPopulationScope };
}

export async function adminUpdateRegionPopulation(
  token: string,
  regionId: string,
  payload: { pops: PopulationPop[] },
): Promise<{ id: string; population: RegionPopulation | null }> {
  const response = await fetch(`${API}/admin/population/regions/${encodeURIComponent(regionId)}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error ?? "ADMIN_POPULATION_UPDATE_FAILED");
  }
  const data = (await response.json()) as { region: { id: string; population: RegionPopulation | null } };
  return data.region;
}
