import { randomUUID } from "node:crypto";
import type { EventCategory, EventLogEntry, EventPriority, EventVisibility } from "@arcanorum/shared";

type OfficialNewsParams = {
  turn: number;
  category: EventCategory;
  title?: string;
  message: string;
  countryId?: string | null;
  priority?: EventPriority;
  visibility?: EventVisibility;
};

export function makeOfficialNews(params: OfficialNewsParams): EventLogEntry {
  return {
    id: randomUUID(),
    turn: params.turn,
    timestamp: new Date().toISOString(),
    category: params.category,
    priority: params.priority ?? "medium",
    visibility: params.visibility ?? "public",
    title: params.title ?? null,
    message: params.message,
    countryId: params.countryId ?? null,
  };
}
