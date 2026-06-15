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
  GameEventDefinition,
  ModifierCondition,
  ModifierStat,
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
  type CountryDecisionView,
  type CountryEventView,
} from "../mechanics/decisionEventMechanics";
import type { GameContentEntry, GameSettings } from "./gameSettingsTypes";

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
  resolveModifiedValue: (stat: ModifierStat, base: number, context: { countryId: string }) => number;
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
    const next: CountryDecisionRecord = { completedDecisionIds: [], cooldownUntilTurnByDecisionId: {}, history: [] };
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
      conditionsMatchCountry: params.modifierConditionsMatchCountry,
    });

  const getVisibleCountryDecisionsForRuntime = (countryId: string): CountryDecisionView[] =>
    getVisibleCountryDecisions({
      countryId,
      entries: params.getGameSettings().content.decisions,
      record: ensureCountryDecisionRecord(countryId),
      turnId: params.getTurnId(),
      resources: params.getWorldBase().resourcesByCountry[countryId],
      conditionsMatchCountry: params.modifierConditionsMatchCountry,
    });

  const applyDecisionEffectsForRuntime = (countryId: string, effects: DecisionEffect[] | undefined): void => {
    applyDecisionEffects(params.getWorldBase().resourcesByCountry[countryId], effects);
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
    const generated = maybeGenerateCountryEvents({
      countryIds: Object.keys(params.getWorldBase().resourcesByCountry),
      entries: params.getGameSettings().content.events,
      turnId: params.getTurnId(),
      ensureCountryEventRecord,
      conditionsMatchCountry: params.modifierConditionsMatchCountry,
      createId: randomUUID,
    });
    for (const item of generated) {
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
    }
  };

  const autoResolveExpiredCountryEventsForRuntime = (news: EventLogEntry[]): void => {
    const result = autoResolveExpiredCountryEvents({
      recordsByCountryId: params.getWorldBase().countryEventsByCountryId,
      entries: params.getGameSettings().content.events,
      resourcesByCountry: params.getWorldBase().resourcesByCountry,
      turnId: params.getTurnId(),
      normalizeCountryEventRecord: params.normalizeCountryEventRecord,
    });
    for (const notificationId of result.notificationIdsToRemove) {
      params.removeQueuedUiNotification(notificationId);
    }
    for (const item of result.resolved) {
      news.push(
        params.makeOfficialNews({
          turn: params.getTurnId(),
          category: item.event.category ?? "politics",
          title: "Событие обработано автоматически",
          message: `${item.countryId}: ${item.name} - ${item.optionLabel}`,
          countryId: item.countryId,
          priority: item.event.priority ?? "medium",
          visibility: item.event.visibility ?? "private",
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
    applyDecisionEffects: applyDecisionEffectsForRuntime,
    getGameEventDefinition: getGameEventDefinitionForRuntime,
    getPendingCountryEvents: getPendingCountryEventsForRuntime,
    maybeGenerateCountryEvents: maybeGenerateCountryEventsForRuntime,
    autoResolveExpiredCountryEvents: autoResolveExpiredCountryEventsForRuntime,
    resolveTechnologyTurn: resolveTechnologyTurnForRuntime,
  };
}
