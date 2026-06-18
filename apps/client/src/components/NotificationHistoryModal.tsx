import { Bell, Handshake, Landmark, ScrollText, ShieldAlert, Trash2 } from "lucide-react";
import type { InAppUiNotification } from "./InAppNotificationTray";
import { AppModal, AppModalHeader } from "./ui/AppModal";
import { AppEmptyState } from "./ui/AppSurface";
import { useUiText } from "../i18n/useUiText";
import type { UiTextKey } from "../i18n/uiText";

type Props = {
  open: boolean;
  items: InAppUiNotification[];
  viewedIds?: ReadonlySet<string>;
  onClose: () => void;
  onOpenItem?: (item: InAppUiNotification) => void;
  onDeleteItem?: (item: InAppUiNotification) => void;
};

function iconForCategory(category: InAppUiNotification["category"]) {
  switch (category) {
    case "registration":
      return ShieldAlert;
    case "politics":
      return ScrollText;
    case "economy":
      return Landmark;
    case "diplomacy":
      return Handshake;
    default:
      return Bell;
  }
}

function categoryLabelKey(category: InAppUiNotification["category"]): UiTextKey {
  switch (category) {
    case "registration":
      return "notifications.category.registration";
    case "politics":
      return "notifications.category.politics";
    case "economy":
      return "notifications.category.economy";
    case "diplomacy":
      return "notifications.category.diplomacy";
    default:
      return "notifications.category.system";
  }
}

function itemText(item: InAppUiNotification, t: (key: UiTextKey, params?: Record<string, string | number>) => string): string {
  if (item.action.type === "registration-approval") {
    return item.title || item.message ? [item.title, item.message].filter(Boolean).join(": ") : t("notifications.registrationRequest", { country: item.action.country.name });
  }
  if (item.action.type === "country-event") {
    return item.title && item.message ? `${item.title}: ${item.message}` : item.title ?? item.message ?? t("notifications.fallback.countryEvent");
  }
  if (item.action.type === "election-results") {
    return item.title && item.message ? `${item.title}: ${item.message}` : item.title ?? item.message ?? t("notifications.electionResults", { seats: item.action.seatsTotal });
  }
  if (item.action.type === "diplomacy-proposal") {
    return item.title && item.message ? `${item.title}: ${item.message}` : item.title ?? item.message ?? t("notifications.fallback.diplomacy");
  }
  if (item.title && item.message) return `${item.title}: ${item.message}`;
  return item.title ?? item.message ?? t("notifications.fallback.generic");
}

function categoryColor(category: InAppUiNotification["category"]): string {
  switch (category) {
    case "registration":
      return "arc-notification-history-icon--registration";
    case "politics":
      return "arc-notification-history-icon--politics";
    case "economy":
      return "arc-notification-history-icon--economy";
    case "diplomacy":
      return "arc-notification-history-icon--diplomacy";
    default:
      return "arc-notification-history-icon--system";
  }
}

export function NotificationHistoryModal({ open, items, viewedIds, onClose, onOpenItem, onDeleteItem }: Props) {
  const { t } = useUiText();
  return (
    <AppModal
      modalKey="notifications"
      open={open}
      onClose={onClose}
      zIndexClassName="z-[132]"
      panelClassName="arc-notification-history-panel h-auto w-full max-w-4xl"
      paddingClassName="p-3 pt-24 md:p-4 md:pt-24 flex items-start justify-center"
    >
      <AppModalHeader title={t("notifications.history")} description={t("notifications.total", { count: items.length })} onClose={onClose} />

            <div className="arc-scrollbar arc-notification-history-list">
              {items.length === 0 && <AppEmptyState>{t("notifications.emptyHistory")}</AppEmptyState>}
              {items.map((item) => {
                const Icon = iconForCategory(item.category);
                const isViewed = viewedIds?.has(item.id) ?? false;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onOpenItem?.(item)}
                    className="arc-notification-history-row"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0 flex flex-1 items-center gap-3">
                        <span className={`arc-notification-history-icon ${categoryColor(item.category)}`}>
                        <Icon size={16} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="arc-notification-history-category">{t(categoryLabelKey(item.category))}</span>
                                <span className={`arc-notification-history-state ${isViewed ? "arc-notification-history-state--viewed" : "arc-notification-history-state--new"}`}>
                                  {t(isViewed ? "notifications.viewed" : "notifications.new")}
                                </span>
                              </div>
                              <div className="mt-1 break-words text-sm text-[var(--arc-color-atlas-ink)]">{itemText(item, t)}</div>
                              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[var(--arc-color-atlas-muted)]">
                                <span>{new Date(item.createdAt).toLocaleString()}</span>
                                <span>{t("notifications.receivedTurn", { turn: item.receivedTurnId ?? "?" })}</span>
                              </div>
                            </div>
                            {(item.action.type === "registration-approval" || item.action.type === "country-event" || item.action.type === "diplomacy-proposal") && (
                              <span className="arc-notification-history-decision">{t("notifications.requiresDecision")}</span>
                            )}
                            {onDeleteItem ? (
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  onDeleteItem(item);
                                }}
                                className="arc-notification-history-delete"
                                aria-label={t("notifications.delete")}
                              >
                                <Trash2 size={14} />
                              </button>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
    </AppModal>
  );
}
