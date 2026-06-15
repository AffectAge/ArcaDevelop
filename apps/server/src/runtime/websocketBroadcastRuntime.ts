import { WebSocket, type WebSocketServer } from "ws";
import type { WsOutMessage } from "@arcanorum/shared";

export function broadcast(wsServer: WebSocketServer, message: WsOutMessage): void {
  const payload = JSON.stringify(message);
  wsServer.clients.forEach((client) => {
    if (client.readyState !== WebSocket.OPEN) return;
    const meta = client as WebSocket & { __arcIsAdmin?: boolean; __arcCountryId?: string };
    // WS broadcast path is gameplay-only: send only to authenticated sockets.
    if (!meta.__arcCountryId) return;
    if (message.type === "NEWS_EVENT" && message.event.visibility === "private") {
      const targetCountryId = message.event.countryId ?? null;
      const isTargetCountry = targetCountryId != null && meta.__arcCountryId === targetCountryId;
      const isAdmin = Boolean(meta.__arcIsAdmin);
      if (!isTargetCountry && !isAdmin) {
        return;
      }
    }
    client.send(payload);
  });
}

export function broadcastTurnResolveStarted(
  wsServer: WebSocketServer,
  turnId: number,
  reason: "manual" | "admin" | "auto",
): void {
  broadcast(wsServer, { type: "TURN_RESOLVE_STARTED", turnId, reason });
}

export function getOnlineCountryIdsFromSockets(wsServer: WebSocketServer): Set<string> {
  const ids = new Set<string>();
  wsServer.clients.forEach((client) => {
    if (client.readyState !== WebSocket.OPEN) return;
    const meta = client as WebSocket & { __arcCountryId?: string };
    if (meta.__arcCountryId) ids.add(meta.__arcCountryId);
  });
  return ids;
}
