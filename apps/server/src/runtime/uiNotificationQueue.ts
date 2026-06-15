import type { WsOutMessage } from "@arcanorum/shared";

export type UiNotification = Extract<WsOutMessage, { type: "UI_NOTIFY" }>["notification"];

export type QueuedUiNotification = {
  audience: "all" | "admins" | { type: "country"; countryId: string };
  notification: UiNotification;
  viewedByCountryIds: Set<string>;
};

export type UiNotificationQueue = ReturnType<typeof createUiNotificationQueue>;

export function createUiNotificationQueue(maxEntries: number) {
  const queue: QueuedUiNotification[] = [];
  const limit = Math.max(1, Math.floor(maxEntries));

  const enqueue = (notification: UiNotification, audience: QueuedUiNotification["audience"]): void => {
    if (notification.action.type === "country-event") {
      const action = notification.action;
      for (let i = queue.length - 1; i >= 0; i -= 1) {
        const queuedAction = queue[i]?.notification.action;
        if (
          queuedAction?.type === "country-event" &&
          queuedAction.countryId === action.countryId &&
          queuedAction.eventId === action.eventId &&
          queuedAction.pendingId !== action.pendingId
        ) {
          queue.splice(i, 1);
        }
      }
    }

    const existingIndex = queue.findIndex((item) => item.notification.id === notification.id);
    if (existingIndex >= 0) {
      queue[existingIndex] = {
        ...queue[existingIndex],
        audience,
        notification,
      };
      return;
    }

    queue.unshift({
      audience,
      notification,
      viewedByCountryIds: new Set<string>(),
    });
    if (queue.length > limit) {
      queue.length = limit;
    }
  };

  const isVisibleForCountry = (
    item: QueuedUiNotification,
    params: { countryId: string; isAdmin: boolean },
  ): boolean => {
    if (item.audience === "all") return true;
    if (item.audience === "admins") return params.isAdmin;
    return item.audience.countryId === params.countryId;
  };

  const remove = (notificationId: string): void => {
    const index = queue.findIndex((item) => item.notification.id === notificationId);
    if (index >= 0) queue.splice(index, 1);
  };

  const prune = (isStillPending: (notification: UiNotification) => boolean): void => {
    for (let i = queue.length - 1; i >= 0; i -= 1) {
      const item = queue[i];
      if (!item) continue;
      if (!isStillPending(item.notification)) queue.splice(i, 1);
    }
  };

  const getPendingForCountry = (
    params: { countryId: string; isAdmin: boolean },
    isStillPending: (notification: UiNotification) => boolean,
  ): UiNotification[] => {
    prune(isStillPending);
    return queue
      .filter(
        (item) =>
          isVisibleForCountry(item, params) &&
          !item.viewedByCountryIds.has(params.countryId) &&
          isStillPending(item.notification),
      )
      .map((item) => item.notification);
  };

  const find = (notificationId: string): QueuedUiNotification | null =>
    queue.find((item) => item.notification.id === notificationId) ?? null;

  return {
    enqueue,
    isVisibleForCountry,
    remove,
    prune,
    getPendingForCountry,
    find,
  };
}
