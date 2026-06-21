import { randomUUID } from "node:crypto";
import type express from "express";
import type {
  CountryParliament,
  CountryParliamentPowers,
  CountryDecisionRecord,
  CountryEventRecord,
  DecisionAvailabilityReason,
  DecisionDefinition,
  EventResolvedScope,
  EventTriggerExplanation,
  DecisionEffect,
  EventCategory,
  EventLogEntry,
  EventPriority,
  EventVisibility,
  GameEffect,
  GameEventDefinition,
  GameEventOption,
  LawParliamentPowerEffect,
  ModifierCondition,
  ModifierDefinition,
  IdeologyAttractionRule,
  ResourceTotals,
  ScheduledCountryEvent,
  WorldBase,
  WsOutMessage,
} from "@arcanorum/shared";
import { z } from "zod";
import type { RouteAuth } from "../security/routeAuth";
import { setActiveTechnologyState } from "../mechanics/technologyMechanics";
import {
  applyEventOptionEventEffects,
  createEventResourceExplanationRecords,
  getDecisionTargetUsageKey,
  scheduleEventFollowups,
  spendDecisionCharge,
  summarizeGameEffects,
} from "../mechanics/decisionEventMechanics";

export type CountryProgressionCultureNeed = {
  id: string;
  label: string;
  category: "survival" | "basic" | "comfort" | "luxury";
  amountPerPerson: number;
  weight: number;
  goods: Array<{
    goodId: string;
    weight: number;
  }>;
};

export type CountryProgressionCultureNeedTier = {
  id: string;
  minStandardOfLiving: number;
  needs: CountryProgressionCultureNeed[];
};

export type CountryProgressionCultureNeedsProfile = {
  tiers: CountryProgressionCultureNeedTier[];
};

export type CountryProgressionContentEntry = {
  id: string;
  nameKey?: string | null;
  name: string;
  description: string;
  color: string;
  logoUrl: string | null;
  malePortraitUrl: string | null;
  femalePortraitUrl: string | null;
  baseWage?: number | null;
  needsProfile?: CountryProgressionCultureNeedsProfile | null;
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
  prerequisiteTechnologyIds?: string[];
  unlockBuildingIds?: string[];
  unlockLawIds?: string[];
  modifiers?: ModifierDefinition[];
  decision?: DecisionDefinition | null;
  event?: GameEventDefinition | null;
  ideologyAttractionRules?: IdeologyAttractionRule[];
};

export type CountryProgressionContent = {
  parties: CountryProgressionContentEntry[];
  interestGroups: CountryProgressionContentEntry[];
  lawGroups: CountryProgressionContentEntry[];
  laws: CountryProgressionContentEntry[];
  ideologies: CountryProgressionContentEntry[];
  technologies: CountryProgressionContentEntry[];
  decisions: CountryProgressionContentEntry[];
  events: CountryProgressionContentEntry[];
};

export type CountryTechnologyStateRouteShape = {
  researchedTechnologyIds: string[];
  activeTechnologyId: string | null;
  activeTechnologyIds: string[];
  progressByTechnologyId: Record<string, number>;
  lastScienceSpent: number;
  lastCompletedTechnologyIds: string[];
};

export type CountryDecisionView = {
  available: boolean;
  reason?: string | null;
  reasons?: DecisionAvailabilityReason[];
  scopes?: Record<string, EventResolvedScope>;
  triggerExplanation?: EventTriggerExplanation[];
  decision: DecisionDefinition;
};

export type CountryProgressionMasks = {
  parliamentByCountry: number;
  technologyByCountry: number;
  resourcesByCountry: number;
  colonyProgressByRegion: number;
  countryDecisionsByCountryId: number;
  countryEventsByCountryId: number;
  countryScheduledEventsByCountryId: number;
  countryEventFlagsByCountryId: number;
  journalEntriesByCountryId: number;
  countryModifiersByCountryId: number;
  explanationRecordsByTurn: number;
};

export type CountryProgressionRoutesDependencies = {
  routeAuth: RouteAuth;
  masks: CountryProgressionMasks;
  getTurnId: () => number;
  getContent: () => CountryProgressionContent;
  getWorldBase: () => Pick<
    WorldBase,
    | "resourcesByCountry"
    | "resourceLedgerByTurn"
    | "regionOwner"
    | "regionController"
    | "regionPopulationByRegion"
    | "regionBuildingsByRegion"
    | "colonyProgressByRegion"
    | "regionResourceDepositsByRegion"
    | "regionColonizationByRegion"
    | "countryEventsByCountryId"
    | "countryScheduledEventsByCountryId"
    | "countryModifiersByCountryId"
    | "explanationRecordsByTurn"
  >;
  getCountryResources: (countryId: string) => ResourceTotals;
  modifierConditionsMatchCountry: (conditions: ModifierCondition[] | undefined, countryId: string) => boolean;
  ensureCountryInWorldBase: (countryId: string) => void;
  ensureCountryParliament: (countryId: string) => CountryParliament;
  setCountryParliament: (countryId: string, parliament: CountryParliament) => void;
  canEnactLawWithoutVote: (parliament: CountryParliament) => boolean;
  calculateBillVote: (
    parliament: CountryParliament,
    law: CountryProgressionContentEntry,
    context: NonNullable<CountryParliament["currentBill"]> | null,
  ) => NonNullable<CountryParliament["currentBill"]>;
  calculatePowerBillVote: (
    parliament: CountryParliament,
    bill: NonNullable<CountryParliament["currentPowerBills"]>[number],
  ) => NonNullable<CountryParliament["currentPowerBills"]>[number];
  normalizeParliamentPowers: (powers: unknown) => CountryParliamentPowers;
  getParliamentPowersFromActiveLaws: (activeLawByGroupId: Record<string, string>) => CountryParliamentPowers;
  isLawUnlockedForCountry: (lawId: string, countryId: string) => boolean;
  ensureCountryTechnologyState: (countryId: string) => CountryTechnologyStateRouteShape;
  setCountryTechnologyState: (countryId: string, state: CountryTechnologyStateRouteShape) => void;
  getActiveCountryModifierRows: (countryId: string) => unknown[];
  countryHasModifier: (countryId: string, modifierId: string) => boolean;
  getVisibleCountryDecisions: (countryId: string) => unknown[];
  ensureCountryDecisionRecord: (countryId: string) => CountryDecisionRecord;
  getCountryDecisionView: (countryId: string, decision: CountryProgressionContentEntry) => CountryDecisionView;
  applyDecisionEffects: (countryId: string, effects: Array<DecisionEffect | GameEffect> | undefined) => void;
  applyJournalGameEffects: (input: {
    countryId: string;
    effects: GameEffect[] | undefined;
    scopes?: CountryEventRecord["pending"][number]["scopes"];
    explanations?: CountryEventRecord["pending"][number]["triggerExplanation"];
    news?: EventLogEntry[];
  }) => unknown;
  applyDecisionCosts: (countryId: string, decisionId: string, costs: Partial<ResourceTotals> | undefined) => void;
  flushResourceLedger?: () => void;
  ensureCountryEventRecord: (countryId: string) => CountryEventRecord;
  getPendingCountryEvents: (countryId: string) => Record<string, unknown>;
  getGameEventDefinition: (entry: CountryProgressionContentEntry) => GameEventDefinition;
  getCountryScheduledEventsByCountryId: () => Record<string, ScheduledCountryEvent[]>;
  getCountryEventFlagsByCountryId: () => Record<string, Record<string, string | number | boolean>>;
  removeQueuedUiNotification: (notificationId: string) => void;
  cloneWorldBaseSectionSnapshot: (mask: number) => unknown;
  savePersistentState: () => void;
  broadcastWorldDeltaFromSectionSnapshot: (previousWorldBase: unknown) => void;
  makeOfficialNews: (input: {
    turn: number;
    category: EventCategory;
    title: string;
    message: string;
    countryId: string;
    priority: EventPriority;
    visibility: EventVisibility;
  }) => Extract<WsOutMessage, { type: "NEWS_EVENT" }>["event"];
  broadcast: (message: WsOutMessage) => void;
};

export const startLawBillSchema = z.object({
  lawId: z.string().trim().min(1).max(120),
});

export const parliamentPowersPayloadSchema = z.object({
  laws: z.enum(["none", "advisory", "approve", "initiate"]),
  budget: z.enum(["none", "approve_taxes", "approve_budget", "control_budget"]),
  diplomacy: z.enum(["none", "ratify_territory", "ratify_major_treaties", "ratify_all"]),
  war: z.enum(["none", "approve", "declare"]),
  government: z.enum(["none", "confidence_vote", "appoint_government"]),
  moneyTransferRatificationThreshold: z.number().finite().positive().nullable().optional(),
});

export const startPowerBillSchema = z.object({
  title: z.string().trim().min(1).max(160),
  powers: parliamentPowersPayloadSchema,
});

export const setActiveTechnologySchema = z.object({
  technologyId: z.string().trim().min(1).max(120).nullable(),
  active: z.boolean().optional(),
});

function isGameEffect(effect: DecisionEffect | GameEffect): effect is GameEffect {
  return (
    effect.type === "add_resource" ||
    effect.type === "spend_resource" ||
    effect.type === "add_resource_flow" ||
    effect.type === "trigger_event" ||
    effect.type === "schedule_event" ||
    effect.type === "cancel_event" ||
    effect.type === "set_event_flag" ||
    effect.type === "clear_event_flag" ||
    effect.type === "start_journal_entry" ||
    effect.type === "advance_journal_entry" ||
    effect.type === "complete_journal_entry" ||
    effect.type === "fail_journal_entry" ||
    effect.type === "cancel_journal_entry" ||
    effect.type === "set_journal_variable" ||
    effect.type === "clear_journal_variable" ||
    effect.type === "add_modifier" ||
    effect.type === "remove_modifier" ||
    effect.type === "extend_modifier" ||
    effect.type === "change_colonization_progress"
  );
}

export function registerCountryProgressionRoutes(
  app: express.Express,
  deps: CountryProgressionRoutesDependencies,
): void {
  app.get("/politics/:countryId", async (req, res) => {
    const countryId = String(req.params.countryId);
    if (!(await deps.routeAuth.requireSelfOrAdmin(req, res, countryId))) return;
    deps.ensureCountryInWorldBase(countryId);
    const content = deps.getContent();
    return res.json({
      parliament: deps.ensureCountryParliament(countryId),
      parties: content.parties,
      interestGroups: content.interestGroups,
      lawGroups: content.lawGroups,
      laws: content.laws,
      ideologies: content.ideologies,
    });
  });

  app.post("/politics/:countryId/bill", async (req, res) => {
    const countryId = String(req.params.countryId);
    if (!(await deps.routeAuth.requireSelfOrAdmin(req, res, countryId))) return;
    const parsed = startLawBillSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "INVALID_PAYLOAD", issues: parsed.error.issues });
    }
    const law = deps.getContent().laws.find((entry) => entry.id === parsed.data.lawId);
    if (!law || !law.lawGroupId) {
      return res.status(404).json({ error: "LAW_NOT_FOUND" });
    }
    deps.ensureCountryInWorldBase(countryId);
    if (!deps.isLawUnlockedForCountry(law.id, countryId)) {
      return res.status(409).json({ error: "LAW_LOCKED_BY_TECH" });
    }
    const parliament = deps.ensureCountryParliament(countryId);
    if (parliament.activeLawByGroupId[law.lawGroupId] === law.id) {
      return res.status(409).json({ error: "LAW_ALREADY_ACTIVE" });
    }
    if ((parliament.currentBills ?? []).some((bill) => bill.lawId === law.id && bill.status === "debating")) {
      return res.status(409).json({ error: "LAW_ALREADY_IN_VOTE" });
    }
    const previousWorldBase = deps.cloneWorldBaseSectionSnapshot(deps.masks.parliamentByCountry);
    if (deps.canEnactLawWithoutVote(parliament)) {
      parliament.activeLawByGroupId[law.lawGroupId] = law.id;
      parliament.powers = deps.getParliamentPowersFromActiveLaws(parliament.activeLawByGroupId);
      parliament.currentBills = (parliament.currentBills ?? []).filter((bill) => bill.lawId !== law.id);
      parliament.currentBill = parliament.currentBills[0] ?? null;
    } else {
      const nextBill = deps.calculateBillVote(parliament, law, null);
      parliament.currentBills = [...(parliament.currentBills ?? []), nextBill];
      parliament.currentBill = parliament.currentBills[0] ?? null;
    }
    deps.setCountryParliament(countryId, parliament);
    deps.savePersistentState();
    deps.broadcastWorldDeltaFromSectionSnapshot(previousWorldBase);
    return res.json({ parliament, law });
  });

  app.post("/politics/:countryId/power-bill", async (req, res) => {
    const countryId = String(req.params.countryId);
    if (!(await deps.routeAuth.requireSelfOrAdmin(req, res, countryId))) return;
    const parsed = startPowerBillSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "INVALID_PAYLOAD", issues: parsed.error.issues });
    }
    deps.ensureCountryInWorldBase(countryId);
    const parliament = deps.ensureCountryParliament(countryId);
    const proposedPowers = deps.normalizeParliamentPowers(parsed.data.powers);
    const currentPowers = deps.normalizeParliamentPowers(parliament.powers);
    if (JSON.stringify(proposedPowers) === JSON.stringify(currentPowers)) {
      return res.status(409).json({ error: "POWERS_ALREADY_ACTIVE" });
    }
    if (
      (parliament.currentPowerBills ?? []).some(
        (bill) => bill.status === "debating" && JSON.stringify(deps.normalizeParliamentPowers(bill.proposedPowers)) === JSON.stringify(proposedPowers),
      )
    ) {
      return res.status(409).json({ error: "POWER_BILL_ALREADY_IN_VOTE" });
    }

    const previousWorldBase = deps.cloneWorldBaseSectionSnapshot(deps.masks.parliamentByCountry);
    const nextBill = deps.calculatePowerBillVote(parliament, {
      id: randomUUID(),
      title: parsed.data.title.trim(),
      startedTurnId: deps.getTurnId(),
      progress: 0,
      yesSeats: 0,
      noSeats: 0,
      abstainSeats: 0,
      status: "debating",
      proposedPowers,
    });
    parliament.currentPowerBills = [...(parliament.currentPowerBills ?? []), nextBill];
    deps.setCountryParliament(countryId, parliament);
    deps.savePersistentState();
    deps.broadcastWorldDeltaFromSectionSnapshot(previousWorldBase);
    return res.json({ parliament, bill: nextBill });
  });

  app.post("/technology/:countryId/active", async (req, res) => {
    const countryId = String(req.params.countryId);
    if (!(await deps.routeAuth.requireSelfOrAdmin(req, res, countryId))) return;
    const parsed = setActiveTechnologySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "INVALID_PAYLOAD", issues: parsed.error.issues });
    }
    deps.ensureCountryInWorldBase(countryId);
    const state = deps.ensureCountryTechnologyState(countryId);
    const previousWorldBase = deps.cloneWorldBaseSectionSnapshot(deps.masks.technologyByCountry);
    const result = setActiveTechnologyState({
      state,
      technologyId: parsed.data.technologyId,
      active: parsed.data.active,
      technologies: deps.getContent().technologies,
    });
    if (!result.ok) {
      return res.status(result.error === "TECHNOLOGY_NOT_FOUND" ? 404 : 409).json({ error: result.error });
    }
    deps.setCountryTechnologyState(countryId, result.state);
    deps.savePersistentState();
    deps.broadcastWorldDeltaFromSectionSnapshot(previousWorldBase);
    return res.json({ technology: result.state });
  });

  app.get("/modifiers/:countryId", async (req, res) => {
    const countryId = String(req.params.countryId || "").trim();
    if (!(await deps.routeAuth.requireSelfOrAdmin(req, res, countryId))) return;
    deps.ensureCountryInWorldBase(countryId);
    return res.json({ modifiers: deps.getActiveCountryModifierRows(countryId) });
  });

  app.get("/decisions/:countryId", async (req, res) => {
    const countryId = String(req.params.countryId || "").trim();
    if (!(await deps.routeAuth.requireSelfOrAdmin(req, res, countryId))) return;
    deps.ensureCountryInWorldBase(countryId);
    return res.json({ decisions: deps.getVisibleCountryDecisions(countryId), record: deps.ensureCountryDecisionRecord(countryId) });
  });

  app.post("/decisions/:countryId/:decisionId/take", async (req, res) => {
    const countryId = String(req.params.countryId || "").trim();
    if (!(await deps.routeAuth.requireSelfOrAdmin(req, res, countryId))) return;
    deps.ensureCountryInWorldBase(countryId);
    const decisionId = String(req.params.decisionId || "").trim();
    const entry = deps.getContent().decisions.find((item) => item.id === decisionId);
    if (!entry) {
      return res.status(404).json({ error: "DECISION_NOT_FOUND" });
    }
    const view = deps.getCountryDecisionView(countryId, entry);
    if (!view.available) {
      return res.status(400).json({ error: "DECISION_UNAVAILABLE", reason: view.reason, reasons: view.reasons ?? [] });
    }
    const previousWorldBase = deps.cloneWorldBaseSectionSnapshot(
      deps.masks.resourcesByCountry |
        deps.masks.colonyProgressByRegion |
        deps.masks.countryDecisionsByCountryId |
        deps.masks.countryEventsByCountryId |
        deps.masks.countryScheduledEventsByCountryId |
        deps.masks.countryEventFlagsByCountryId |
        deps.masks.journalEntriesByCountryId |
        deps.masks.countryModifiersByCountryId |
        deps.masks.explanationRecordsByTurn,
    );
    const worldBase = deps.getWorldBase();
    const previousResources = structuredClone(worldBase.resourcesByCountry[countryId] ?? deps.getCountryResources(countryId));
    deps.applyDecisionCosts(countryId, decisionId, view.decision.costs);
    deps.applyDecisionEffects(countryId, view.decision.effects);
    const gameEffects = (view.decision.effects ?? []).filter(isGameEffect);
    applyEventOptionEventEffects({
      effects: gameEffects,
      countryId,
      pending: { scopes: { root: { kind: "country", id: countryId } }, triggerExplanation: [] },
      eventById: new Map(deps.getContent().events.map((item) => [item.id, item] as const)),
      recordsByCountryId: deps.getWorldBase().countryEventsByCountryId,
      countryScheduledEventsByCountryId: deps.getCountryScheduledEventsByCountryId(),
      countryEventFlagsByCountryId: deps.getCountryEventFlagsByCountryId(),
      countryModifiersByCountryId: deps.getWorldBase().countryModifiersByCountryId,
      colonyProgressByRegion: deps.getWorldBase().colonyProgressByRegion,
      turnId: deps.getTurnId(),
      createId: randomUUID,
      sourceSystem: "decision",
      sourceId: decisionId,
    });
    const journalNews: EventLogEntry[] = [];
    deps.applyJournalGameEffects({
      countryId,
      effects: gameEffects,
      scopes: { root: { kind: "country", id: countryId } },
      explanations: [],
      news: journalNews,
    });
    deps.flushResourceLedger?.();
    const decisionCostEffects = Object.entries(view.decision.costs ?? {})
      .map(([resource, amount]): GameEffect | null => {
        const safeAmount = Number(amount);
        if (!Number.isFinite(safeAmount) || safeAmount <= 0) return null;
        return { type: "spend_resource", resource: resource as keyof ResourceTotals, amount: safeAmount, labelKey: "resourceLedger.source.generic" };
      })
      .filter((effect): effect is GameEffect => Boolean(effect));
    const explanationRecords = createEventResourceExplanationRecords({
      sourceSystem: "decision",
      eventId: decisionId,
      optionId: decisionId,
      countryId,
      turnId: deps.getTurnId(),
      scopes: view.scopes ?? { root: { kind: "country", id: countryId } },
      effects: [...decisionCostEffects, ...(view.decision.effects ?? [])],
      previousResources,
      nextResources: deps.getWorldBase().resourcesByCountry[countryId] ?? deps.getCountryResources(countryId),
      createId: randomUUID,
    });
    if (explanationRecords.length > 0) {
      const turnId = deps.getTurnId();
      const target = deps.getWorldBase().explanationRecordsByTurn;
      target[turnId] = [...(target[turnId] ?? []), ...explanationRecords].slice(-2_000);
    }
    const record = deps.ensureCountryDecisionRecord(countryId);
    record.usesByDecisionId[decisionId] = (record.usesByDecisionId[decisionId] ?? 0) + 1;
    const targetUsageKey = getDecisionTargetUsageKey(decisionId, view.scopes ?? { root: { kind: "country", id: countryId } });
    record.usesByDecisionTargetKey[targetUsageKey] = (record.usesByDecisionTargetKey[targetUsageKey] ?? 0) + 1;
    spendDecisionCharge(record, decisionId, view.decision, deps.getTurnId());
    if (!record.completedDecisionIds.includes(decisionId)) record.completedDecisionIds.push(decisionId);
    const cooldown = Math.max(0, Math.floor(Number(view.decision.cooldownTurns ?? 0)));
    if (cooldown > 0) record.cooldownUntilTurnByDecisionId[decisionId] = deps.getTurnId() + cooldown;
    record.history.unshift({
      decisionId,
      takenTurnId: deps.getTurnId(),
      label: entry.name,
      scopes: view.scopes ?? { root: { kind: "country", id: countryId } },
      appliedEffects: summarizeGameEffects(view.decision.effects),
      explanationIds: explanationRecords.map((item) => item.id),
    });
    record.history = record.history.slice(0, 200);
    deps.savePersistentState();
    deps.broadcastWorldDeltaFromSectionSnapshot(previousWorldBase);
    deps.broadcast({
      type: "NEWS_EVENT",
      event: deps.makeOfficialNews({
        turn: deps.getTurnId(),
        category: "politics",
        title: "Принято решение",
        message: `${countryId}: ${entry.name}`,
        countryId,
        priority: "medium",
        visibility: "public",
      }),
    });
    for (const event of journalNews) {
      deps.broadcast({ type: "NEWS_EVENT", event });
    }
    return res.json({ ok: true, decisions: deps.getVisibleCountryDecisions(countryId), record });
  });

  app.get("/events/:countryId", async (req, res) => {
    const countryId = String(req.params.countryId || "").trim();
    if (!(await deps.routeAuth.requireSelfOrAdmin(req, res, countryId))) return;
    deps.ensureCountryInWorldBase(countryId);
    return res.json(deps.getPendingCountryEvents(countryId));
  });

  app.post("/events/:countryId/:pendingId/choose", async (req, res) => {
    const countryId = String(req.params.countryId || "").trim();
    if (!(await deps.routeAuth.requireSelfOrAdmin(req, res, countryId))) return;
    const optionId = typeof req.body?.optionId === "string" ? req.body.optionId.trim().slice(0, 120) : "";
    if (!optionId) {
      return res.status(400).json({ error: "INVALID_OPTION" });
    }
    deps.ensureCountryInWorldBase(countryId);
    const record = deps.ensureCountryEventRecord(countryId);
    const pending = record.pending.find((item) => item.id === String(req.params.pendingId || "").trim());
    if (!pending) {
      return res.status(404).json({ error: "EVENT_NOT_FOUND" });
    }
    const entry = deps.getContent().events.find((item) => item.id === pending.eventId);
    if (!entry) {
      record.pending = record.pending.filter((item) => item.id !== pending.id);
      deps.removeQueuedUiNotification(`country-event:${countryId}:${pending.id}`);
      deps.savePersistentState();
      return res.status(404).json({ error: "EVENT_DEFINITION_NOT_FOUND" });
    }
    const event = deps.getGameEventDefinition(entry);
    const option = (event.options ?? []).find((item: GameEventOption) => item.id === optionId);
    if (!option) {
      return res.status(404).json({ error: "OPTION_NOT_FOUND" });
    }
    const previousWorldBase = deps.cloneWorldBaseSectionSnapshot(
      deps.masks.resourcesByCountry |
        deps.masks.colonyProgressByRegion |
        deps.masks.countryEventsByCountryId |
        deps.masks.countryScheduledEventsByCountryId |
        deps.masks.countryEventFlagsByCountryId |
        deps.masks.journalEntriesByCountryId |
        deps.masks.countryModifiersByCountryId |
        deps.masks.explanationRecordsByTurn,
    );
    const worldBase = deps.getWorldBase();
    const previousResources = structuredClone(worldBase.resourcesByCountry[countryId] ?? deps.getCountryResources(countryId));
    deps.applyDecisionEffects(countryId, option.effects);
    deps.flushResourceLedger?.();
    const explanationRecords = createEventResourceExplanationRecords({
      eventId: entry.id,
      optionId: option.id,
      countryId,
      turnId: deps.getTurnId(),
      scopes: pending.scopes,
      effects: option.effects,
      previousResources,
      nextResources: deps.getWorldBase().resourcesByCountry[countryId] ?? deps.getCountryResources(countryId),
      createId: randomUUID,
    });
    if (explanationRecords.length > 0) {
      const turnId = deps.getTurnId();
      const target = deps.getWorldBase().explanationRecordsByTurn;
      target[turnId] = [...(target[turnId] ?? []), ...explanationRecords].slice(-2_000);
    }
    scheduleEventFollowups({
      event,
      pending,
      countryScheduledEventsByCountryId: deps.getCountryScheduledEventsByCountryId(),
      turnId: deps.getTurnId(),
      createId: randomUUID,
      worldBase: deps.getWorldBase(),
      conditionsMatchCountry: deps.modifierConditionsMatchCountry,
      countryHasModifier: deps.countryHasModifier,
    });
    applyEventOptionEventEffects({
      effects: option.effects,
      countryId,
      pending,
      eventById: new Map(deps.getContent().events.map((item) => [item.id, item] as const)),
      recordsByCountryId: deps.getWorldBase().countryEventsByCountryId,
      countryScheduledEventsByCountryId: deps.getCountryScheduledEventsByCountryId(),
      countryEventFlagsByCountryId: deps.getCountryEventFlagsByCountryId(),
      countryModifiersByCountryId: deps.getWorldBase().countryModifiersByCountryId,
      colonyProgressByRegion: deps.getWorldBase().colonyProgressByRegion,
      turnId: deps.getTurnId(),
      createId: randomUUID,
      sourceSystem: "event",
      sourceId: entry.id,
    });
    const journalNews: EventLogEntry[] = [];
    deps.applyJournalGameEffects({
      countryId,
      effects: option.effects,
      scopes: pending.scopes,
      explanations: pending.triggerExplanation,
      news: journalNews,
    });
    record.pending = record.pending.filter((item) => item.id !== pending.id);
    if (!record.completedEventIds.includes(entry.id)) record.completedEventIds.push(entry.id);
    const cooldown = Math.max(0, Math.floor(Number(event.cooldownTurns ?? 0)));
    if (cooldown > 0) record.cooldownUntilTurnByEventId[entry.id] = deps.getTurnId() + cooldown;
    record.history.unshift({
      eventId: entry.id,
      optionId: option.id,
      resolvedTurnId: deps.getTurnId(),
      titleKey: entry.nameKey ?? null,
      optionLabelKey: option.labelKey,
      scopes: pending.scopes ?? {},
      appliedEffects: summarizeGameEffects(option.effects),
      explanationIds: explanationRecords.map((item) => item.id),
    });
    record.history = record.history.slice(0, 200);
    deps.removeQueuedUiNotification(`country-event:${countryId}:${pending.id}`);
    deps.savePersistentState();
    deps.broadcastWorldDeltaFromSectionSnapshot(previousWorldBase);
    deps.broadcast({
      type: "NEWS_EVENT",
      event: deps.makeOfficialNews({
        turn: deps.getTurnId(),
        category: event.category ?? "politics",
        title: "Событие обработано",
        message: `${countryId}: ${entry.name} - ${option.labelKey}`,
        countryId,
        priority: event.priority ?? "medium",
        visibility: event.visibility ?? "private",
      }),
    });
    for (const event of journalNews) {
      deps.broadcast({ type: "NEWS_EVENT", event });
    }
    return res.json({ ok: true, ...deps.getPendingCountryEvents(countryId) });
  });
}
