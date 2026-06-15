import { Bell, Handshake, Landmark, ScrollText, ShieldAlert, Trash2 } from "lucide-react";
import type { InAppUiNotification } from "./InAppNotificationTray";
import { AppModal, AppModalHeader } from "./ui/AppModal";
import { AppEmptyState } from "./ui/AppSurface";

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

function categoryLabel(category: InAppUiNotification["category"]) {
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

function itemText(item: InAppUiNotification): string {
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
  if (item.title && item.message) return `${item.title}: ${item.message}`;
  return item.title ?? item.message ?? "Уведомление";
}

function categoryColor(category: InAppUiNotification["category"]): string {
  switch (category) {
    case "registration":
      return "text-rose-300 border-rose-400/20 bg-rose-500/10";
    case "politics":
      return "text-sky-300 border-sky-400/20 bg-sky-500/10";
    case "economy":
      return "text-emerald-300 border-emerald-400/20 bg-emerald-500/10";
    case "diplomacy":
      return "text-amber-200 border-amber-400/20 bg-amber-500/10";
    default:
      return "text-slate-200 border-slate-400/20 bg-slate-500/10";
  }
}

function categoryTextColor(category: InAppUiNotification["category"]): string {
  switch (category) {
    case "registration":
      return "text-rose-300";
    case "politics":
      return "text-sky-300";
    case "economy":
      return "text-emerald-300";
    case "diplomacy":
      return "text-amber-200";
    default:
      return "text-slate-200";
  }
}

export function NotificationHistoryModal({ open, items, viewedIds, onClose, onOpenItem, onDeleteItem }: Props) {
  return (
    <AppModal
      modalKey="notifications"
      open={open}
      onClose={onClose}
      zIndexClassName="z-[132]"
      panelClassName="h-auto w-full max-w-3xl"
      paddingClassName="p-4 pt-24 flex items-start justify-center"
    >
            <AppModalHeader title="История уведомлений" description={`Всего: ${items.length}`} onClose={onClose} />

            <div className="arc-scrollbar max-h-[60vh] space-y-2 overflow-auto pr-1">
              {items.length === 0 && <AppEmptyState>История уведомлений пока пуста</AppEmptyState>}
              {items.map((item) => {
                const Icon = iconForCategory(item.category);
                const isViewed = viewedIds?.has(item.id) ?? false;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onOpenItem?.(item)}
                    className="panel-border block w-full rounded-lg bg-black/25 p-3 text-left transition hover:border-white/15 hover:bg-black/35"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0 flex flex-1 items-center gap-3">
                        <span className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${categoryColor(item.category)}`}>
                        <Icon size={16} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className={`text-xs font-medium ${categoryTextColor(item.category)}`}>{categoryLabel(item.category)}</span>
                                <span className={`rounded border px-1.5 py-0.5 text-[10px] ${isViewed ? "border-slate-400/20 bg-slate-500/10 text-slate-300" : "border-amber-400/20 bg-amber-500/10 text-amber-300"}`}>
                                  {isViewed ? "Просмотрено" : "Новое"}
                                </span>
                              </div>
                              <div className="mt-1 break-words text-sm text-slate-200">{itemText(item)}</div>
                              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
                                <span>{new Date(item.createdAt).toLocaleString()}</span>
                                <span>Ход получения: #{item.receivedTurnId ?? "?"}</span>
                              </div>
                            </div>
                            {(item.action.type === "registration-approval" || item.action.type === "country-event" || item.action.type === "diplomacy-proposal") && (
                              <span className="shrink-0 rounded border border-rose-400/20 bg-rose-500/10 px-2 py-1 text-[10px] text-rose-300">Требует решения</span>
                            )}
                            {onDeleteItem ? (
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  onDeleteItem(item);
                                }}
                                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-white/10 bg-black/20 text-white/55 transition hover:border-rose-400/35 hover:bg-rose-500/10 hover:text-rose-300"
                                aria-label="Удалить уведомление из истории"
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
