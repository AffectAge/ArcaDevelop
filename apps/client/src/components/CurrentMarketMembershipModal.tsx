import { Globe2, LogOut, ShieldAlert } from "lucide-react";
import type { MarketCatalogItem, MarketInvite } from "../lib/api";
import { CustomSelect } from "./CustomSelect";
import { AppButton } from "./ui/AppButton";
import { AppModal, AppModalHeader } from "./ui/AppModal";
import { AppCard, AppEmptyState, AppSection } from "./ui/AppSurface";

type Props = {
  open: boolean;
  onClose: () => void;
  countryId: string;
  currentMarket: MarketCatalogItem | null;
  pendingLeave: boolean;
  onLeave: () => void;
  incomingInvites: MarketInvite[];
  pendingInviteActionId: string | null;
  onInviteAction: (inviteId: string, action: "accept" | "reject") => void;
  selectableMarkets: MarketCatalogItem[];
  selectedMarketId: string;
  onSelectMarket: (marketId: string) => void;
  selectedMarket: MarketCatalogItem | null;
  pendingJoin: boolean;
  onJoin: () => void;
};

export function CurrentMarketMembershipModal({
  open,
  onClose,
  countryId,
  currentMarket,
  pendingLeave,
  onLeave,
  incomingInvites,
  pendingInviteActionId,
  onInviteAction,
  selectableMarkets,
  selectedMarketId,
  onSelectMarket,
  selectedMarket,
  pendingJoin,
  onJoin,
}: Props) {
  if (!open) return null;

  const isOwner = Boolean(currentMarket && currentMarket.ownerCountryId === countryId);

  return (
    <AppModal
      modalKey="market-membership"
      open={open}
      onClose={onClose}
      zIndexClassName="z-[179]"
      panelClassName="w-[min(92vw,700px)]"
      paddingClassName="p-4 md:p-6 flex items-center justify-center"
    >
          <AppModalHeader
            title="Текущее членство"
            description="Информация о текущем рынке и выход из него"
            onClose={onClose}
          />

          {!currentMarket ? (
            <AppEmptyState>Ваша страна сейчас не состоит в рынке.</AppEmptyState>
          ) : (
            <div className="space-y-3">
              <AppCard className="bg-black/25 text-sm text-white/75">
                <div className="font-semibold text-white/90">{currentMarket.name}</div>
                <div className="mt-1 text-xs text-white/60">
                  Видимость: {currentMarket.visibility} · Участников: {currentMarket.membersCount}
                </div>
                <div className="mt-1 text-xs text-white/60">Владелец: {currentMarket.ownerCountryName}</div>
              </AppCard>

              {isOwner ? (
                <AppCard className="border-amber-400/35 bg-amber-500/10 text-xs text-amber-200">
                  <div className="mb-1 inline-flex items-center gap-1.5 font-semibold">
                    <ShieldAlert size={13} /> Вы владелец рынка
                  </div>
                  <div>Для выхода сначала передайте владение рынком в модалке «Управление».</div>
                </AppCard>
              ) : (
                <div className="flex justify-end">
                  <AppButton
                    type="button"
                    disabled={pendingLeave}
                    onClick={onLeave}
                    variant="danger"
                    size="sm"
                    icon={<LogOut size={13} />}
                  >
                    Выйти из рынка
                  </AppButton>
                </div>
              )}

              <AppSection>
                <div className="mb-2 text-sm font-semibold text-white/85">Входящие приглашения</div>
                <div className="space-y-2">
                  {incomingInvites.map((invite) => (
                    <AppCard key={invite.id} className="bg-black/25 p-2 text-xs text-white/70">
                      <div className="font-semibold text-white/85">{invite.marketName ?? invite.marketId}</div>
                      <div className="text-white/50">От: {invite.fromCountryName ?? invite.fromCountryId}</div>
                      <div className="mt-2 flex items-center gap-2">
                        <AppButton
                          type="button"
                          disabled={pendingInviteActionId === invite.id}
                          onClick={() => onInviteAction(invite.id, "accept")}
                          variant="primary"
                          size="sm"
                          className="h-7"
                        >
                          Принять
                        </AppButton>
                        <AppButton
                          type="button"
                          disabled={pendingInviteActionId === invite.id}
                          onClick={() => onInviteAction(invite.id, "reject")}
                          variant="danger"
                          size="sm"
                          className="h-7"
                        >
                          Отклонить
                        </AppButton>
                      </div>
                    </AppCard>
                  ))}
                  {incomingInvites.length === 0 && <AppEmptyState>Приглашений нет.</AppEmptyState>}
                </div>
              </AppSection>

              <AppSection>
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-white/85">
                  <Globe2 size={14} className="text-cyan-300" />
                  Рынки мира
                </div>
                <div className="space-y-2">
                  <CustomSelect
                    value={selectedMarketId}
                    onChange={onSelectMarket}
                    options={selectableMarkets.map((market) => ({
                      value: market.id,
                      label: `${market.name} [${market.visibility}]`,
                    }))}
                    placeholder="Выберите рынок"
                    buttonClassName="h-9 text-xs"
                  />
                  {selectedMarket && (
                    <AppCard className="bg-black/25 px-3 py-2 text-[11px] text-white/65">
                      Владелец: {selectedMarket.ownerCountryName} · Участников: {selectedMarket.membersCount}
                      {selectedMarket.hasPendingJoinRequest ? " · Запрос уже отправлен" : ""}
                    </AppCard>
                  )}
                </div>
                <div className="mt-2 flex justify-end">
                  <AppButton
                    type="button"
                    disabled={pendingJoin || !selectedMarket || selectedMarket.hasPendingJoinRequest}
                    onClick={onJoin}
                    variant="secondary"
                    size="sm"
                  >
                    {selectedMarket?.visibility === "private" ? "Отправить запрос" : "Вступить"}
                  </AppButton>
                </div>
                <div className="mt-1 text-[11px] text-white/50">
                  Публичный рынок: мгновенное вступление. Приватный рынок: отправка запроса владельцу.
                </div>
              </AppSection>
            </div>
          )}
    </AppModal>
  );
}
