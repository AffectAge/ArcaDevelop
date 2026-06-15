import { createUiNotificationQueue } from "./uiNotificationQueue";

const MAX_UI_NOTIFICATION_QUEUE = 500;

export function createServerSessionStateRuntime(): {
  onlinePlayers: Set<string>;
  lastLoginAtByCountryId: Map<string, string>;
  uiNotificationQueue: ReturnType<typeof createUiNotificationQueue>;
} {
  return {
    onlinePlayers: new Set<string>(),
    lastLoginAtByCountryId: new Map<string, string>(),
    uiNotificationQueue: createUiNotificationQueue(MAX_UI_NOTIFICATION_QUEUE),
  };
}
