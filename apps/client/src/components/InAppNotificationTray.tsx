import { AnimatePresence, motion } from "framer-motion";
import { Bell, Handshake, Landmark, ScrollText, ShieldAlert } from "lucide-react";

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
      return "text-rose-300 border-rose-900/80";
    case "politics":
      return "text-sky-300 border-sky-400/70";
    case "economy":
      return "text-emerald-500 border-emerald-400/70";
    case "diplomacy":
      return "text-amber-200 border-amber-400/70";
    default:
      return "text-slate-200 border-slate-400/70";
  }
}

function glowColorForCategory(category: InAppUiNotification["category"]) {
  switch (category) {
    case "registration":
      return "rgba(127, 29, 29, 0.55)";
    case "politics":
      return "rgba(56, 189, 248, 0.55)";
    case "economy":
      return "rgba(52, 211, 153, 0.55)";
    case "diplomacy":
      return "rgba(251, 191, 36, 0.55)";
    default:
      return "rgba(148, 163, 184, 0.4)";
  }
}

function tooltipText(item: InAppUiNotification): string {
  if (item.action.type === "registration-approval") {
    return `Заявка на регистрацию: ${item.action.country.name}`;
  }
  if (item.action.type === "country-event") {
    return item.title && item.message ? `${item.title}: ${item.message}` : item.title ?? "Новое событие";
  }
  if (item.action.type === "election-results") {
    return item.title && item.message ? `${item.title}: ${item.message}` : `Результаты выборов: сформирован парламент на ${item.action.seatsTotal} мест`;
  }
  if (item.action.type === "diplomacy-proposal") {
    return item.title && item.message ? `${item.title}: ${item.message}` : item.title ?? "Дипломатический договор";
  }
  if (item.title && item.message) {
    return `${item.title}: ${item.message}`;
  }
  return item.title ?? item.message ?? "Уведомление";
}

function categoryLabel(category: InAppUiNotification["category"]): string {
  switch (category) {
    case "registration":
      return "Регистрация";
    case "politics":
      return "Политика";
    case "economy":
      return "Экономика";
    case "diplomacy":
      return "Дипломатия";
    default:
      return "Система";
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
              className={`group relative inline-flex h-10 w-10 items-start justify-start overflow-hidden rounded-xl border bg-[#131a22] px-3 py-[11px] shadow-xl shadow-black/35 transition-[width,height,transform] duration-200 hover:h-[56px] hover:w-[220px] hover:scale-[1.03] ${
                pendingDecisionCount > 0 ? "text-rose-300 border-rose-900/80" : "text-slate-200 border-slate-400/70"
              }`}
              aria-label="Открыть историю уведомлений"
            >
              <Bell
                size={17}
                className="pointer-events-none absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 transition-all duration-200 group-hover:left-3 group-hover:top-[14px] group-hover:translate-x-0 group-hover:translate-y-0"
              />
              <span className="relative z-10 ml-6 min-w-0">
                <span className="block max-w-0 overflow-hidden whitespace-nowrap text-xs font-medium opacity-0 transition-all duration-200 group-hover:max-w-[170px] group-hover:opacity-100">
                  История уведомлений
                </span>
                <span className="block max-h-0 max-w-[170px] overflow-hidden text-[10px] leading-3 text-white/70 opacity-0 transition-all duration-200 group-hover:mt-0.5 group-hover:max-h-8 group-hover:opacity-100">
                  Открыть список прошлых уведомлений
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
            const glowColor = glowColorForCategory(item.category);
            const label = categoryLabel(item.category);
            const hoverText = tooltipText(item);
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
                  className={`group relative inline-flex h-10 w-10 items-start justify-start overflow-hidden rounded-xl border bg-[#131a22] px-3 py-[11px] shadow-xl shadow-black/35 transition-[width,height,transform] duration-200 hover:h-[92px] hover:w-[260px] hover:scale-[1.03] ${colorClass}`}
                  style={
                    isUnread
                      ? {
                          boxShadow: `0 0 0 1px ${glowColor} inset, 0 0 20px ${glowColor}, 0 0 34px ${glowColor}, 0 10px 24px rgba(0,0,0,0.35)`,
                        }
                      : undefined
                  }
                  aria-label={tooltipText(item)}
                >
                  <Icon
                    size={17}
                    className="pointer-events-none absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 transition-all duration-200 group-hover:left-3 group-hover:top-[14px] group-hover:translate-x-0 group-hover:translate-y-0"
                  />
                  <span className="relative z-10 ml-6 min-w-0">
                    <span className="block max-w-0 overflow-hidden whitespace-nowrap text-xs font-medium opacity-0 transition-all duration-200 group-hover:max-w-[180px] group-hover:opacity-100">
                      {label}
                    </span>
                    <span className="arc-scrollbar block max-h-0 max-w-[200px] overflow-hidden text-[10px] leading-3 text-white/70 opacity-0 transition-all duration-200 group-hover:mt-0.5 group-hover:max-h-[56px] group-hover:overflow-y-auto group-hover:opacity-100">
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
                            className={`rounded border px-1.5 py-0.5 text-[10px] ${
                              action.kind === "danger"
                                ? "border-rose-400/35 bg-rose-500/15 text-rose-200"
                                : action.kind === "primary"
                                  ? "border-emerald-400/35 bg-emerald-500/15 text-emerald-200"
                                  : "border-white/15 bg-white/10 text-white/75"
                            }`}
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
