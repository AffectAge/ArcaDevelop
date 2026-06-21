import { randomUUID } from "node:crypto";
import type {
  CountryDecisionRecord,
  CountryEventRecord,
  CountryParliament,
  CountryParliamentPowerBill,
  CountryParliamentPowers,
  DecisionEffect,
  EventCategory,
  EventLogEntry,
  EventPriority,
  EventVisibility,
  GameEffect,
  GameEventDefinition,
  ModifierCondition,
  ModifierStat,
  ResourceTotals,
  WorldBase,
  WsOutMessage,
} from "@arcanorum/shared";
import {
  calculateBillVote,
  calculatePowerBillVote,
  canEnactLawWithoutVote,
  ensureCountryParliament,
  getParliamentPowersFromActiveLaws,
  normalizeParliamentPowers,
  resolveParliamentTurn,
} from "../mechanics/parliamentMechanics";
import {
  isBuildingUnlockedForCountry,
  isLawUnlockedForCountry,
  isTechnologyResearched,
  resolveTechnologyTurn,
} from "../mechanics/technologyMechanics";
import {
  applyDecisionEffects,
  autoResolveExpiredCountryEvents,
  eventCategoryToUiCategory,
  getCountryDecisionView,
  getGameEventDefinition,
  getPendingCountryEvents,
  getVisibleCountryDecisions,
  maybeGenerateCountryEvents,
  promoteScheduledCountryEvents,
  applyEventOptionEventEffects,
  applyDecisionCosts,
  rechargeCountryDecisionCharges,
  type CountryDecisionView,
  type CountryEventView,
} from "../mechanics/decisionEventMechanics";
import { applyJournalGameEffects, resolveJournalEntriesTurn, type JournalLifecycleChange } from "../mechanics/journalMechanics";
import type { GameContentEntry, GameSettings } from "./gameSettingsTypes";
import type { ResourceLedgerEntryInput } from "./resourceLedgerRuntime";

export type CountryEventUiNotification = {
  countryId: string;
  notification: Extract<WsOutMessage, { type: "UI_NOTIFY" }>["notification"];
};

type CountryProgressionRuntimeParams = {
  getWorldBase: () => WorldBase;
  getGameSettings: () => GameSettings;
  getTurnId: () => number;
  normalizeTechnologyByCountryMap: (input: unknown) => WorldBase["technologyByCountry"];
  normalizeCountryDecisionRecord: (input: unknown) => CountryDecisionRecord;
  normalizeCountryEventRecord: (input: unknown) => CountryEventRecord;
  modifierConditionsMatchCountry: (conditions: ModifierCondition[] | undefined, countryId: string) => boolean;
  countryHasModifier?: (countryId: string, modifierId: string) => boolean;
  resolveModifiedValue: (stat: ModifierStat, base: number, context: { countryId: string }) => number;
  addResourceLedgerIncome?: (input: ResourceLedgerEntryInput) => void;
  addResourceLedgerExpense?: (input: ResourceLedgerEntryInput) => void;
  removeQueuedUiNotification: (notificationId: string) => void;
  makeOfficialNews: (input: {
    turn: number;
    category: EventCategory;
    title: string;
    message: string;
    countryId: string;
    priority: EventPriority;
    visibility: EventVisibility;
  }) => Extract<WsOutMessage, { type: "NEWS_EVENT" }>["event"];
};

export function createCountryProgressionRuntime(params: CountryProgressionRuntimeParams) {
  const normalizeParliamentPowersForRuntime = (raw: unknown): CountryParliamentPowers =>
    normalizeParliamentPowers(raw);

  const canEnactLawWithoutVoteForRuntime = (parliament: CountryParliament): boolean =>
    canEnactLawWithoutVote(parliament);

  const getParliamentPowersFromActiveLawsForRuntime = (
    activeLawByGroupId: Record<string, string>,
  ): CountryParliamentPowers =>
    getParliamentPowersFromActiveLaws(activeLawByGroupId, params.getGameSettings().content.laws);

  const ensureCountryParliamentForRuntime = (countryId: string): CountryParliament =>
    ensureCountryParliament({
      countryId,
      worldBase: params.getWorldBase(),
      content: params.getGameSettings().content,
      turnId: params.getTurnId(),
      createId: randomUUID,
    });

  const calculateBillVoteForRuntime = (
    parliament: CountryParliament,
    law: GameContentEntry,
    existingBill?: NonNullable<CountryParliament["currentBill"]> | null,
  ): NonNullable<CountryParliament["currentBill"]> =>
    calculateBillVote({
      parliament,
      law,
      parties: params.getGameSettings().content.parties,
      interestGroups: params.getGameSettings().content.interestGroups,
      turnId: params.getTurnId(),
      existingBill,
    });

  const calculatePowerBillVoteForRuntime = (
    parliament: CountryParliament,
    bill: CountryParliamentPowerBill,
  ): CountryParliamentPowerBill =>
    calculatePowerBillVote({
      parliament,
      bill,
      parties: params.getGameSettings().content.parties,
    });

  const makeElectionResultsUiNotification = (input: {
    countryId: string;
    parliament: CountryParliament;
  }): Extract<WsOutMessage, { type: "UI_NOTIFY" }>["notification"] => {
    const seatsTotal = Math.max(0, Math.floor(Number(input.parliament.seatsTotal ?? 0)));
    const leadingParty = [...(input.parliament.partySeats ?? [])].sort((a, b) => b.seats - a.seats || a.partyId.localeCompare(b.partyId))[0] ?? null;
    const leadingPartyName = leadingParty
      ? (params.getGameSettings().content.parties.find((party) => party.id === leadingParty.partyId)?.name ?? leadingParty.partyId)
      : null;
    return {
      id: `election-results:${input.countryId}:${params.getTurnId()}`,
      category: "politics",
      createdAt: new Date().toISOString(),
      title: "Результаты выборов",
      message: leadingPartyName
        ? `${leadingPartyName}: ${leadingParty.seats} из ${seatsTotal} мест`
        : `Сформирован парламент на ${seatsTotal} мест`,
      action: {
        type: "election-results",
        countryId: input.countryId,
        turnId: params.getTurnId(),
        seatsTotal,
        partySeats: structuredClone(input.parliament.partySeats ?? []),
        governmentPartyIds: [...(input.parliament.governmentPartyIds ?? [])],
      },
    };
  };

  const resolveParliamentTurnForRuntime = (): Array<{ countryId: string; parliament: CountryParliament }> =>
    resolveParliamentTurn({
      worldBase: params.getWorldBase(),
      content: params.getGameSettings().content,
      turnId: params.getTurnId(),
      createId: randomUUID,
    });

  const ensureCountryTechnologyState = (countryId: string): WorldBase["technologyByCountry"][string] => {
    const worldBase = params.getWorldBase();
    const existing = worldBase.technologyByCountry[countryId];
    if (existing) {
      const normalized = params.normalizeTechnologyByCountryMap({ [countryId]: existing })[countryId];
      worldBase.technologyByCountry[countryId] = normalized;
      return normalized;
    }
    const next: WorldBase["technologyByCountry"][string] = {
      researchedTechnologyIds: [],
      activeTechnologyId: null,
      activeTechnologyIds: [],
      progressByTechnologyId: {},
      lastScienceSpent: 0,
      lastCompletedTechnologyIds: [],
    };
    worldBase.technologyByCountry[countryId] = next;
    return next;
  };

  const ensureCountryDecisionRecord = (countryId: string): CountryDecisionRecord => {
    const worldBase = params.getWorldBase();
    const existing = worldBase.countryDecisionsByCountryId[countryId];
    if (existing) {
      const normalized = params.normalizeCountryDecisionRecord(existing);
      worldBase.countryDecisionsByCountryId[countryId] = normalized;
      return normalized;
    }
    const next: CountryDecisionRecord = {
      completedDecisionIds: [],
      cooldownUntilTurnByDecisionId: {},
      usesByDecisionId: {},
      usesByDecisionTargetKey: {},
      chargesByDecisionId: {},
      lastChargeTurnByDecisionId: {},
      history: [],
    };
    worldBase.countryDecisionsByCountryId[countryId] = next;
    return next;
  };

  const ensureCountryEventRecord = (countryId: string): CountryEventRecord => {
    const worldBase = params.getWorldBase();
    const existing = worldBase.countryEventsByCountryId[countryId];
    if (existing) {
      const normalized = params.normalizeCountryEventRecord(existing);
      worldBase.countryEventsByCountryId[countryId] = normalized;
      return normalized;
    }
    const next: CountryEventRecord = {
      pending: [],
      completedEventIds: [],
      cooldownUntilTurnByEventId: {},
      history: [],
    };
    worldBase.countryEventsByCountryId[countryId] = next;
    return next;
  };

  const isTechnologyResearchedForRuntime = (countryId: string, technologyId: string): boolean =>
    isTechnologyResearched(ensureCountryTechnologyState(countryId), technologyId);

  const isBuildingUnlockedForCountryForRuntime = (buildingId: string, countryId: string): boolean =>
    isBuildingUnlockedForCountry({
      buildingId,
      state: ensureCountryTechnologyState(countryId),
      technologies: params.getGameSettings().content.technologies,
    });

  const isLawUnlockedForCountryForRuntime = (lawId: string, countryId: string): boolean =>
    isLawUnlockedForCountry({
      lawId,
      state: ensureCountryTechnologyState(countryId),
      technologies: params.getGameSettings().content.technologies,
    });

  const getCountryDecisionViewForRuntime = (countryId: string, entry: GameContentEntry): CountryDecisionView =>
    getCountryDecisionView({
      countryId,
      entry,
      record: ensureCountryDecisionRecord(countryId),
      turnId: params.getTurnId(),
      resources: params.getWorldBase().resourcesByCountry[countryId],
      worldBase: params.getWorldBase(),
      conditionsMatchCountry: params.modifierConditionsMatchCountry,
      countryHasModifier: params.countryHasModifier,
    });

  const getVisibleCountryDecisionsForRuntime = (countryId: string): CountryDecisionView[] =>
    getVisibleCountryDecisions({
      countryId,
      entries: params.getGameSettings().content.decisions,
      record: ensureCountryDecisionRecord(countryId),
      turnId: params.getTurnId(),
      resources: params.getWorldBase().resourcesByCountry[countryId],
      worldBase: params.getWorldBase(),
      conditionsMatchCountry: params.modifierConditionsMatchCountry,
      countryHasModifier: params.countryHasModifier,
    });

  const rechargeDecisionChargesForRuntime = (): void => {
    const worldBase = params.getWorldBase();
    const decisions = params.getGameSettings().content.decisions;
    for (const countryId of Object.keys(worldBase.resourcesByCountry)) {
      rechargeCountryDecisionCharges({
        record: ensureCountryDecisionRecord(countryId),
        decisions,
        turnId: params.getTurnId(),
      });
    }
  };

  const applyDecisionEffectsForRuntime = (countryId: string, effects: Array<DecisionEffect | GameEffect> | undefined): void => {
    applyDecisionEffects(params.getWorldBase().resourcesByCountry[countryId], effects, {
      countryId,
      sourceType: "event",
      sourceId: `decision-event:${countryId}:${params.getTurnId()}`,
      addIncome: params.addResourceLedgerIncome,
      addExpense: params.addResourceLedgerExpense,
    });
  };

  const applyDecisionCostsForRuntime = (countryId: string, decisionId: string, costs: Partial<ResourceTotals> | undefined): void => {
    applyDecisionCosts(params.getWorldBase().resourcesByCountry[countryId], costs, {
      countryId,
      sourceType: "event",
      sourceId: decisionId,
      addExpense: params.addResourceLedgerExpense,
    });
  };

  const makeCountryEventUiNotification = (input: {
    countryId: string;
    pendingId: string;
    eventId: string;
    name: string;
    description: string;
    category: EventCategory;
  }): Extract<WsOutMessage, { type: "UI_NOTIFY" }>["notification"] => ({
    id: `country-event:${input.countryId}:${input.pendingId}`,
    category: eventCategoryToUiCategory(input.category),
    createdAt: new Date().toISOString(),
    title: input.name,
    message: input.description || "Новое событие требует выбора.",
    action: {
      type: "country-event",
      countryId: input.countryId,
      pendingId: input.pendingId,
      eventId: input.eventId,
    },
  });

  const getGameEventDefinitionForRuntime = (entry: GameContentEntry): GameEventDefinition =>
    getGameEventDefinition(entry);

  const getPendingCountryEventsForRuntime = (countryId: string): { events: CountryEventView[]; record: CountryEventRecord } =>
    getPendingCountryEvents({
      countryId,
      record: ensureCountryEventRecord(countryId),
      entries: params.getGameSettings().content.events,
    });

  const maybeGenerateCountryEventsForRuntime = (
    news: EventLogEntry[],
    uiNotifications: CountryEventUiNotification[],
  ): void => {
    const pushGeneratedEvent = (item: {
      countryId: string;
      pendingId: string;
      eventId: string;
      name: string;
      description: string;
      event: GameEventDefinition;
    }): void => {
      uiNotifications.push({
        countryId: item.countryId,
        notification: makeCountryEventUiNotification({
          countryId: item.countryId,
          pendingId: item.pendingId,
          eventId: item.eventId,
          name: item.name,
          description: item.description,
          category: item.event.category ?? "politics",
        }),
      });
      news.push(
        params.makeOfficialNews({
          turn: params.getTurnId(),
          category: item.event.category ?? "politics",
          title: "Новое событие",
          message: `${item.name}: ${item.description || "Требуется решение игрока."}`,
          countryId: item.countryId,
          priority: item.event.priority ?? "medium",
          visibility: item.event.visibility ?? "private",
        }),
      );
    };
    const promoted = promoteScheduledCountryEvents({
      scheduledByCountryId: params.getWorldBase().countryScheduledEventsByCountryId,
      entries: params.getGameSettings().content.events,
      turnId: params.getTurnId(),
      ensureCountryEventRecord,
      createId: randomUUID,
    });
    for (const item of promoted) pushGeneratedEvent(item);
    const generated = maybeGenerateCountryEvents({
      countryIds: Object.keys(params.getWorldBase().resourcesByCountry),
      entries: params.getGameSettings().content.events,
      turnId: params.getTurnId(),
      ensureCountryEventRecord,
      conditionsMatchCountry: params.modifierConditionsMatchCountry,
      countryHasModifier: params.countryHasModifier,
      worldBase: params.getWorldBase(),
      createId: randomUUID,
    });
    for (const item of generated) pushGeneratedEvent(item);
  };

  const autoResolveExpiredCountryEventsForRuntime = (news: EventLogEntry[]): void => {
    const result = autoResolveExpiredCountryEvents({
      recordsByCountryId: params.getWorldBase().countryEventsByCountryId,
      countryScheduledEventsByCountryId: params.getWorldBase().countryScheduledEventsByCountryId,
      countryEventFlagsByCountryId: params.getWorldBase().countryEventFlagsByCountryId,
      countryModifiersByCountryId: params.getWorldBase().countryModifiersByCountryId,
      colonyProgressByRegion: params.getWorldBase().colonyProgressByRegion,
      entries: params.getGameSettings().content.events,
      resourcesByCountry: params.getWorldBase().resourcesByCountry,
      worldBase: params.getWorldBase(),
      turnId: params.getTurnId(),
      normalizeCountryEventRecord: params.normalizeCountryEventRecord,
      conditionsMatchCountry: params.modifierConditionsMatchCountry,
      countryHasModifier: params.countryHasModifier,
      createId: randomUUID,
      addIncome: params.addResourceLedgerIncome,
      addExpense: params.addResourceLedgerExpense,
    });
    for (const notificationId of result.notificationIdsToRemove) {
      params.removeQueuedUiNotification(notificationId);
    }
    for (const item of result.resolved) {
      applyJournalGameEffectsForRuntime({
        countryId: item.countryId,
        effects: item.optionEffects,
        news,
      });
      news.push(
        params.makeOfficialNews({
          turn: params.getTurnId(),
          category: item.event.category ?? "politics",
          title: "Событие обработано автоматически",
          message: `${item.countryId}: ${item.name} - ${item.optionLabelKey}`,
          countryId: item.countryId,
          priority: item.event.priority ?? "medium",
          visibility: item.event.visibility ?? "private",
        }),
      );
    }
  };

  const resolveJournalEntriesTurnForRuntime = (news: EventLogEntry[]): void => {
    const worldBase = params.getWorldBase();
    const changes = resolveJournalEntriesTurn({
      countryIds: Object.keys(worldBase.resourcesByCountry),
      entries: params.getGameSettings().content.journalEntries,
      worldBase,
      turnId: params.getTurnId(),
      createId: randomUUID,
      conditionsMatchCountry: params.modifierConditionsMatchCountry,
      countryHasModifier: params.countryHasModifier,
    });
    processJournalLifecycleChanges(changes, news);
  };

  const applyJournalGameEffectsForRuntime = (input: {
    countryId: string;
    effects: GameEffect[] | undefined;
    scopes?: Parameters<typeof applyJournalGameEffects>[0]["scopes"];
    explanations?: Parameters<typeof applyJournalGameEffects>[0]["explanations"];
    news?: EventLogEntry[];
  }): JournalLifecycleChange[] => {
    const changes = applyJournalGameEffects({
      effects: input.effects,
      countryId: input.countryId,
      entries: params.getGameSettings().content.journalEntries,
      worldBase: params.getWorldBase(),
      turnId: params.getTurnId(),
      createId: randomUUID,
      scopes: input.scopes,
      explanations: input.explanations,
      conditionsMatchCountry: params.modifierConditionsMatchCountry,
    });
    if (input.news) processJournalLifecycleChanges(changes, input.news);
    return changes;
  };

  const processJournalLifecycleChanges = (initialChanges: JournalLifecycleChange[], news: EventLogEntry[]): void => {
    const worldBase = params.getWorldBase();
    const eventById = new Map(params.getGameSettings().content.events.map((entry) => [entry.id, entry] as const));
    const queue = [...initialChanges];
    for (let index = 0; index < queue.length && index < 50; index += 1) {
      const change = queue[index];
      applyDecisionEffects(worldBase.resourcesByCountry[change.countryId], change.effects, {
        countryId: change.countryId,
        sourceType: "event",
        sourceId: change.journalEntryId,
        addIncome: params.addResourceLedgerIncome,
        addExpense: params.addResourceLedgerExpense,
      });
      applyEventOptionEventEffects({
        effects: [
          ...change.effects,
          ...change.eventIds.map((eventId): GameEffect => ({ type: "trigger_event", eventId })),
        ],
        countryId: change.countryId,
        pending: { scopes: change.scopes, triggerExplanation: change.explanations },
        eventById,
        recordsByCountryId: worldBase.countryEventsByCountryId,
        countryScheduledEventsByCountryId: worldBase.countryScheduledEventsByCountryId,
        countryEventFlagsByCountryId: worldBase.countryEventFlagsByCountryId,
        countryModifiersByCountryId: worldBase.countryModifiersByCountryId,
        colonyProgressByRegion: worldBase.colonyProgressByRegion,
        turnId: params.getTurnId(),
        createId: randomUUID,
        sourceSystem: "journal",
        sourceId: change.journalEntryId,
      });
      const followupJournalChanges = applyJournalGameEffects({
        effects: change.effects,
        countryId: change.countryId,
        entries: params.getGameSettings().content.journalEntries,
        worldBase,
        turnId: params.getTurnId(),
        createId: randomUUID,
        scopes: change.scopes,
        explanations: change.explanations,
        conditionsMatchCountry: params.modifierConditionsMatchCountry,
        countryHasModifier: params.countryHasModifier,
      });
      queue.push(...followupJournalChanges);
      news.push(
        params.makeOfficialNews({
          turn: params.getTurnId(),
          category: "politics",
          title: change.titleKey,
          message: change.outcomeLabelKey,
          countryId: change.countryId,
          priority: change.state === "started" ? "low" : "medium",
          visibility: "private",
        }),
      );
    }
  };

  const resolveTechnologyTurnForRuntime = (news: EventLogEntry[]): void => {
    const completions = resolveTechnologyTurn({
      worldBase: params.getWorldBase(),
      technologies: params.getGameSettings().content.technologies,
      ensureCountryTechnologyState,
      resolveTechnologyCost: (countryId, technology) =>
        params.resolveModifiedValue("technology_cost", Number(technology.costScience ?? 100), { countryId }),
      addExpense: params.addResourceLedgerExpense,
    });
    for (const completion of completions) {
      news.push(
        params.makeOfficialNews({
          turn: params.getTurnId(),
          category: "economy",
          title: "Технология изучена",
          message: `${completion.countryId} завершила исследование: ${completion.technologyName}`,
          countryId: completion.countryId,
          priority: "medium",
          visibility: "public",
        }),
      );
    }
  };

  return {
    normalizeParliamentPowers: normalizeParliamentPowersForRuntime,
    canEnactLawWithoutVote: canEnactLawWithoutVoteForRuntime,
    getParliamentPowersFromActiveLaws: getParliamentPowersFromActiveLawsForRuntime,
    ensureCountryParliament: ensureCountryParliamentForRuntime,
    calculateBillVote: calculateBillVoteForRuntime,
    calculatePowerBillVote: calculatePowerBillVoteForRuntime,
    makeElectionResultsUiNotification,
    resolveParliamentTurn: resolveParliamentTurnForRuntime,
    ensureCountryTechnologyState,
    ensureCountryDecisionRecord,
    ensureCountryEventRecord,
    isTechnologyResearched: isTechnologyResearchedForRuntime,
    isBuildingUnlockedForCountry: isBuildingUnlockedForCountryForRuntime,
    isLawUnlockedForCountry: isLawUnlockedForCountryForRuntime,
    getCountryDecisionView: getCountryDecisionViewForRuntime,
    getVisibleCountryDecisions: getVisibleCountryDecisionsForRuntime,
    rechargeDecisionCharges: rechargeDecisionChargesForRuntime,
    applyDecisionEffects: applyDecisionEffectsForRuntime,
    applyDecisionCosts: applyDecisionCostsForRuntime,
    getGameEventDefinition: getGameEventDefinitionForRuntime,
    getPendingCountryEvents: getPendingCountryEventsForRuntime,
    maybeGenerateCountryEvents: maybeGenerateCountryEventsForRuntime,
    autoResolveExpiredCountryEvents: autoResolveExpiredCountryEventsForRuntime,
    resolveJournalEntriesTurn: resolveJournalEntriesTurnForRuntime,
    applyJournalGameEffects: applyJournalGameEffectsForRuntime,
    resolveTechnologyTurn: resolveTechnologyTurnForRuntime,
  };
}
