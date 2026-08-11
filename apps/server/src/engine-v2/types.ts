export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
export type JsonObject = { [key: string]: JsonValue };

export type DeepReadonly<T> = T extends JsonPrimitive
  ? T
  : T extends readonly (infer U)[]
    ? readonly DeepReadonly<U>[]
    : T extends object
      ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
      : T;

export type CountryId = string;
export type RegionId = string;
export type ProvinceId = string;
export type PopId = string;
export type UnitId = string;
export type MarketId = string;
export type BuildingId = string;
export type GoodId = string;
export type PopTypeId = string;
export type UnitTypeId = string;
export type BuildingTypeId = string;
export type TechnologyId = string;
export type CultureId = string;
export type ReligionId = string;
export type GovernmentId = string;
export type IsoDate = string;

export type GameDefines = {
  daysPerTurn: number;
  maxQueuedCommands: number;
  maxQueuedCommandsPerCountry: number;
  commandHistoryLimit: number;
};

export type GoodDefinition = {
  id: GoodId;
  nameKey: string;
  categoryId: string;
  basePrice: number;
  color?: string;
  tags?: string[];
};

export type PopTypeDefinition = {
  id: PopTypeId;
  nameKey: string;
  strata: "poor" | "middle" | "rich";
  promotesTo?: PopTypeId[];
  demotesTo?: PopTypeId[];
  needs: Partial<Record<GoodId, number>>;
  tags?: string[];
};

export type UnitTypeDefinitionV2 = {
  id: UnitTypeId;
  nameKey: string;
  domain: "land" | "naval" | "air";
  attack: number;
  defense: number;
  speed: number;
  supplyUse: number;
  tags?: string[];
};

export type BuildingTypeDefinition = {
  id: BuildingTypeId;
  nameKey: string;
  maxLevel: number;
  workforce: Partial<Record<PopTypeId, number>>;
  inputGoods: Partial<Record<GoodId, number>>;
  outputGoods: Partial<Record<GoodId, number>>;
  tags?: string[];
};

export type TechnologyDefinition = {
  id: TechnologyId;
  nameKey: string;
  cost: number;
  prerequisites?: TechnologyId[];
  unlocks?: string[];
  modifiers?: Array<{
    stat: string;
    operation: "add" | "multiply" | "set";
    value: number;
  }>;
};

export type CountryHistory = {
  id: CountryId;
  tag: string;
  nameKey: string;
  color: string;
  capitalProvinceId: ProvinceId;
  marketId: MarketId;
  treasury: number;
  taxRate: number;
  baseTaxIncome: number;
  primaryCultureId: CultureId;
  acceptedCultureIds?: CultureId[];
  governmentId: GovernmentId;
  technologyIds?: TechnologyId[];
  flags?: Record<string, boolean>;
};

export type RegionHistory = {
  id: RegionId;
  nameKey: string;
  capitalProvinceId?: ProvinceId | null;
  tags?: string[];
};

export type ProvinceHistory = {
  id: ProvinceId;
  legacyId?: number;
  nameKey: string;
  regionId: RegionId;
  terrainId: string;
  ownerCountryId: CountryId | null;
  controllerCountryId?: CountryId | null;
  neighborProvinceIds?: ProvinceId[];
  coastal?: boolean;
  infrastructure?: number;
  tags?: string[];
};

export type PopHistory = {
  id: PopId;
  provinceId: ProvinceId;
  countryId: CountryId;
  typeId: PopTypeId;
  cultureId: CultureId;
  religionId: ReligionId;
  size: number;
  cash?: number;
  literacy?: number;
  consciousness?: number;
  militancy?: number;
  needsSatisfaction?: number;
  employmentBuildingId?: BuildingId | null;
};

export type UnitHistory = {
  id: UnitId;
  ownerCountryId: CountryId;
  typeId: UnitTypeId;
  provinceId: ProvinceId;
  strength?: number;
  organization?: number;
  experience?: number;
};

export type MarketHistory = {
  id: MarketId;
  memberCountryIds: CountryId[];
  stockpile?: Partial<Record<GoodId, number>>;
  prices?: Partial<Record<GoodId, number>>;
};

export type BuildingHistory = {
  id: BuildingId;
  provinceId: ProvinceId;
  ownerCountryId: CountryId;
  typeId: BuildingTypeId;
  level?: number;
  workforce?: number;
  cashReserve?: number;
};

export type ScenarioManifest = {
  schemaVersion: 2;
  engineVersion: "2";
  id: string;
  name: string;
  startDate: IsoDate;
  seed: number | string;
  defines: GameDefines;
};

export type ScenarioBundle = {
  manifest: ScenarioManifest;
  common: {
    goods: GoodDefinition[];
    popTypes: PopTypeDefinition[];
    unitTypes: UnitTypeDefinitionV2[];
    buildingTypes: BuildingTypeDefinition[];
    technologies: TechnologyDefinition[];
  };
  history: {
    countries: CountryHistory[];
    regions: RegionHistory[];
    provinces: ProvinceHistory[];
    pops: PopHistory[];
    units: UnitHistory[];
    markets: MarketHistory[];
    buildings: BuildingHistory[];
  };
  localisation?: Record<string, Record<string, string>>;
};

export type CountryState = CountryHistory & {
  acceptedCultureIds: CultureId[];
  technologyIds: TechnologyId[];
  flags: Record<string, boolean>;
};

export type RegionState = RegionHistory & {
  capitalProvinceId: ProvinceId | null;
  provinceIds: ProvinceId[];
  tags: string[];
};

export type ProvinceState = ProvinceHistory & {
  controllerCountryId: CountryId | null;
  neighborProvinceIds: ProvinceId[];
  coastal: boolean;
  infrastructure: number;
  tags: string[];
};

export type PopState = PopHistory & {
  cash: number;
  literacy: number;
  consciousness: number;
  militancy: number;
  needsSatisfaction: number;
  employmentBuildingId: BuildingId | null;
};

export type UnitState = UnitHistory & {
  strength: number;
  organization: number;
  experience: number;
};

export type MarketState = MarketHistory & {
  stockpile: Partial<Record<GoodId, number>>;
  prices: Partial<Record<GoodId, number>>;
};

export type BuildingState = BuildingHistory & {
  level: number;
  workforce: number;
  cashReserve: number;
};

export type WorldMeta = {
  schemaVersion: 2;
  engineVersion: "2";
  scenarioId: string;
  scenarioName: string;
  date: IsoDate;
  turn: number;
  version: number;
  rngState: number;
  defines: GameDefines;
};

export type WorldDefinitions = {
  goods: Record<GoodId, GoodDefinition>;
  popTypes: Record<PopTypeId, PopTypeDefinition>;
  unitTypes: Record<UnitTypeId, UnitTypeDefinitionV2>;
  buildingTypes: Record<BuildingTypeId, BuildingTypeDefinition>;
  technologies: Record<TechnologyId, TechnologyDefinition>;
};

export type WorldTables = {
  countries: Record<CountryId, CountryState>;
  regions: Record<RegionId, RegionState>;
  provinces: Record<ProvinceId, ProvinceState>;
  pops: Record<PopId, PopState>;
  units: Record<UnitId, UnitState>;
  markets: Record<MarketId, MarketState>;
  buildings: Record<BuildingId, BuildingState>;
};

export type WorldState = {
  meta: WorldMeta;
  definitions: WorldDefinitions;
  tables: WorldTables;
};

export type EntityTableName = keyof WorldTables;
export type EntityFor<K extends EntityTableName> = WorldTables[K] extends Record<string, infer T>
  ? T
  : never;

export type EngineEventAudience =
  | { type: "public" }
  | { type: "country"; countryId: CountryId }
  | { type: "admin" };

export type EngineEventInput = {
  type: string;
  payload: JsonObject;
  audience?: EngineEventAudience;
};

export type EngineEvent = EngineEventInput & {
  id: string;
  turn: number;
  date: IsoDate;
  audience: EngineEventAudience;
};

export type WorldTableChanges = Partial<{
  [K in EntityTableName]: Record<string, EntityFor<K> | null>;
}>;

export type WorldDelta = {
  scenarioId: string;
  fromVersion: number;
  toVersion: number;
  resolvedTurn: number;
  date: IsoDate;
  meta: Partial<WorldMeta>;
  tables: WorldTableChanges;
  events: EngineEvent[];
  resolvedCommandIds: string[];
  rejectedCommands: Array<{
    commandId: string;
    code: string;
    message: string;
  }>;
};

export type EngineCommandEnvelope<TPayload extends JsonObject = JsonObject> = {
  id: string;
  kind: string;
  actorCountryId: CountryId | null;
  expectedVersion: number;
  payload: TPayload;
};

export type CommandValidationIssue = {
  code: string;
  message: string;
  path?: string;
};

export type CommandSubmissionResult =
  | {
      status: "accepted";
      commandId: string;
      queuePosition: number;
      worldVersion: number;
    }
  | {
      status: "rejected";
      commandId: string;
      code: string;
      message: string;
      worldVersion: number;
    };

export type ScenarioValidationIssue = {
  code: string;
  path: string;
  message: string;
};

export const SYSTEM_PHASES = [
  "orders",
  "military",
  "construction",
  "production",
  "market",
  "population",
  "politics",
  "technology",
  "diplomacy",
  "events",
  "ai",
  "finalize",
] as const;

export type SystemPhase = (typeof SYSTEM_PHASES)[number];
