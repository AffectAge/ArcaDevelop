import { AnimatePresence, motion } from "framer-motion";
import { Bell, Handshake, Landmark, ScrollText, ShieldAlert } from "lucide-react";
import { useUiText } from "../i18n/useUiText";
import type { UiTextKey } from "../i18n/uiText";

export type InAppUiNotification = {
  id: string;
  category: "registration" | "system" | "politics" | "economy" | "diplomacy";
  createdAt: string;
  receivedTurnId?: number;
  title?: string | null;
  message?: string | null;
  quickActions?: Array<{ id: string; label: string; kind?: "primary" | "secondary" | "danger" }>;
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
        partySeats: Array<{ partyId: string; seats: number; voteShare: number; ideologySupport: number }>;
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

type Props = {
  items: InAppUiNotification[];
  viewedIds?: ReadonlySet<string>;
  topOffsetPx?: number;
  onClickItem: (item: InAppUiNotification) => void;
  onQuickAction?: (item: InAppUiNotification, actionId: string) => void;
  historyCount?: number;
  pendingDecisionCount?: number;
  onOpenHistory?: () => void;
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

function colorForCategory(category: InAppUiNotification["category"]) {
  switch (category) {
    case "registration":
      return "arc-notification-chip--registration";
    case "politics":
      return "arc-notification-chip--politics";
    case "economy":
      return "arc-notification-chip--economy";
    case "diplomacy":
      return "arc-notification-chip--diplomacy";
    default:
      return "arc-notification-chip--system";
  }
}

function quickActionClass(kind?: "primary" | "secondary" | "danger") {
  if (kind === "danger") return "arc-notification-quick arc-notification-quick--danger";
  if (kind === "primary") return "arc-notification-quick arc-notification-quick--primary";
  return "arc-notification-quick";
}

function notificationFallbackKey(item: InAppUiNotification): UiTextKey {
  if (item.action.type === "registration-approval") return "notifications.fallback.registration";
  if (item.action.type === "country-event") return "notifications.fallback.countryEvent";
  if (item.action.type === "election-results") return "notifications.fallback.electionResults";
  if (item.action.type === "diplomacy-proposal") return "notifications.fallback.diplomacy";
  return "notifications.fallback.generic";
}

function notificationText(item: InAppUiNotification, t: (key: UiTextKey, params?: Record<string, string | number>) => string): string {
  if (item.title && item.message) return `${item.title}: ${item.message}`;
  if (item.title || item.message) return item.title ?? item.message ?? "";
  if (item.action.type === "registration-approval") {
    return t("notifications.registrationRequest", { country: item.action.country.name });
  }
  if (item.action.type === "election-results") {
    return t("notifications.electionResults", { seats: item.action.seatsTotal });
  }
  return t(notificationFallbackKey(item));
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

export function InAppNotificationTray({
  items,
  viewedIds,
  topOffsetPx = 72,
  onClickItem,
  onQuickAction,
  historyCount = 0,
  pendingDecisionCount = 0,
  onOpenHistory,
}: Props) {
  const { t } = useUiText();
  const showHistoryButton = historyCount > 0 && Boolean(onOpenHistory);
  return (
    <div className="pointer-events-none absolute left-4 z-[110]" style={{ top: topOffsetPx }}>
      <div className="flex max-w-[min(78vw,720px)] items-start justify-start gap-2">
        {showHistoryButton && (
          <motion.div
            layout
            initial={{ opacity: 0, y: 18, x: 8, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, x: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, x: -8, scale: 0.94 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="pointer-events-auto"
          >
            <button
              type="button"
              onClick={onOpenHistory}
              className={`arc-notification-chip group ${pendingDecisionCount > 0 ? "arc-notification-chip--registration" : "arc-notification-chip--system"}`}
              aria-label={t("notifications.openHistory")}
            >
              <Bell
                size={17}
                className="pointer-events-none absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 transition-all duration-200 group-hover:left-3 group-hover:top-[14px] group-hover:translate-x-0 group-hover:translate-y-0"
              />
              <span className="relative z-10 ml-6 min-w-0">
                <span className="block max-w-0 overflow-hidden whitespace-nowrap text-xs font-medium opacity-0 transition-all duration-200 group-hover:max-w-[170px] group-hover:opacity-100">
                  {t("notifications.history")}
                </span>
                <span className="arc-notification-chip-description block max-h-0 max-w-[170px] overflow-hidden text-[10px] leading-3 opacity-0 transition-all duration-200 group-hover:mt-0.5 group-hover:max-h-8 group-hover:opacity-100">
                  {t("notifications.openHistoryDescription")}
                </span>
              </span>
            </button>
          </motion.div>
        )}
        <div className="flex max-w-[min(70vw,560px)] flex-row-reverse items-start justify-start gap-2">
        <AnimatePresence initial={false}>
          {items.map((item) => {
            const Icon = iconForCategory(item.category);
            const colorClass = colorForCategory(item.category);
            const isUnread = !viewedIds?.has(item.id);
            const label = t(categoryLabelKey(item.category));
            const hoverText = notificationText(item, t);
            return (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, y: 18, x: 14, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, x: 0, scale: 1 }}
                exit={{ opacity: 0, y: 12, x: -14, scale: 0.9 }}
                transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                className="pointer-events-auto"
              >
                <button
                  type="button"
                  onClick={() => onClickItem(item)}
                  className={`arc-notification-chip group ${colorClass} ${isUnread ? "arc-notification-chip--unread" : ""}`}
                  aria-label={hoverText}
                >
                  <Icon
                    size={17}
                    className="pointer-events-none absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 transition-all duration-200 group-hover:left-3 group-hover:top-[14px] group-hover:translate-x-0 group-hover:translate-y-0"
                  />
                  <span className="relative z-10 ml-6 min-w-0">
                    <span className="block max-w-0 overflow-hidden whitespace-nowrap text-xs font-medium opacity-0 transition-all duration-200 group-hover:max-w-[180px] group-hover:opacity-100">
                      {label}
                    </span>
                    <span className="arc-scrollbar arc-notification-chip-description block max-h-0 max-w-[200px] overflow-hidden text-[10px] leading-3 opacity-0 transition-all duration-200 group-hover:mt-0.5 group-hover:max-h-[56px] group-hover:overflow-y-auto group-hover:opacity-100">
                      {hoverText}
                    </span>
                    {item.quickActions && item.quickActions.length > 0 && (
                      <span className="mt-1 hidden gap-1 group-hover:flex">
                        {item.quickActions.slice(0, 3).map((action) => (
                          <span
                            key={action.id}
                            role="button"
                            tabIndex={0}
                            onClick={(event) => {
                              event.stopPropagation();
                              onQuickAction?.(item, action.id);
                            }}
                            onKeyDown={(event) => {
                              if (event.key !== "Enter" && event.key !== " ") return;
                              event.preventDefault();
                              event.stopPropagation();
                              onQuickAction?.(item, action.id);
                            }}
                            className={quickActionClass(action.kind)}
                          >
                            {action.label}
                          </span>
                        ))}
                      </span>
                    )}
                  </span>
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
