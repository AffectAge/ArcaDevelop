import type {
  CountryDecisionRecord,
  CountryEventRecord,
  DiplomacyProposal,
  DiplomacyProposalStatus,
  ExplanationRecord,
  ResourceFlow,
  ResourceTotals,
  TreatyClause,
  TreatyMoneyPaymentCadence,
  TreatyMoneyResource,
  WorldBase,
} from "@arcanorum/shared";
import { DEFAULT_TRADEABLE_TRANSPORT_MODES, normalizeGoodTransportModesList } from "../mechanics/marketTurnMechanics";
import { normalizeCountryIdList, normalizeNumberRecord } from "../content/contentNormalizers";
import { normalizeInfrastructureConstructionExpirationPolicy } from "./marketSettingsNormalizers";

export type WorldStateNormalizerContext = {
  turnId: number;
  createId: () => string;
  colonizationPointsPerTurn: number;
  baseConstructionPerTurn: number;
};

export function createWorldStateNormalizers(params: WorldStateNormalizerContext) {
  const turnId = params.turnId;
  const randomUUID = params.createId;
  const gameSettings = {
    colonization: { pointsPerTurn: params.colonizationPointsPerTurn },
    economy: { baseConstructionPerTurn: params.baseConstructionPerTurn },
  };

  function normalizeResourceTotals(input: unknown): ResourceTotals {
    const source = input && typeof input === "object" ? (input as Partial<ResourceTotals>) : {};
    return {
      culture: typeof source.culture === "number" && Number.isFinite(source.culture) ? Math.max(0, Math.floor(source.culture)) : 0,
      science: typeof source.science === "number" && Number.isFinite(source.science) ? Math.max(0, Math.floor(source.science)) : 0,
      religion: typeof source.religion === "number" && Number.isFinite(source.religion) ? Math.max(0, Math.floor(source.religion)) : 0,
      colonization:
        typeof source.colonization === "number" && Number.isFinite(source.colonization)
          ? Math.max(0, Math.floor(source.colonization))
          : gameSettings.colonization.pointsPerTurn,
      construction:
        typeof source.construction === "number" && Number.isFinite(source.construction)
          ? Math.max(0, Math.floor(source.construction))
          : gameSettings.economy.baseConstructionPerTurn,
      ducats: typeof source.ducats === "number" && Number.isFinite(source.ducats) ? Math.max(0, Math.floor(source.ducats)) : 0,
      gold: typeof source.gold === "number" && Number.isFinite(source.gold) ? Math.max(0, Math.floor(source.gold)) : 0,
    };
  }

  function normalizeResourcesByCountryMap(input: unknown): Record<string, ResourceTotals> {
    const source = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
    const normalized: Record<string, ResourceTotals> = {};
    for (const [countryId, totals] of Object.entries(source)) {
      if (!countryId) continue;
      normalized[countryId] = normalizeResourceTotals(totals);
    }
    return normalized;
  }

  function normalizeResourceLedgerByTurn(input: unknown): WorldBase["resourceLedgerByTurn"] {
    const source = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
    const normalized: WorldBase["resourceLedgerByTurn"] = {};
    for (const [turnIdText, rawFlows] of Object.entries(source)) {
      const flowTurnId = Number(turnIdText);
      if (!Number.isInteger(flowTurnId) || flowTurnId < 1 || !Array.isArray(rawFlows)) continue;
      const flows: ResourceFlow[] = [];
      for (const raw of rawFlows) {
        if (!raw || typeof raw !== "object") continue;
        const row = raw as Partial<ResourceFlow>;
        if (!RESOURCE_TOTAL_KEYS.includes(row.resourceId as keyof ResourceTotals)) continue;
        const countryId = typeof row.countryId === "string" ? row.countryId.trim() : "";
        const sourceId = typeof row.sourceId === "string" ? row.sourceId.trim() : "";
        const categoryId = typeof row.categoryId === "string" ? row.categoryId.trim() : "";
        const labelKey = typeof row.labelKey === "string" ? row.labelKey.trim() : "";
        const amount = typeof row.amount === "number" && Number.isFinite(row.amount) ? Number(Math.max(0, row.amount).toFixed(3)) : null;
        if (!countryId || !sourceId || !categoryId || !labelKey || amount == null) continue;
        flows.push({
          id: typeof row.id === "string" && row.id.trim() ? row.id.trim().slice(0, 160) : randomUUID(),
          turnId: flowTurnId,
          countryId,
          resourceId: row.resourceId as keyof ResourceTotals,
          direction: row.direction === "expense" ? "expense" : "income",
          amount,
          sourceType: normalizeResourceFlowSourceType(row.sourceType),
          sourceId,
          categoryId,
          labelKey,
          labelParams: normalizeFlatMetadata(row.labelParams),
          metadata: normalizeFlatMetadata(row.metadata),
        });
      }
      normalized[flowTurnId] = flows.slice(0, 10_000);
    }
    return normalized;
  }

  function normalizeExplanationRecordsByTurn(input: unknown): WorldBase["explanationRecordsByTurn"] {
    const source = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
    const normalized: WorldBase["explanationRecordsByTurn"] = {};
    for (const [turnIdText, rawRecords] of Object.entries(source)) {
      const recordTurnId = Number(turnIdText);
      if (!Number.isInteger(recordTurnId) || recordTurnId < 1 || !Array.isArray(rawRecords)) continue;
      const records: ExplanationRecord[] = [];
      for (const raw of rawRecords) {
        if (!raw || typeof raw !== "object") continue;
        const row = raw as Record<string, unknown>;
        const id = typeof row.id === "string" && row.id.trim() ? row.id.trim().slice(0, 160) : randomUUID();
        const sourceId = typeof row.sourceId === "string" && row.sourceId.trim() ? row.sourceId.trim().slice(0, 160) : "";
        const valueKey = typeof row.valueKey === "string" && row.valueKey.trim() ? row.valueKey.trim().slice(0, 160) : "";
        const affectedObject = (normalizeCountryEventScopes({ affected: row.affectedObject }) ?? {}).affected;
        if (!sourceId || !valueKey || !affectedObject) continue;
        const causes = Array.isArray(row.causes)
          ? row.causes
              .map((rawCause): ExplanationRecord["causes"][number] | null => {
                if (!rawCause || typeof rawCause !== "object") return null;
                const cause = rawCause as Record<string, unknown>;
                const labelKey =
                  typeof cause.labelKey === "string" && cause.labelKey.trim()
                    ? cause.labelKey.trim().slice(0, 160)
                    : "";
                if (!labelKey) return null;
                const amount = Number(cause.amount);
                return {
                  labelKey,
                  sourceId:
                    typeof cause.sourceId === "string" && cause.sourceId.trim()
                      ? cause.sourceId.trim().slice(0, 160)
                      : null,
                  value: normalizeCountryEventExplanationValue(cause.value),
                  amount: Number.isFinite(amount) ? Number(amount.toFixed(3)) : null,
                };
              })
              .filter((cause): cause is ExplanationRecord["causes"][number] => Boolean(cause))
              .slice(0, 20)
          : [];
        records.push({
          id,
          turnId: Number.isFinite(Number(row.turnId)) ? Math.max(1, Math.floor(Number(row.turnId))) : recordTurnId,
          sourceSystem: normalizeExplanationSourceSystem(row.sourceSystem),
          sourceId,
          affectedObject,
          valueKey,
          previousValue: normalizeCountryEventExplanationValue(row.previousValue),
          newValue: normalizeCountryEventExplanationValue(row.newValue),
          causes,
          modifierIds: normalizeCountryIdList(row.modifierIds).slice(0, 40),
        });
      }
      normalized[recordTurnId] = records.slice(0, 2_000);
    }
    return normalized;
  }

  function normalizeTechnologyByCountryMap(input: unknown): WorldBase["technologyByCountry"] {
    const source = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
    const normalized: WorldBase["technologyByCountry"] = {};
    for (const [countryId, raw] of Object.entries(source)) {
      if (!countryId || !raw || typeof raw !== "object") continue;
      const row = raw as Partial<WorldBase["technologyByCountry"][string]>;
      const researchedTechnologyIds = normalizeCountryIdList(row.researchedTechnologyIds);
      const fallbackActiveTechnologyId =
        typeof row.activeTechnologyId === "string" && row.activeTechnologyId.trim().length > 0
          ? row.activeTechnologyId.trim().slice(0, 120)
          : null;
      const activeTechnologyIds = normalizeCountryIdList([
        ...(Array.isArray(row.activeTechnologyIds) ? row.activeTechnologyIds : []),
        ...(fallbackActiveTechnologyId ? [fallbackActiveTechnologyId] : []),
      ]);
      normalized[countryId] = {
        researchedTechnologyIds,
        activeTechnologyId: activeTechnologyIds[0] ?? null,
        activeTechnologyIds,
        progressByTechnologyId: normalizeNumberRecord(row.progressByTechnologyId, 0, Number.MAX_SAFE_INTEGER),
        lastScienceSpent:
          typeof row.lastScienceSpent === "number" && Number.isFinite(row.lastScienceSpent)
            ? Number(Math.max(0, row.lastScienceSpent).toFixed(3))
            : 0,
        lastCompletedTechnologyIds: normalizeCountryIdList(row.lastCompletedTechnologyIds),
      };
    }
    return normalized;
  }

  function normalizeCountryDecisionRecord(input: unknown): CountryDecisionRecord {
    const source = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
    const completedDecisionIds = normalizeCountryIdList(source.completedDecisionIds);
    const cooldownUntilTurnByDecisionId: Record<string, number> = {};
    if (source.cooldownUntilTurnByDecisionId && typeof source.cooldownUntilTurnByDecisionId === "object") {
      for (const [decisionId, rawTurn] of Object.entries(source.cooldownUntilTurnByDecisionId as Record<string, unknown>)) {
        const value = Number(rawTurn);
        if (!decisionId || !Number.isFinite(value)) continue;
        cooldownUntilTurnByDecisionId[decisionId] = Math.max(1, Math.floor(value));
      }
    }
    const usesByDecisionId = normalizePositiveNumberMap(source.usesByDecisionId, 120);
    const usesByDecisionTargetKey = normalizePositiveNumberMap(source.usesByDecisionTargetKey, 300);
    const chargesByDecisionId = normalizePositiveNumberMap(source.chargesByDecisionId, 120);
    const lastChargeTurnByDecisionId = normalizePositiveNumberMap(source.lastChargeTurnByDecisionId, 120);
    const history = Array.isArray(source.history)
      ? source.history
          .map((raw): CountryDecisionRecord["history"][number] | null => {
            if (!raw || typeof raw !== "object") return null;
            const row = raw as Record<string, unknown>;
            const decisionId = typeof row.decisionId === "string" ? row.decisionId.trim().slice(0, 120) : "";
            if (!decisionId) return null;
            return {
              decisionId,
              takenTurnId: Number.isFinite(Number(row.takenTurnId)) ? Math.max(1, Math.floor(Number(row.takenTurnId))) : turnId,
              label: typeof row.label === "string" && row.label.trim() ? row.label.trim().slice(0, 160) : decisionId,
              scopes: normalizeCountryEventScopes(row.scopes) ?? {},
              appliedEffects: normalizeEventEffectSummaries(row.appliedEffects),
              explanationIds: normalizeCountryIdList(row.explanationIds).slice(0, 40),
            };
          })
          .filter((row): row is CountryDecisionRecord["history"][number] => Boolean(row))
      : [];
    return {
      completedDecisionIds,
      cooldownUntilTurnByDecisionId,
      usesByDecisionId,
      usesByDecisionTargetKey,
      chargesByDecisionId,
      lastChargeTurnByDecisionId,
      history,
    };
  }

  function normalizePositiveNumberMap(input: unknown, maxEntries: number): Record<string, number> {
    const normalized: Record<string, number> = {};
    if (!input || typeof input !== "object") return normalized;
    for (const [key, raw] of Object.entries(input as Record<string, unknown>)) {
      if (!key || Object.keys(normalized).length >= maxEntries) continue;
      const value = Number(raw);
      if (!Number.isFinite(value) || value <= 0) continue;
      normalized[key.slice(0, 240)] = Math.floor(value);
    }
    return normalized;
  }

  function normalizeCountryDecisionsMap(input: unknown): WorldBase["countryDecisionsByCountryId"] {
    const normalized: WorldBase["countryDecisionsByCountryId"] = {};
    if (input && typeof input === "object") {
      for (const [countryId, raw] of Object.entries(input as Record<string, unknown>)) {
        if (!countryId) continue;
        normalized[countryId] = normalizeCountryDecisionRecord(raw);
      }
    }
    return normalized;
  }

  function normalizeCountryEventRecord(input: unknown): CountryEventRecord {
    const source = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
    const pending = Array.isArray(source.pending)
      ? source.pending
          .map((raw): CountryEventRecord["pending"][number] | null => {
            if (!raw || typeof raw !== "object") return null;
            const row = raw as Record<string, unknown>;
            const id = typeof row.id === "string" && row.id.trim() ? row.id.trim().slice(0, 120) : randomUUID();
            const eventId = typeof row.eventId === "string" && row.eventId.trim() ? row.eventId.trim().slice(0, 120) : "";
            const countryId = typeof row.countryId === "string" && row.countryId.trim() ? row.countryId.trim().slice(0, 120) : "";
            if (!eventId || !countryId) return null;
            const scopes = normalizeCountryEventScopes(row.scopes);
            const triggerExplanation = normalizeCountryEventTriggerExplanation(row.triggerExplanation);
            return {
              id,
              eventId,
              countryId,
              createdTurnId: Number.isFinite(Number(row.createdTurnId)) ? Math.max(1, Math.floor(Number(row.createdTurnId))) : turnId,
              expiresTurnId:
                Number.isFinite(Number(row.expiresTurnId)) && Number(row.expiresTurnId) > 0
                  ? Math.max(1, Math.floor(Number(row.expiresTurnId)))
                  : null,
              scopes,
              triggerExplanation,
            };
          })
          .filter((row): row is CountryEventRecord["pending"][number] => Boolean(row))
      : [];
    const cooldownUntilTurnByEventId: Record<string, number> = {};
    if (source.cooldownUntilTurnByEventId && typeof source.cooldownUntilTurnByEventId === "object") {
      for (const [eventId, rawTurn] of Object.entries(source.cooldownUntilTurnByEventId as Record<string, unknown>)) {
        const value = Number(rawTurn);
        if (!eventId || !Number.isFinite(value)) continue;
        cooldownUntilTurnByEventId[eventId] = Math.max(1, Math.floor(value));
      }
    }
    const history = Array.isArray(source.history)
      ? source.history
          .map((raw): CountryEventRecord["history"][number] | null => {
            if (!raw || typeof raw !== "object") return null;
            const row = raw as Record<string, unknown>;
            const eventId = typeof row.eventId === "string" ? row.eventId.trim().slice(0, 120) : "";
            const optionId = typeof row.optionId === "string" ? row.optionId.trim().slice(0, 120) : "";
            if (!eventId || !optionId) return null;
            return {
              eventId,
              optionId,
              resolvedTurnId: Number.isFinite(Number(row.resolvedTurnId)) ? Math.max(1, Math.floor(Number(row.resolvedTurnId))) : turnId,
              titleKey: typeof row.titleKey === "string" && row.titleKey.trim() ? row.titleKey.trim().slice(0, 160) : null,
              optionLabelKey:
                typeof row.optionLabelKey === "string" && row.optionLabelKey.trim()
                  ? row.optionLabelKey.trim().slice(0, 160)
                  : null,
              label: typeof row.label === "string" && row.label.trim() ? row.label.trim().slice(0, 160) : undefined,
              optionLabel: typeof row.optionLabel === "string" && row.optionLabel.trim() ? row.optionLabel.trim().slice(0, 160) : undefined,
              scopes: normalizeCountryEventScopes(row.scopes) ?? {},
              appliedEffects: normalizeEventEffectSummaries(row.appliedEffects),
              explanationIds: normalizeCountryIdList(row.explanationIds).slice(0, 40),
            };
          })
          .filter((row): row is CountryEventRecord["history"][number] => Boolean(row))
      : [];
    return {
      pending: pending.slice(0, 100),
      completedEventIds: normalizeCountryIdList(source.completedEventIds),
      cooldownUntilTurnByEventId,
      history: history.slice(0, 200),
    };
  }

  function normalizeCountryEventScopes(input: unknown): CountryEventRecord["pending"][number]["scopes"] {
    const source = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
    const normalized: NonNullable<CountryEventRecord["pending"][number]["scopes"]> = {};
    for (const [scopeId, raw] of Object.entries(source)) {
      if (!scopeId || !raw || typeof raw !== "object") continue;
      const row = raw as Record<string, unknown>;
      const kind = typeof row.kind === "string" ? row.kind.trim() : "";
      const id = typeof row.id === "string" ? row.id.trim().slice(0, 120) : "";
      if (!kind || !id) continue;
      normalized[scopeId.slice(0, 80)] = {
        kind: kind as NonNullable<CountryEventRecord["pending"][number]["scopes"]>[string]["kind"],
        id,
        labelKey: typeof row.labelKey === "string" && row.labelKey.trim() ? row.labelKey.trim().slice(0, 160) : null,
      };
    }
    return normalized;
  }

  function normalizeCountryEventTriggerExplanation(
    input: unknown,
  ): NonNullable<CountryEventRecord["pending"][number]["triggerExplanation"]> {
    if (!Array.isArray(input)) return [];
    return input
      .map((raw): NonNullable<CountryEventRecord["pending"][number]["triggerExplanation"]>[number] | null => {
        if (!raw || typeof raw !== "object") return null;
        const row = raw as Record<string, unknown>;
        const triggerId = typeof row.triggerId === "string" && row.triggerId.trim() ? row.triggerId.trim().slice(0, 120) : "";
        const labelKey = typeof row.labelKey === "string" && row.labelKey.trim() ? row.labelKey.trim().slice(0, 160) : "";
        if (!triggerId || !labelKey) return null;
        return {
          triggerId,
          passed: row.passed === true,
          value: normalizeCountryEventExplanationValue(row.value),
          threshold: normalizeCountryEventExplanationValue(row.threshold),
          affectedObject: (normalizeCountryEventScopes({ affected: row.affectedObject }) ?? {}).affected ?? null,
          labelKey,
        };
      })
      .filter((row): row is NonNullable<CountryEventRecord["pending"][number]["triggerExplanation"]>[number] => Boolean(row))
      .slice(0, 40);
  }

  function normalizeEventEffectSummaries(input: unknown): CountryEventRecord["history"][number]["appliedEffects"] {
    if (!Array.isArray(input)) return [];
    return input
      .map((raw): CountryEventRecord["history"][number]["appliedEffects"][number] | null => {
        if (!raw || typeof raw !== "object") return null;
        const row = raw as Record<string, unknown>;
        const type = typeof row.type === "string" && row.type.trim() ? row.type.trim().slice(0, 80) : "";
        if (!type) return null;
        const resource = typeof row.resource === "string" && RESOURCE_TOTAL_KEYS.includes(row.resource as keyof ResourceTotals)
          ? (row.resource as keyof ResourceTotals)
          : null;
        const amount = Number(row.amount);
        const direction = row.direction === "income" || row.direction === "expense" ? row.direction : null;
        return {
          type: type as CountryEventRecord["history"][number]["appliedEffects"][number]["type"],
          resource,
          amount: Number.isFinite(amount) ? Number(amount.toFixed(3)) : null,
          direction,
          eventId: typeof row.eventId === "string" && row.eventId.trim() ? row.eventId.trim().slice(0, 120) : null,
          journalEntryId: typeof row.journalEntryId === "string" && row.journalEntryId.trim() ? row.journalEntryId.trim().slice(0, 120) : null,
          flagId: typeof row.flagId === "string" && row.flagId.trim() ? row.flagId.trim().slice(0, 160) : null,
        };
      })
      .filter((item): item is CountryEventRecord["history"][number]["appliedEffects"][number] => Boolean(item))
      .slice(0, 30);
  }

  function normalizeCountryEventExplanationValue(input: unknown): number | string | boolean | null {
    if (typeof input === "number" && Number.isFinite(input)) return input;
    if (typeof input === "string") return input.trim().slice(0, 160);
    if (typeof input === "boolean") return input;
    return null;
  }

  function normalizeCountryEventsMap(input: unknown): WorldBase["countryEventsByCountryId"] {
    const normalized: WorldBase["countryEventsByCountryId"] = {};
    if (input && typeof input === "object") {
      for (const [countryId, raw] of Object.entries(input as Record<string, unknown>)) {
        if (!countryId) continue;
        normalized[countryId] = normalizeCountryEventRecord(raw);
      }
    }
    return normalized;
  }

  function normalizeScheduledCountryEventsMap(input: unknown): WorldBase["countryScheduledEventsByCountryId"] {
    const normalized: WorldBase["countryScheduledEventsByCountryId"] = {};
    if (!input || typeof input !== "object") return normalized;
    for (const [countryId, rawItems] of Object.entries(input as Record<string, unknown>)) {
      if (!countryId || !Array.isArray(rawItems)) continue;
      const items = rawItems
        .map((raw): WorldBase["countryScheduledEventsByCountryId"][string][number] | null => {
          if (!raw || typeof raw !== "object") return null;
          const row = raw as Record<string, unknown>;
          const eventId = typeof row.eventId === "string" && row.eventId.trim() ? row.eventId.trim().slice(0, 120) : "";
          const eventCountryId = typeof row.countryId === "string" && row.countryId.trim() ? row.countryId.trim().slice(0, 120) : countryId;
          const scheduledTurnId = Number(row.scheduledTurnId);
          if (!eventId || !eventCountryId || !Number.isFinite(scheduledTurnId)) return null;
          return {
            id: typeof row.id === "string" && row.id.trim() ? row.id.trim().slice(0, 120) : randomUUID(),
            eventId,
            countryId: eventCountryId,
            scheduledTurnId: Math.max(1, Math.floor(scheduledTurnId)),
            scopes: normalizeCountryEventScopes(row.scopes) ?? {},
            chainId: typeof row.chainId === "string" && row.chainId.trim() ? row.chainId.trim().slice(0, 120) : null,
            createdTurnId:
              Number.isFinite(Number(row.createdTurnId)) && Number(row.createdTurnId) > 0
                ? Math.max(1, Math.floor(Number(row.createdTurnId)))
                : null,
            triggerExplanation: normalizeCountryEventTriggerExplanation(row.triggerExplanation),
          };
        })
        .filter((item): item is WorldBase["countryScheduledEventsByCountryId"][string][number] => Boolean(item))
        .sort((a, b) => a.scheduledTurnId - b.scheduledTurnId || a.eventId.localeCompare(b.eventId))
        .slice(0, 200);
      if (items.length > 0) normalized[countryId] = items;
    }
    return normalized;
  }

  function normalizeCountryEventFlagsMap(input: unknown): WorldBase["countryEventFlagsByCountryId"] {
    const normalized: WorldBase["countryEventFlagsByCountryId"] = {};
    if (!input || typeof input !== "object") return normalized;
    for (const [countryId, rawFlags] of Object.entries(input as Record<string, unknown>)) {
      if (!countryId || !rawFlags || typeof rawFlags !== "object") continue;
      const flags: Record<string, string | number | boolean> = {};
      for (const [flagId, rawValue] of Object.entries(rawFlags as Record<string, unknown>)) {
        if (!flagId) continue;
        if (typeof rawValue === "string") flags[flagId.slice(0, 160)] = rawValue.slice(0, 160);
        if (typeof rawValue === "number" && Number.isFinite(rawValue)) flags[flagId.slice(0, 160)] = Number(rawValue.toFixed(3));
        if (typeof rawValue === "boolean") flags[flagId.slice(0, 160)] = rawValue;
      }
      if (Object.keys(flags).length > 0) normalized[countryId] = flags;
    }
    return normalized;
  }

  function normalizeJournalEntriesMap(input: unknown): WorldBase["journalEntriesByCountryId"] {
    const normalized: WorldBase["journalEntriesByCountryId"] = {};
    if (!input || typeof input !== "object") return normalized;
    for (const [countryId, raw] of Object.entries(input as Record<string, unknown>)) {
      if (!countryId || !raw || typeof raw !== "object") continue;
      normalized[countryId] = normalizeCountryJournalState(raw);
    }
    return normalized;
  }

  function normalizeCountryModifiersMap(input: unknown): WorldBase["countryModifiersByCountryId"] {
    const normalized: WorldBase["countryModifiersByCountryId"] = {};
    if (!input || typeof input !== "object") return normalized;
    for (const [countryId, rawItems] of Object.entries(input as Record<string, unknown>)) {
      if (!countryId || !Array.isArray(rawItems)) continue;
      const items = rawItems
        .map((raw): WorldBase["countryModifiersByCountryId"][string][number] | null => {
          if (!raw || typeof raw !== "object") return null;
          const row = raw as Record<string, unknown>;
          const modifierId = typeof row.modifierId === "string" && row.modifierId.trim() ? row.modifierId.trim().slice(0, 120) : "";
          const sourceId = typeof row.sourceId === "string" && row.sourceId.trim() ? row.sourceId.trim().slice(0, 160) : "";
          if (!modifierId || !sourceId) return null;
          const createdTurnId = Number(row.createdTurnId);
          const expiresTurnId = Number(row.expiresTurnId);
          return {
            id: typeof row.id === "string" && row.id.trim() ? row.id.trim().slice(0, 160) : randomUUID(),
            modifierId,
            countryId,
            sourceSystem:
              row.sourceSystem === "decision" || row.sourceSystem === "journal" || row.sourceSystem === "event"
                ? row.sourceSystem
                : "event",
            sourceId,
            createdTurnId: Number.isInteger(createdTurnId) && createdTurnId > 0 ? createdTurnId : turnId,
            expiresTurnId: Number.isInteger(expiresTurnId) && expiresTurnId > 0 ? expiresTurnId : null,
          };
        })
        .filter((item): item is WorldBase["countryModifiersByCountryId"][string][number] => Boolean(item))
        .sort((a, b) => a.createdTurnId - b.createdTurnId || a.id.localeCompare(b.id))
        .slice(-200);
      if (items.length > 0) normalized[countryId] = items;
    }
    return normalized;
  }

  function normalizeCountryJournalState(input: unknown): WorldBase["journalEntriesByCountryId"][string] {
    const source = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
    const active = Array.isArray(source.active)
      ? source.active
          .map((raw): WorldBase["journalEntriesByCountryId"][string]["active"][number] | null => {
            if (!raw || typeof raw !== "object") return null;
            const row = raw as Record<string, unknown>;
            const id = typeof row.id === "string" && row.id.trim() ? row.id.trim().slice(0, 120) : randomUUID();
            const journalEntryId =
              typeof row.journalEntryId === "string" && row.journalEntryId.trim() ? row.journalEntryId.trim().slice(0, 120) : "";
            const countryId = typeof row.countryId === "string" && row.countryId.trim() ? row.countryId.trim().slice(0, 120) : "";
            if (!journalEntryId || !countryId) return null;
            const progress = row.progress && typeof row.progress === "object" ? (row.progress as Record<string, unknown>) : {};
            const current = Number(progress.current);
            const target = Number(progress.target);
            const safeTarget = Number.isFinite(target) && target > 0 ? target : 1;
            const safeCurrent = Number.isFinite(current) ? Math.max(0, current) : 0;
            return {
              id,
              journalEntryId,
              countryId,
              startedTurnId: Number.isFinite(Number(row.startedTurnId)) ? Math.max(1, Math.floor(Number(row.startedTurnId))) : turnId,
              expiresTurnId:
                Number.isFinite(Number(row.expiresTurnId)) && Number(row.expiresTurnId) > 0
                  ? Math.max(1, Math.floor(Number(row.expiresTurnId)))
                  : null,
              state: "active",
              progress: {
                current: Number(safeCurrent.toFixed(3)),
                target: Number(safeTarget.toFixed(3)),
                percent: Number(Math.min(100, Math.max(0, (safeCurrent / safeTarget) * 100)).toFixed(3)),
                labelKey:
                  typeof progress.labelKey === "string" && progress.labelKey.trim()
                    ? progress.labelKey.trim().slice(0, 160)
                    : "journal.progress.manual",
                lastDelta:
                  Number.isFinite(Number(progress.lastDelta)) ? Number(Number(progress.lastDelta).toFixed(3)) : null,
              },
              scopes: normalizeCountryEventScopes(row.scopes) ?? {},
              variables: normalizeCountryEventFlagsMap({ row: row.variables }).row ?? {},
              lastUpdatedTurnId: Number.isFinite(Number(row.lastUpdatedTurnId))
                ? Math.max(1, Math.floor(Number(row.lastUpdatedTurnId)))
                : turnId,
              explanationIds: normalizeCountryIdList(row.explanationIds).slice(0, 40),
            };
          })
          .filter((item): item is WorldBase["journalEntriesByCountryId"][string]["active"][number] => Boolean(item))
          .slice(0, 100)
      : [];
    const cooldownUntilTurnByJournalEntryId: Record<string, number> = {};
    if (source.cooldownUntilTurnByJournalEntryId && typeof source.cooldownUntilTurnByJournalEntryId === "object") {
      for (const [journalEntryId, rawTurn] of Object.entries(source.cooldownUntilTurnByJournalEntryId as Record<string, unknown>)) {
        const value = Number(rawTurn);
        if (!journalEntryId || !Number.isFinite(value)) continue;
        cooldownUntilTurnByJournalEntryId[journalEntryId] = Math.max(1, Math.floor(value));
      }
    }
    const history = Array.isArray(source.history)
      ? source.history
          .map((raw): WorldBase["journalEntriesByCountryId"][string]["history"][number] | null => {
            if (!raw || typeof raw !== "object") return null;
            const row = raw as Record<string, unknown>;
            const journalEntryId =
              typeof row.journalEntryId === "string" && row.journalEntryId.trim() ? row.journalEntryId.trim().slice(0, 120) : "";
            const instanceId = typeof row.instanceId === "string" && row.instanceId.trim() ? row.instanceId.trim().slice(0, 120) : "";
            if (!journalEntryId || !instanceId) return null;
            const state = row.state === "failed" || row.state === "cancelled" ? row.state : "completed";
            return {
              journalEntryId,
              instanceId,
              state,
              startedTurnId: Number.isFinite(Number(row.startedTurnId)) ? Math.max(1, Math.floor(Number(row.startedTurnId))) : turnId,
              resolvedTurnId: Number.isFinite(Number(row.resolvedTurnId)) ? Math.max(1, Math.floor(Number(row.resolvedTurnId))) : turnId,
              scopes: normalizeCountryEventScopes(row.scopes) ?? {},
              outcomeLabelKey:
                typeof row.outcomeLabelKey === "string" && row.outcomeLabelKey.trim()
                  ? row.outcomeLabelKey.trim().slice(0, 160)
                  : "journal.outcome.completed",
              explanationIds: normalizeCountryIdList(row.explanationIds).slice(0, 40),
            };
          })
          .filter((item): item is WorldBase["journalEntriesByCountryId"][string]["history"][number] => Boolean(item))
          .slice(0, 200)
      : [];
    return {
      active,
      completedJournalEntryIds: normalizeCountryIdList(source.completedJournalEntryIds),
      failedJournalEntryIds: normalizeCountryIdList(source.failedJournalEntryIds),
      cooldownUntilTurnByJournalEntryId,
      history,
    };
  }

  const DIPLOMACY_PROPOSAL_STATUSES = new Set<DiplomacyProposalStatus>([
    "pending",
    "accepted",
    "renewal_pending",
    "rejected",
    "expired",
    "failed",
  ]);
  const TREATY_MONEY_RESOURCES = new Set<TreatyMoneyResource>(["ducats", "gold"]);
  const TREATY_MONEY_PAYMENT_CADENCES = new Set<TreatyMoneyPaymentCadence>(["once", "per_turn"]);

  function makeDefaultDiplomacyProposalName(fromCountryId: string, toCountryId: string, revision = 1): string {
    return `Договор ${fromCountryId} - ${toCountryId} #${Math.max(1, Math.floor(Number(revision) || 1))}`;
  }

  function normalizeDiplomacyProposalName(input: unknown, fromCountryId: string, toCountryId: string, revision = 1): string {
    if (typeof input === "string" && input.trim()) return input.trim().slice(0, 120);
    return makeDefaultDiplomacyProposalName(fromCountryId, toCountryId, revision);
  }

  function normalizeTreatyClauses(input: unknown): TreatyClause[] {
    if (!Array.isArray(input)) return [];
    return input
      .map((raw): TreatyClause | null => {
        if (!raw || typeof raw !== "object") return null;
        const row = raw as Record<string, unknown>;
        const id = typeof row.id === "string" && row.id.trim() ? row.id.trim().slice(0, 120) : randomUUID();
        const kind = typeof row.kind === "string" ? row.kind : "";
        if (kind === "transfer_money") {
          const fromCountryId = typeof row.fromCountryId === "string" ? row.fromCountryId.trim().slice(0, 120) : "";
          const toCountryId = typeof row.toCountryId === "string" ? row.toCountryId.trim().slice(0, 120) : "";
          const resourceRaw = typeof row.resource === "string" ? row.resource : "ducats";
          const resource = TREATY_MONEY_RESOURCES.has(resourceRaw as TreatyMoneyResource)
            ? (resourceRaw as TreatyMoneyResource)
            : "ducats";
          const amount = typeof row.amount === "number" && Number.isFinite(row.amount) ? Math.max(0, row.amount) : 0;
          const paymentCadenceRaw = typeof row.paymentCadence === "string" ? row.paymentCadence : "once";
          const paymentCadence = TREATY_MONEY_PAYMENT_CADENCES.has(paymentCadenceRaw as TreatyMoneyPaymentCadence)
            ? (paymentCadenceRaw as TreatyMoneyPaymentCadence)
            : "once";
          if (!fromCountryId || !toCountryId || amount <= 0) return null;
          return { id, kind, fromCountryId, toCountryId, resource, amount: Number(amount.toFixed(3)), paymentCadence };
        }
        if (kind === "transfer_region") {
          const fromCountryId = typeof row.fromCountryId === "string" ? row.fromCountryId.trim().slice(0, 120) : "";
          const toCountryId = typeof row.toCountryId === "string" ? row.toCountryId.trim().slice(0, 120) : "";
          const regionId = typeof row.regionId === "string" ? row.regionId.trim().slice(0, 120) : "";
          if (!fromCountryId || !toCountryId || !regionId) return null;
          return { id, kind, fromCountryId, toCountryId, regionId };
        }
        if (kind === "infrastructure_transit") {
          const fromCountryId = typeof row.fromCountryId === "string" ? row.fromCountryId.trim().slice(0, 120) : "";
          const toCountryId = typeof row.toCountryId === "string" ? row.toCountryId.trim().slice(0, 120) : "";
          const transportModes = normalizeGoodTransportModesList(row.transportModes, DEFAULT_TRADEABLE_TRANSPORT_MODES);
          if (!fromCountryId || !toCountryId || transportModes.length === 0) return null;
          return { id, kind, fromCountryId, toCountryId, transportModes };
        }
        if (kind === "infrastructure_construction_rights") {
          const fromCountryId = typeof row.fromCountryId === "string" ? row.fromCountryId.trim().slice(0, 120) : "";
          const toCountryId = typeof row.toCountryId === "string" ? row.toCountryId.trim().slice(0, 120) : "";
          const transportModes = normalizeGoodTransportModesList(row.transportModes, DEFAULT_TRADEABLE_TRANSPORT_MODES);
          if (!fromCountryId || !toCountryId || transportModes.length === 0) return null;
          return {
            id,
            kind,
            fromCountryId,
            toCountryId,
            transportModes,
            expirationPolicy: normalizeInfrastructureConstructionExpirationPolicy(row.expirationPolicy),
          };
        }
        if (kind === "text_note") {
          const text = typeof row.text === "string" ? row.text.trim().slice(0, 1000) : "";
          if (!text) return null;
          return { id, kind, text };
        }
        return null;
      })
      .filter((clause): clause is TreatyClause => Boolean(clause));
  }

  function normalizeDiplomacyProposals(input: unknown): DiplomacyProposal[] {
    if (!Array.isArray(input)) return [];
    return input
      .map((raw): DiplomacyProposal | null => {
        if (!raw || typeof raw !== "object") return null;
        const row = raw as Record<string, unknown>;
        const id = typeof row.id === "string" && row.id.trim() ? row.id.trim().slice(0, 120) : randomUUID();
        const fromCountryId = typeof row.fromCountryId === "string" ? row.fromCountryId.trim().slice(0, 120) : "";
        const toCountryId = typeof row.toCountryId === "string" ? row.toCountryId.trim().slice(0, 120) : "";
        if (!fromCountryId || !toCountryId || fromCountryId === toCountryId) return null;
        const statusRaw = typeof row.status === "string" ? row.status : "pending";
        const status = DIPLOMACY_PROPOSAL_STATUSES.has(statusRaw as DiplomacyProposalStatus)
          ? (statusRaw as DiplomacyProposalStatus)
          : "pending";
        const clauses = normalizeTreatyClauses(row.clauses);
        if (clauses.length === 0) return null;
        const createdTurnId =
          typeof row.createdTurnId === "number" && Number.isFinite(row.createdTurnId)
            ? Math.max(1, Math.floor(row.createdTurnId))
            : turnId;
        const expiresTurnId =
          typeof row.expiresTurnId === "number" && Number.isFinite(row.expiresTurnId)
            ? Math.max(createdTurnId, Math.floor(row.expiresTurnId))
            : createdTurnId + 3;
        const pendingResponderCountryId =
          typeof row.pendingResponderCountryId === "string" && row.pendingResponderCountryId.trim()
            ? row.pendingResponderCountryId.trim().slice(0, 120)
            : status === "pending"
              ? toCountryId
              : null;
        const lastEditedByCountryId =
          typeof row.lastEditedByCountryId === "string" && row.lastEditedByCountryId.trim()
            ? row.lastEditedByCountryId.trim().slice(0, 120)
            : fromCountryId;
        const revision = Math.max(1, Math.floor(Number(row.revision ?? 1) || 1));
        const name = normalizeDiplomacyProposalName(row.name, fromCountryId, toCountryId, revision);
        const revisionHistory = Array.isArray(row.revisionHistory)
          ? row.revisionHistory.flatMap((rawRevision): NonNullable<DiplomacyProposal["revisionHistory"]>[number][] => {
              if (!rawRevision || typeof rawRevision !== "object") return [];
              const revisionRow = rawRevision as Record<string, unknown>;
              const revisionClauses = normalizeTreatyClauses(revisionRow.clauses);
              const editedByCountryId = typeof revisionRow.editedByCountryId === "string" ? revisionRow.editedByCountryId.trim().slice(0, 120) : "";
              const sentToCountryId = typeof revisionRow.sentToCountryId === "string" ? revisionRow.sentToCountryId.trim().slice(0, 120) : "";
              if (!editedByCountryId || !sentToCountryId || revisionClauses.length === 0) return [];
              return [{
                revision: Math.max(1, Math.floor(Number(revisionRow.revision ?? 1) || 1)),
                editedByCountryId,
                sentToCountryId,
                turnId: Math.max(1, Math.floor(Number(revisionRow.turnId ?? createdTurnId) || createdTurnId)),
                createdAt: typeof revisionRow.createdAt === "string" && revisionRow.createdAt.trim() ? revisionRow.createdAt.trim() : new Date().toISOString(),
                expiresTurnId: Math.max(createdTurnId, Math.floor(Number(revisionRow.expiresTurnId ?? expiresTurnId) || expiresTurnId)),
                name: normalizeDiplomacyProposalName(revisionRow.name, fromCountryId, toCountryId, Math.max(1, Math.floor(Number(revisionRow.revision ?? 1) || 1))),
                clauses: revisionClauses,
              }];
            })
          : [];
        return {
          id,
          name,
          fromCountryId,
          toCountryId,
          createdTurnId,
          expiresTurnId,
          status,
          clauses,
          pendingResponderCountryId,
          lastEditedByCountryId,
          revision,
          revisionHistory,
          createdAt: typeof row.createdAt === "string" ? row.createdAt : new Date().toISOString(),
          resolvedAt: typeof row.resolvedAt === "string" ? row.resolvedAt : null,
          resolvedByCountryId: typeof row.resolvedByCountryId === "string" ? row.resolvedByCountryId : null,
          failureReason: typeof row.failureReason === "string" ? row.failureReason : null,
          renewalAcceptedByCountryIds: normalizeCountryIdList(row.renewalAcceptedByCountryIds),
        };
      })
      .filter((proposal): proposal is DiplomacyProposal => Boolean(proposal));
  }


  return {
    normalizeResourceTotals,
    normalizeResourcesByCountryMap,
    normalizeResourceLedgerByTurn,
    normalizeExplanationRecordsByTurn,
    normalizeTechnologyByCountryMap,
    normalizeCountryDecisionRecord,
    normalizeCountryDecisionsMap,
    normalizeCountryEventRecord,
    normalizeCountryEventsMap,
    normalizeScheduledCountryEventsMap,
    normalizeCountryEventFlagsMap,
    normalizeJournalEntriesMap,
    normalizeCountryModifiersMap,
    normalizeCountryJournalState,
    makeDefaultDiplomacyProposalName,
    normalizeDiplomacyProposalName,
    normalizeTreatyClauses,
    normalizeDiplomacyProposals,
  };
}

const RESOURCE_TOTAL_KEYS: Array<keyof ResourceTotals> = [
  "culture",
  "science",
  "religion",
  "colonization",
  "construction",
  "ducats",
  "gold",
];

function normalizeResourceFlowSourceType(input: unknown): ResourceFlow["sourceType"] {
  return input === "base" ||
    input === "building" ||
    input === "law" ||
    input === "technology" ||
    input === "event" ||
    input === "trade" ||
    input === "army" ||
    input === "diplomacy" ||
    input === "colonization" ||
    input === "construction" ||
    input === "customization" ||
    input === "modifier" ||
    input === "system"
    ? input
    : "system";
}

function normalizeExplanationSourceSystem(input: unknown): ExplanationRecord["sourceSystem"] {
  return input === "event" ||
    input === "decision" ||
    input === "journal" ||
    input === "economy" ||
    input === "technology" ||
    input === "construction" ||
    input === "diplomacy" ||
    input === "military"
    ? input
    : "event";
}

function normalizeFlatMetadata(input: unknown): Record<string, string | number | boolean | null> | undefined {
  if (!input || typeof input !== "object" || Array.isArray(input)) return undefined;
  const normalized: Record<string, string | number | boolean | null> = {};
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (!key) continue;
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean" || value === null) {
      normalized[key.slice(0, 80)] = value;
    }
  }
  return Object.keys(normalized).length > 0 ? normalized : undefined;
}
