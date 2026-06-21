import type { DecisionEffect, GameEffect, ResourceTotals } from "@arcanorum/shared";
import type { UiTextKey } from "../i18n/uiText";

type Translate = (key: UiTextKey, params?: Record<string, string | number>) => string;

export function formatGameEffectPreview(
  effect: DecisionEffect | GameEffect,
  t: Translate,
  resourceLabelKey: Record<keyof ResourceTotals, UiTextKey>,
): string {
  if (effect.type === "resource_delta") {
    const amount = effect.amount >= 0 ? `+${effect.amount}` : String(effect.amount);
    return `${amount} ${t(resourceLabelKey[effect.resource])}`;
  }
  if (effect.type === "add_resource" || effect.type === "spend_resource") {
    const amount = effect.type === "add_resource" ? `+${effect.amount}` : `-${effect.amount}`;
    return `${amount} ${t(resourceLabelKey[effect.resource])}`;
  }
  if (effect.type === "add_resource_flow") {
    const amount = effect.direction === "income" ? `+${effect.amount}` : `-${effect.amount}`;
    return `${amount} ${t(resourceLabelKey[effect.resource])}`;
  }
  if (effect.type === "trigger_event") return t("countryEvents.effectTriggerEvent", { eventId: effect.eventId });
  if (effect.type === "schedule_event") return t("countryEvents.effectScheduleEvent", { eventId: effect.eventId, turns: effect.delayTurns ?? 0 });
  if (effect.type === "cancel_event") return t("countryEvents.effectCancelEvent", { eventId: effect.eventId });
  if (effect.type === "set_event_flag") return t("countryEvents.effectSetFlag", { flagId: effect.flagId });
  if (effect.type === "clear_event_flag") return t("countryEvents.effectClearFlag", { flagId: effect.flagId });
  if (effect.type === "add_modifier") return t("countryEvents.effectAddModifier", { modifierId: effect.modifierId, turns: effect.durationTurns ?? 0 });
  if (effect.type === "remove_modifier") return t("countryEvents.effectRemoveModifier", { modifierId: effect.modifierId });
  if (effect.type === "extend_modifier") return t("countryEvents.effectExtendModifier", { modifierId: effect.modifierId, turns: effect.durationTurns });
  if (effect.type === "start_journal_entry") return t("countryEvents.effectStartJournal", { journalEntryId: effect.journalEntryId });
  if (effect.type === "advance_journal_entry") return t("countryEvents.effectAdvanceJournal", { journalEntryId: effect.journalEntryId, amount: effect.amount });
  if (effect.type === "complete_journal_entry") return t("countryEvents.effectCompleteJournal", { journalEntryId: effect.journalEntryId });
  if (effect.type === "fail_journal_entry") return t("countryEvents.effectFailJournal", { journalEntryId: effect.journalEntryId });
  if (effect.type === "cancel_journal_entry") return t("countryEvents.effectCancelJournal", { journalEntryId: effect.journalEntryId });
  if (effect.type === "set_journal_variable") return t("countryEvents.effectSetJournalVariable", { journalEntryId: effect.journalEntryId, variableId: effect.variableId });
  if (effect.type === "clear_journal_variable") return t("countryEvents.effectClearJournalVariable", { journalEntryId: effect.journalEntryId, variableId: effect.variableId });
  if (effect.type === "change_colonization_progress") return t("countryEvents.effectChangeColonizationProgress", { amount: effect.amount });
  return t("countryEvents.effectFallback");
}
