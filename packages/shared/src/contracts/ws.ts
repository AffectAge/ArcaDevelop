import type { EventLogEntry } from "./content";
import type { Order, OrderDelta } from "./orders";
import type { CountryParliamentParty } from "./politics";
import type { WorldBase, WorldDelta } from "./world";
export type WsInMessage =
  | { type: "AUTH"; token: string; lastKnownWorldStateVersion?: number }
  | OrderDelta
  | { type: "PING" }
  | { type: "WORLD_DELTA_ACK"; worldStateVersion: number }
  | { type: "WORLD_DELTA_REPLAY_REQUEST"; fromWorldStateVersion: number }
  | { type: "REQUEST_RESOLVE" }
  | { type: "ADMIN_FORCE_RESOLVE" };

export type WsOutMessage =
  | { type: "CONNECTED"; serverTime: string }
  | { type: "AUTH_OK"; playerId: string; countryId: string; isAdmin: boolean; worldBase?: WorldBase; turnId: number; worldStateVersion: number; replayFromWorldStateVersion?: number; clientSettings?: { eventLogRetentionTurns: number } }
  | { type: "SCENARIO_APPLIED"; scenarioId: string; scenarioName: string; turnId: number; worldStateVersion: number }
  | { type: "ORDER_BROADCAST"; order: Order }
  | { type: "TURN_RESOLVE_STARTED"; turnId: number; reason: "manual" | "admin" | "auto" }
  | { type: "NEWS_EVENT"; event: EventLogEntry }
  | {
      type: "UI_NOTIFY";
      notification: {
        id: string;
        category: "registration" | "system" | "politics" | "economy" | "diplomacy";
        createdAt: string;
        title?: string | null;
        message?: string | null;
        quickActions?: Array<{
          id: string;
          label: string;
          kind?: "primary" | "secondary" | "danger";
        }>;
        action:
          | {
              type: "registration-approval";
              country: {
                id: string;
                name: string;
                color: string;
                flagUrl?: string | null;
                crestUrl?: string | null;
              };
            }
          | {
              type: "message";
            }
          | {
              type: "country-event";
              countryId: string;
              pendingId: string;
              eventId: string;
            }
          | {
              type: "election-results";
              countryId: string;
              turnId: number;
              seatsTotal: number;
              partySeats: CountryParliamentParty[];
              governmentPartyIds: string[];
            }
          | {
              type: "diplomacy-proposal";
              proposalId: string;
              countryId: string;
              revision?: number;
              quickAction?: "accept" | "reject" | "revise";
            };
      };
    }
  | { type: "ERROR"; code: string; message: string }
  | { type: "PONG" }
  | { type: "PRESENCE"; onlinePlayerIds: string[] }
  | WorldDelta;
