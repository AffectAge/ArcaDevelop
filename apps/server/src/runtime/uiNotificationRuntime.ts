import { WebSocket, WebSocketServer } from "ws";
import type { WsOutMessage, WorldBase } from "@arcanorum/shared";
import type { QueuedUiNotification } from "./uiNotificationQueue";

type UiNotification = Extract<WsOutMessage, { type: "UI_NOTIFY" }>["notification"];

type UiNotificationRuntimeParams = {
  getWorldBase: () => WorldBase;
  enqueue: (notification: UiNotification, audience: QueuedUiNotification["audience"]) => void;
  remove: (notificationId: string) => void;
  isVisibleForCountry: (item: QueuedUiNotification, params: { countryId: string; isAdmin: boolean }) => boolean;
  findQueued: (notificationId: string) => QueuedUiNotification | null | undefined;
  normalizeCountryEventRecord: (input: unknown) => WorldBase["countryEventsByCountryId"][string];
  broadcast: (server: WebSocketServer, message: WsOutMessage) => void;
};

export function createUiNotificationRuntime(params: UiNotificationRuntimeParams) {
  function sendUiNotificationToSocket(socket: WebSocket, notification: UiNotification): void {
    if (socket.readyState !== WebSocket.OPEN) return;
    socket.send(JSON.stringify({ type: "UI_NOTIFY", notification } satisfies WsOutMessage));
  }

  function enqueueUiNotification(notification: UiNotification, audience: QueuedUiNotification["audience"]): void {
    params.enqueue(notification, audience);
  }

  function isQueuedUiNotificationVisibleForCountry(
    item: QueuedUiNotification,
    visibilityParams: { countryId: string; isAdmin: boolean },
  ): boolean {
    return params.isVisibleForCountry(item, visibilityParams);
  }

  function removeQueuedUiNotification(notificationId: string): void {
    params.remove(notificationId);
  }

  function isCountryEventNotificationStillPending(notification: UiNotification): boolean {
    const action = notification.action;
    const worldBase = params.getWorldBase();
    if (action.type === "diplomacy-proposal") {
      const proposal = worldBase.diplomacyProposals.find((entry) => entry.id === action.proposalId);
      return Boolean(
        proposal &&
          proposal.status === "pending" &&
          proposal.pendingResponderCountryId === action.countryId &&
          Math.max(1, Math.floor(Number(proposal.revision ?? 1) || 1)) ===
            Math.max(1, Math.floor(Number(action.revision ?? 1) || 1)),
      );
    }
    if (action.type !== "country-event") return true;
    const record = worldBase.countryEventsByCountryId[action.countryId];
    if (!record) return false;
    const normalized = params.normalizeCountryEventRecord(record);
    worldBase.countryEventsByCountryId[action.countryId] = normalized;
    return normalized.pending.some((pending) => pending.id === action.pendingId && pending.eventId === action.eventId);
  }

  function sendUiNotificationToAdmins(wsServer: WebSocketServer, notification: UiNotification): void {
    enqueueUiNotification(notification, "admins");
    wsServer.clients.forEach((client) => {
      if (client.readyState !== WebSocket.OPEN) return;
      const meta = client as WebSocket & { __arcIsAdmin?: boolean };
      if (!meta.__arcIsAdmin) return;
      sendUiNotificationToSocket(client, notification);
    });
  }

  function broadcastUiNotification(wsServer: WebSocketServer, notification: UiNotification): void {
    enqueueUiNotification(notification, "all");
    params.broadcast(wsServer, { type: "UI_NOTIFY", notification });
  }

  function sendUiNotificationToCountry(
    wsServer: WebSocketServer,
    countryId: string,
    notification: UiNotification,
  ): void {
    enqueueUiNotification(notification, { type: "country", countryId });
    wsServer.clients.forEach((client) => {
      if (client.readyState !== WebSocket.OPEN) return;
      const meta = client as WebSocket & { __arcCountryId?: string };
      if (meta.__arcCountryId !== countryId) return;
      sendUiNotificationToSocket(client, notification);
    });
  }

  function sendPendingNotificationsToSocket(
    socket: WebSocket,
    notifications: UiNotification[],
    audience: QueuedUiNotification["audience"],
    viewerCountryId: string,
  ): void {
    for (const notification of notifications) {
      enqueueUiNotification(notification, audience);
      const queued = params.findQueued(notification.id);
      if (queued?.viewedByCountryIds.has(viewerCountryId)) continue;
      sendUiNotificationToSocket(socket, notification);
    }
  }

  return {
    broadcastUiNotification,
    enqueueUiNotification,
    isCountryEventNotificationStillPending,
    isQueuedUiNotificationVisibleForCountry,
    removeQueuedUiNotification,
    sendPendingNotificationsToSocket,
    sendUiNotificationToAdmins,
    sendUiNotificationToCountry,
    sendUiNotificationToSocket,
  };
}
