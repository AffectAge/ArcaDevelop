import type { ResourceTotals } from "@arcanorum/shared";
import { describe, expect, it } from "vitest";
import type { UiTextKey } from "../i18n/uiText";
import { formatGameEffectPreview } from "./gameEffectPreview";

const RESOURCE_LABEL_KEY: Record<keyof ResourceTotals, UiTextKey> = {
  culture: "decisions.resource.culture",
  science: "decisions.resource.science",
  religion: "decisions.resource.religion",
  colonization: "decisions.resource.colonization",
  construction: "decisions.resource.construction",
  ducats: "decisions.resource.ducats",
  gold: "decisions.resource.gold",
};

describe("formatGameEffectPreview", () => {
  it("formats resource, event-control, and journal-control effects", () => {
    const t = (key: UiTextKey, params?: Record<string, string | number>) =>
      `${key}${params ? `:${Object.values(params).join(":")}` : ""}`;

    expect(formatGameEffectPreview({ type: "resource_delta", resource: "gold", amount: 2 }, t, RESOURCE_LABEL_KEY)).toBe("+2 decisions.resource.gold");
    expect(formatGameEffectPreview({ type: "trigger_event", eventId: "event:test" }, t, RESOURCE_LABEL_KEY)).toBe("countryEvents.effectTriggerEvent:event:test");
    expect(formatGameEffectPreview({ type: "advance_journal_entry", journalEntryId: "journal:test", amount: 3 }, t, RESOURCE_LABEL_KEY)).toBe("countryEvents.effectAdvanceJournal:journal:test:3");
    expect(formatGameEffectPreview({ type: "add_modifier", modifierId: "modifier:test", durationTurns: 4 }, t, RESOURCE_LABEL_KEY)).toBe("countryEvents.effectAddModifier:modifier:test:4");
    expect(formatGameEffectPreview({ type: "change_colonization_progress", amount: 5 }, t, RESOURCE_LABEL_KEY)).toBe("countryEvents.effectChangeColonizationProgress:5");
  });
});
