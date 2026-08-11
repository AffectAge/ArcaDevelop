import {
  SYSTEM_PHASES,
  type CommandSubmissionResult,
  type CommandValidationIssue,
  type DeepReadonly,
  type EngineCommandEnvelope,
  type EngineEvent,
  type EngineEventInput,
  type EntityFor,
  type EntityTableName,
  type JsonObject,
  type ScenarioBundle,
  type ScenarioValidationIssue,
  type SystemPhase,
  type WorldDelta,
  type WorldMeta,
  type WorldState,
  type WorldTableChanges,
} from "./types";

const ENTITY_ID_PATTERN = /^[a-z0-9][a-z0-9._:-]*$/i;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export class ScenarioCompilationError extends Error {
  readonly issues: ScenarioValidationIssue[];

  constructor(issues: ScenarioValidationIssue[]) {
    super(`Scenario compilation failed with ${issues.length} issue(s).`);
    this.name = "ScenarioCompilationError";
    this.issues = issues;
  }
}

export class TurnResolutionInProgressError extends Error {
  constructor() {
    super("A turn is already being resolved for this game session.");
    this.name = "TurnResolutionInProgressError";
  }
}

export type CommandValidationContext = {
  world: DeepReadonly<WorldState>;
};

export type CommandExecutionContext = {
  world: DeepReadonly<WorldState>;
  writer: WorldWriter;
  emit: (event: EngineEventInput) => void;
};

export type CommandHandler<TPayload extends JsonObject = JsonObject> = {
  kind: string;
  order?: number;
  validate: (
    context: CommandValidationContext,
    command: EngineCommandEnvelope<TPayload>,
  ) => CommandValidationIssue[];
  execute: (
    context: CommandExecutionContext,
    command: EngineCommandEnvelope<TPayload>,
  ) => void | Promise<void>;
};

export type TurnSystemContext = {
  world: DeepReadonly<WorldState>;
  writer: WorldWriter;
  random: DeterministicRandom;
  resolvingTurn: number;
  resolvingDate: string;
  emit: (event: EngineEventInput) => void;
};

export type TurnSystem = {
  id: string;
  phase: SystemPhase;
  order?: number;
  run: (context: TurnSystemContext) => void | Promise<void>;
};

export type GameSessionOptions = {
  commandHandlers?: CommandHandler<any>[];
  systems?: TurnSystem[];
};

type QueuedCommand = {
  sequence: number;
  command: EngineCommandEnvelope;
};

type MutableWorldTable<K extends EntityTableName> = Record<string, EntityFor<K>>;

function clonePlain<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => clonePlain(item)) as T;
  }
  if (value !== null && typeof value === "object") {
    const output: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      output[key] = clonePlain(item);
    }
    return output as T;
  }
  return value;
}

function isValidIsoDate(value: string): boolean {
  if (!ISO_DATE_PATTERN.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function addUtcDays(value: string, days: number): string {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

function stableSeedToUint32(seed: number | string): number {
  if (typeof seed === "number" && Number.isFinite(seed)) {
    const normalized = Math.trunc(seed) >>> 0;
    return normalized === 0 ? 0x6d2b79f5 : normalized;
  }

  let hash = 0x811c9dc5;
  for (const character of String(seed)) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash === 0 ? 0x6d2b79f5 : hash;
}

function assertPositiveInteger(
  issues: ScenarioValidationIssue[],
  path: string,
  value: number,
): void {
  if (!Number.isInteger(value) || value <= 0) {
    issues.push({
      code: "INVALID_POSITIVE_INTEGER",
      path,
      message: `${path} must be a positive integer.`,
    });
  }
}

function indexById<T extends { id: string }>(
  values: readonly T[],
  path: string,
  issues: ScenarioValidationIssue[],
): Record<string, T> {
  const result: Record<string, T> = {};
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    const itemPath = `${path}[${index}]`;
    if (!ENTITY_ID_PATTERN.test(value.id)) {
      issues.push({
        code: "INVALID_ID",
        path: `${itemPath}.id`,
        message: `Invalid data id: ${value.id}`,
      });
      continue;
    }
    if (result[value.id]) {
      issues.push({
        code: "DUPLICATE_ID",
        path: `${itemPath}.id`,
        message: `Duplicate id ${value.id} in ${path}.`,
      });
      continue;
    }
    result[value.id] = clonePlain(value);
  }
  return result;
}

function requireReference(
  issues: ScenarioValidationIssue[],
  path: string,
  id: string | null | undefined,
  table: Record<string, unknown>,
  targetName: string,
): void {
  if (id === null || id === undefined) return;
  if (!table[id]) {
    issues.push({
      code: "MISSING_REFERENCE",
      path,
      message: `${path} references unknown ${targetName} ${id}.`,
    });
  }
}

function assertFiniteRange(
  issues: ScenarioValidationIssue[],
  path: string,
  value: number,
  min: number,
  max: number,
): void {
  if (!Number.isFinite(value) || value < min || value > max) {
    issues.push({
      code: "OUT_OF_RANGE",
      path,
      message: `${path} must be between ${min} and ${max}.`,
    });
  }
}

export function compileScenario(bundle: ScenarioBundle): WorldState {
  const issues: ScenarioValidationIssue[] = [];
  const { manifest, common, history } = bundle;

  if (manifest.schemaVersion !== 2 || manifest.engineVersion !== "2") {
    issues.push({
      code: "UNSUPPORTED_SCHEMA_VERSION",
      path: "manifest.schemaVersion",
      message: "Engine v2 accepts scenario schemaVersion 2 and engineVersion 2.",
    });
  }
  if (!ENTITY_ID_PATTERN.test(manifest.id)) {
    issues.push({
      code: "INVALID_ID",
      path: "manifest.id",
      message: `Invalid scenario id: ${manifest.id}`,
    });
  }
  if (!isValidIsoDate(manifest.startDate)) {
    issues.push({
      code: "INVALID_DATE",
      path: "manifest.startDate",
      message: `Invalid scenario start date: ${manifest.startDate}`,
    });
  }
  assertPositiveInteger(issues, "manifest.defines.daysPerTurn", manifest.defines.daysPerTurn);
  assertPositiveInteger(
    issues,
    "manifest.defines.maxQueuedCommands",
    manifest.defines.maxQueuedCommands,
  );
  assertPositiveInteger(
    issues,
    "manifest.defines.maxQueuedCommandsPerCountry",
    manifest.defines.maxQueuedCommandsPerCountry,
  );
  assertPositiveInteger(
    issues,
    "manifest.defines.commandHistoryLimit",
    manifest.defines.commandHistoryLimit,
  );

  const goods = indexById(common.goods, "common.goods", issues);
  const popTypes = indexById(common.popTypes, "common.popTypes", issues);
  const unitTypes = indexById(common.unitTypes, "common.unitTypes", issues);
  const buildingTypes = indexById(common.buildingTypes, "common.buildingTypes", issues);
  const technologies = indexById(common.technologies, "common.technologies", issues);

  for (const [id, definition] of Object.entries(popTypes)) {
    for (const goodId of Object.keys(definition.needs)) {
      requireReference(issues, `common.popTypes.${id}.needs.${goodId}`, goodId, goods, "good");
    }
    for (const targetId of [...(definition.promotesTo ?? []), ...(definition.demotesTo ?? [])]) {
      requireReference(issues, `common.popTypes.${id}`, targetId, popTypes, "pop type");
    }
  }
  for (const [id, definition] of Object.entries(buildingTypes)) {
    for (const goodId of [
      ...Object.keys(definition.inputGoods),
      ...Object.keys(definition.outputGoods),
    ]) {
      requireReference(issues, `common.buildingTypes.${id}`, goodId, goods, "good");
    }
    for (const popTypeId of Object.keys(definition.workforce)) {
      requireReference(
        issues,
        `common.buildingTypes.${id}.workforce.${popTypeId}`,
        popTypeId,
        popTypes,
        "pop type",
      );
    }
  }
  for (const [id, definition] of Object.entries(technologies)) {
    for (const prerequisiteId of definition.prerequisites ?? []) {
      requireReference(
        issues,
        `common.technologies.${id}.prerequisites`,
        prerequisiteId,
        technologies,
        "technology",
      );
    }
  }

  const countries = indexById(history.countries, "history.countries", issues);
  const regions = indexById(history.regions, "history.regions", issues);
  const provinces = indexById(history.provinces, "history.provinces", issues);
  const pops = indexById(history.pops, "history.pops", issues);
  const units = indexById(history.units, "history.units", issues);
  const markets = indexById(history.markets, "history.markets", issues);
  const buildings = indexById(history.buildings, "history.buildings", issues);

  for (const [countryId, country] of Object.entries(countries)) {
    requireReference(
      issues,
      `history.countries.${countryId}.capitalProvinceId`,
      country.capitalProvinceId,
      provinces,
      "province",
    );
    requireReference(
      issues,
      `history.countries.${countryId}.marketId`,
      country.marketId,
      markets,
      "market",
    );
    assertFiniteRange(issues, `history.countries.${countryId}.taxRate`, country.taxRate, 0, 1);
    if (!Number.isFinite(country.treasury)) {
      issues.push({
        code: "INVALID_NUMBER",
        path: `history.countries.${countryId}.treasury`,
        message: "Country treasury must be finite.",
      });
    }
    for (const technologyId of country.technologyIds ?? []) {
      requireReference(
        issues,
        `history.countries.${countryId}.technologyIds`,
        technologyId,
        technologies,
        "technology",
      );
    }
  }

  const provinceIdsByRegion = new Map<string, string[]>();
  for (const [provinceId, province] of Object.entries(provinces)) {
    requireReference(
      issues,
      `history.provinces.${provinceId}.regionId`,
      province.regionId,
      regions,
      "region",
    );
    requireReference(
      issues,
      `history.provinces.${provinceId}.ownerCountryId`,
      province.ownerCountryId,
      countries,
      "country",
    );
    requireReference(
      issues,
      `history.provinces.${provinceId}.controllerCountryId`,
      province.controllerCountryId,
      countries,
      "country",
    );
    const regionProvinceIds = provinceIdsByRegion.get(province.regionId) ?? [];
    regionProvinceIds.push(provinceId);
    provinceIdsByRegion.set(province.regionId, regionProvinceIds);

    for (const neighborId of province.neighborProvinceIds ?? []) {
      requireReference(
        issues,
        `history.provinces.${provinceId}.neighborProvinceIds`,
        neighborId,
        provinces,
        "province",
      );
      if (neighborId === provinceId) {
        issues.push({
          code: "SELF_REFERENCE",
          path: `history.provinces.${provinceId}.neighborProvinceIds`,
          message: `Province ${provinceId} cannot be adjacent to itself.`,
        });
      }
    }
  }

  for (const [regionId, region] of Object.entries(regions)) {
    requireReference(
      issues,
      `history.regions.${regionId}.capitalProvinceId`,
      region.capitalProvinceId,
      provinces,
      "province",
    );
    if (region.capitalProvinceId && provinces[region.capitalProvinceId]?.regionId !== regionId) {
      issues.push({
        code: "INVALID_REGION_CAPITAL",
        path: `history.regions.${regionId}.capitalProvinceId`,
        message: `Region capital ${region.capitalProvinceId} is not inside region ${regionId}.`,
      });
    }
  }

  for (const [popId, pop] of Object.entries(pops)) {
    requireReference(issues, `history.pops.${popId}.provinceId`, pop.provinceId, provinces, "province");
    requireReference(issues, `history.pops.${popId}.countryId`, pop.countryId, countries, "country");
    requireReference(issues, `history.pops.${popId}.typeId`, pop.typeId, popTypes, "pop type");
    requireReference(
      issues,
      `history.pops.${popId}.employmentBuildingId`,
      pop.employmentBuildingId,
      buildings,
      "building",
    );
    assertFiniteRange(issues, `history.pops.${popId}.literacy`, pop.literacy ?? 0, 0, 1);
    assertFiniteRange(
      issues,
      `history.pops.${popId}.consciousness`,
      pop.consciousness ?? 0,
      0,
      10,
    );
    assertFiniteRange(issues, `history.pops.${popId}.militancy`, pop.militancy ?? 0, 0, 10);
    if (!Number.isFinite(pop.size) || pop.size <= 0) {
      issues.push({
        code: "INVALID_POP_SIZE",
        path: `history.pops.${popId}.size`,
        message: "Pop size must be a finite positive number.",
      });
    }
  }

  for (const [unitId, unit] of Object.entries(units)) {
    requireReference(
      issues,
      `history.units.${unitId}.ownerCountryId`,
      unit.ownerCountryId,
      countries,
      "country",
    );
    requireReference(issues, `history.units.${unitId}.provinceId`, unit.provinceId, provinces, "province");
    requireReference(issues, `history.units.${unitId}.typeId`, unit.typeId, unitTypes, "unit type");
  }

  for (const [marketId, market] of Object.entries(markets)) {
    for (const countryId of market.memberCountryIds) {
      requireReference(
        issues,
        `history.markets.${marketId}.memberCountryIds`,
        countryId,
        countries,
        "country",
      );
    }
    for (const goodId of [
      ...Object.keys(market.stockpile ?? {}),
      ...Object.keys(market.prices ?? {}),
    ]) {
      requireReference(issues, `history.markets.${marketId}`, goodId, goods, "good");
    }
  }

  for (const [buildingId, building] of Object.entries(buildings)) {
    requireReference(
      issues,
      `history.buildings.${buildingId}.provinceId`,
      building.provinceId,
      provinces,
      "province",
    );
    requireReference(
      issues,
      `history.buildings.${buildingId}.ownerCountryId`,
      building.ownerCountryId,
      countries,
      "country",
    );
    requireReference(
      issues,
      `history.buildings.${buildingId}.typeId`,
      building.typeId,
      buildingTypes,
      "building type",
    );
  }

  if (issues.length > 0) throw new ScenarioCompilationError(issues);

  return {
    meta: {
      schemaVersion: 2,
      engineVersion: "2",
      scenarioId: manifest.id,
      scenarioName: manifest.name,
      date: manifest.startDate,
      turn: 0,
      version: 1,
      rngState: stableSeedToUint32(manifest.seed),
      defines: clonePlain(manifest.defines),
    },
    definitions: {
      goods,
      popTypes,
      unitTypes,
      buildingTypes,
      technologies,
    },
    tables: {
      countries: Object.fromEntries(
        Object.entries(countries).map(([id, country]) => [
          id,
          {
            ...country,
            acceptedCultureIds: [...(country.acceptedCultureIds ?? [])],
            technologyIds: [...(country.technologyIds ?? [])],
            flags: { ...(country.flags ?? {}) },
          },
        ]),
      ),
      regions: Object.fromEntries(
        Object.entries(regions).map(([id, region]) => [
          id,
          {
            ...region,
            capitalProvinceId: region.capitalProvinceId ?? null,
            provinceIds: [...(provinceIdsByRegion.get(id) ?? [])].sort(),
            tags: [...(region.tags ?? [])],
          },
        ]),
      ),
      provinces: Object.fromEntries(
        Object.entries(provinces).map(([id, province]) => [
          id,
          {
            ...province,
            controllerCountryId: province.controllerCountryId ?? province.ownerCountryId,
            neighborProvinceIds: [...new Set(province.neighborProvinceIds ?? [])].sort(),
            coastal: province.coastal ?? false,
            infrastructure: province.infrastructure ?? 0,
            tags: [...(province.tags ?? [])],
          },
        ]),
      ),
      pops: Object.fromEntries(
        Object.entries(pops).map(([id, pop]) => [
          id,
          {
            ...pop,
            cash: pop.cash ?? 0,
            literacy: pop.literacy ?? 0,
            consciousness: pop.consciousness ?? 0,
            militancy: pop.militancy ?? 0,
            needsSatisfaction: pop.needsSatisfaction ?? 0,
            employmentBuildingId: pop.employmentBuildingId ?? null,
          },
        ]),
      ),
      units: Object.fromEntries(
        Object.entries(units).map(([id, unit]) => [
          id,
          {
            ...unit,
            strength: unit.strength ?? 1,
            organization: unit.organization ?? 1,
            experience: unit.experience ?? 0,
          },
        ]),
      ),
      markets: Object.fromEntries(
        Object.entries(markets).map(([id, market]) => [
          id,
          {
            ...market,
            memberCountryIds: [...new Set(market.memberCountryIds)].sort(),
            stockpile: { ...(market.stockpile ?? {}) },
            prices: { ...(market.prices ?? {}) },
          },
        ]),
      ),
      buildings: Object.fromEntries(
        Object.entries(buildings).map(([id, building]) => [
          id,
          {
            ...building,
            level: building.level ?? 1,
            workforce: building.workforce ?? 0,
            cashReserve: building.cashReserve ?? 0,
          },
        ]),
      ),
    },
  };
}

export class DeterministicRandom {
  #state: number;

  constructor(state: number) {
    this.#state = (state >>> 0) || 0x6d2b79f5;
  }

  get state(): number {
    return this.#state >>> 0;
  }

  nextUint32(): number {
    let value = this.#state >>> 0;
    value ^= value << 13;
    value ^= value >>> 17;
    value ^= value << 5;
    this.#state = value >>> 0;
    return this.#state;
  }

  next(): number {
    return this.nextUint32() / 0x1_0000_0000;
  }

  integer(minInclusive: number, maxInclusive: number): number {
    if (!Number.isInteger(minInclusive) || !Number.isInteger(maxInclusive)) {
      throw new TypeError("Random integer bounds must be integers.");
    }
    if (maxInclusive < minInclusive) {
      throw new RangeError("Random integer maximum cannot be lower than minimum.");
    }
    const span = maxInclusive - minInclusive + 1;
    return minInclusive + Math.floor(this.next() * span);
  }

  pick<T>(values: readonly T[]): T {
    if (values.length === 0) throw new RangeError("Cannot pick from an empty collection.");
    return values[this.integer(0, values.length - 1)];
  }
}

export class WorldWriter {
  readonly #world: WorldState;
  readonly #metaChanges: Partial<WorldMeta> = {};
  readonly #tableChanges: WorldTableChanges = {};

  constructor(world: WorldState) {
    this.#world = world;
  }

  get world(): DeepReadonly<WorldState> {
    return this.#world as DeepReadonly<WorldState>;
  }

  patchMeta(patch: Partial<WorldMeta>): void {
    Object.assign(this.#world.meta, clonePlain(patch));
    Object.assign(this.#metaChanges, clonePlain(patch));
  }

  get<K extends EntityTableName>(table: K, id: string): DeepReadonly<EntityFor<K>> | null {
    const value = this.#world.tables[table][id] as EntityFor<K> | undefined;
    return value ? (value as DeepReadonly<EntityFor<K>>) : null;
  }

  upsert<K extends EntityTableName>(table: K, id: string, entity: EntityFor<K>): void {
    const cloned = clonePlain(entity);
    const mutableTable = this.#world.tables[table] as MutableWorldTable<K>;
    mutableTable[id] = cloned;
    const changes = (this.#tableChanges[table] ??= {}) as Record<
      string,
      EntityFor<K> | null
    >;
    changes[id] = clonePlain(cloned);
  }

  patch<K extends EntityTableName>(
    table: K,
    id: string,
    patch: Partial<EntityFor<K>>,
  ): EntityFor<K> {
    const current = this.#world.tables[table][id] as EntityFor<K> | undefined;
    if (!current) throw new Error(`Cannot patch missing ${table} entity ${id}.`);
    const next = { ...current, ...clonePlain(patch) } as EntityFor<K>;
    this.upsert(table, id, next);
    return next;
  }

  remove<K extends EntityTableName>(table: K, id: string): boolean {
    const mutableTable = this.#world.tables[table] as MutableWorldTable<K>;
    if (!mutableTable[id]) return false;
    delete mutableTable[id];
    const changes = (this.#tableChanges[table] ??= {}) as Record<
      string,
      EntityFor<K> | null
    >;
    changes[id] = null;
    return true;
  }

  getMetaChanges(): Partial<WorldMeta> {
    return clonePlain(this.#metaChanges);
  }

  getTableChanges(): WorldTableChanges {
    return clonePlain(this.#tableChanges);
  }
}

function phaseIndex(phase: SystemPhase): number {
  return SYSTEM_PHASES.indexOf(phase);
}

function compareSystems(left: TurnSystem, right: TurnSystem): number {
  return (
    phaseIndex(left.phase) - phaseIndex(right.phase) ||
    (left.order ?? 0) - (right.order ?? 0) ||
    left.id.localeCompare(right.id)
  );
}

function rejectedSubmission(
  command: Pick<EngineCommandEnvelope, "id">,
  worldVersion: number,
  code: string,
  message: string,
): CommandSubmissionResult {
  return {
    status: "rejected",
    commandId: command.id,
    code,
    message,
    worldVersion,
  };
}

export class GameSession {
  #world: WorldState;
  readonly #handlers = new Map<string, CommandHandler<any>>();
  readonly #systems: TurnSystem[];
  readonly #queuedCommands: QueuedCommand[] = [];
  readonly #commandHistory = new Map<string, CommandSubmissionResult>();
  #nextCommandSequence = 1;
  #resolving = false;

  constructor(world: WorldState, options: GameSessionOptions = {}) {
    this.#world = clonePlain(world);
    for (const handler of options.commandHandlers ?? []) {
      if (this.#handlers.has(handler.kind)) {
        throw new Error(`Duplicate command handler for ${handler.kind}.`);
      }
      this.#handlers.set(handler.kind, handler);
    }
    const systemIds = new Set<string>();
    for (const system of options.systems ?? []) {
      if (systemIds.has(system.id)) throw new Error(`Duplicate turn system id ${system.id}.`);
      systemIds.add(system.id);
    }
    this.#systems = [...(options.systems ?? [])].sort(compareSystems);
  }

  getSnapshot(): WorldState {
    return clonePlain(this.#world);
  }

  getPendingCommandCount(): number {
    return this.#queuedCommands.length;
  }

  getRegisteredSystemIds(): string[] {
    return this.#systems.map((system) => system.id);
  }

  submitCommand(command: EngineCommandEnvelope): CommandSubmissionResult {
    const cached = this.#commandHistory.get(command.id);
    if (cached) return clonePlain(cached);

    const result = this.#validateSubmission(command);
    if (result) {
      this.#rememberCommandResult(command.id, result);
      return clonePlain(result);
    }

    this.#queuedCommands.push({
      sequence: this.#nextCommandSequence++,
      command: clonePlain(command),
    });
    const accepted: CommandSubmissionResult = {
      status: "accepted",
      commandId: command.id,
      queuePosition: this.#queuedCommands.length,
      worldVersion: this.#world.meta.version,
    };
    this.#rememberCommandResult(command.id, accepted);
    return clonePlain(accepted);
  }

  async resolveTurn(): Promise<WorldDelta> {
    if (this.#resolving) throw new TurnResolutionInProgressError();
    this.#resolving = true;

    try {
      const sourceWorld = this.#world;
      const workingWorld = clonePlain(sourceWorld);
      const writer = new WorldWriter(workingWorld);
      const random = new DeterministicRandom(workingWorld.meta.rngState);
      const resolvingTurn = workingWorld.meta.turn + 1;
      const resolvingDate = addUtcDays(
        workingWorld.meta.date,
        workingWorld.meta.defines.daysPerTurn,
      );
      const eventInputs: EngineEventInput[] = [];
      const emit = (event: EngineEventInput): void => {
        eventInputs.push(clonePlain(event));
      };
      const rejectedCommands: WorldDelta["rejectedCommands"] = [];
      const resolvedCommandIds: string[] = [];
      const pendingCommands = [...this.#queuedCommands].sort((left, right) => {
        const leftHandler = this.#handlers.get(left.command.kind);
        const rightHandler = this.#handlers.get(right.command.kind);
        return (
          (leftHandler?.order ?? 0) - (rightHandler?.order ?? 0) ||
          left.sequence - right.sequence
        );
      });

      for (const queued of pendingCommands) {
        const handler = this.#handlers.get(queued.command.kind);
        if (!handler) {
          rejectedCommands.push({
            commandId: queued.command.id,
            code: "COMMAND_HANDLER_MISSING",
            message: `No command handler is registered for ${queued.command.kind}.`,
          });
          continue;
        }
        const issues = handler.validate({ world: writer.world }, queued.command);
        if (issues.length > 0) {
          const issue = issues[0];
          rejectedCommands.push({
            commandId: queued.command.id,
            code: issue.code,
            message: issue.message,
          });
          continue;
        }
        await handler.execute({ world: writer.world, writer, emit }, queued.command);
        resolvedCommandIds.push(queued.command.id);
      }

      for (const system of this.#systems) {
        await system.run({
          world: writer.world,
          writer,
          random,
          resolvingTurn,
          resolvingDate,
          emit,
        });
      }

      writer.patchMeta({
        turn: resolvingTurn,
        date: resolvingDate,
        rngState: random.state,
        version: sourceWorld.meta.version + 1,
      });

      const events: EngineEvent[] = eventInputs.map((event, index) => ({
        ...event,
        id: `event:${resolvingTurn}:${index + 1}`,
        turn: resolvingTurn,
        date: resolvingDate,
        audience: event.audience ?? { type: "public" },
      }));

      const delta: WorldDelta = {
        scenarioId: workingWorld.meta.scenarioId,
        fromVersion: sourceWorld.meta.version,
        toVersion: workingWorld.meta.version,
        resolvedTurn: resolvingTurn,
        date: resolvingDate,
        meta: writer.getMetaChanges(),
        tables: writer.getTableChanges(),
        events,
        resolvedCommandIds,
        rejectedCommands,
      };

      this.#world = workingWorld;
      this.#queuedCommands.splice(0, pendingCommands.length);
      return clonePlain(delta);
    } finally {
      this.#resolving = false;
    }
  }

  #validateSubmission(command: EngineCommandEnvelope): CommandSubmissionResult | null {
    const worldVersion = this.#world.meta.version;
    if (!ENTITY_ID_PATTERN.test(command.id)) {
      return rejectedSubmission(command, worldVersion, "INVALID_COMMAND_ID", "Invalid command id.");
    }
    if (command.expectedVersion !== worldVersion) {
      return rejectedSubmission(
        command,
        worldVersion,
        "WORLD_VERSION_MISMATCH",
        `Expected world version ${worldVersion}, received ${command.expectedVersion}.`,
      );
    }
    const handler = this.#handlers.get(command.kind);
    if (!handler) {
      return rejectedSubmission(
        command,
        worldVersion,
        "UNKNOWN_COMMAND_KIND",
        `Unknown command kind ${command.kind}.`,
      );
    }
    if (
      command.actorCountryId !== null &&
      !this.#world.tables.countries[command.actorCountryId]
    ) {
      return rejectedSubmission(
        command,
        worldVersion,
        "UNKNOWN_ACTOR_COUNTRY",
        `Unknown actor country ${command.actorCountryId}.`,
      );
    }
    if (this.#queuedCommands.length >= this.#world.meta.defines.maxQueuedCommands) {
      return rejectedSubmission(
        command,
        worldVersion,
        "COMMAND_QUEUE_FULL",
        "The game command queue is full.",
      );
    }
    if (command.actorCountryId !== null) {
      const actorCommandCount = this.#queuedCommands.filter(
        (queued) => queued.command.actorCountryId === command.actorCountryId,
      ).length;
      if (actorCommandCount >= this.#world.meta.defines.maxQueuedCommandsPerCountry) {
        return rejectedSubmission(
          command,
          worldVersion,
          "COUNTRY_COMMAND_QUEUE_FULL",
          `Country ${command.actorCountryId} has reached its command queue limit.`,
        );
      }
    }
    const issues = handler.validate({ world: this.#world as DeepReadonly<WorldState> }, command);
    if (issues.length > 0) {
      return rejectedSubmission(command, worldVersion, issues[0].code, issues[0].message);
    }
    return null;
  }

  #rememberCommandResult(commandId: string, result: CommandSubmissionResult): void {
    this.#commandHistory.set(commandId, clonePlain(result));
    const limit = this.#world.meta.defines.commandHistoryLimit;
    while (this.#commandHistory.size > limit) {
      const oldestKey = this.#commandHistory.keys().next().value as string | undefined;
      if (!oldestKey) break;
      this.#commandHistory.delete(oldestKey);
    }
  }
}
