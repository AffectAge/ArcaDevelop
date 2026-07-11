import { Globe2, LogOut, ShieldAlert } from "lucide-react";
import { useUiText } from "../i18n/useUiText";
import type { MarketCatalogItem, MarketInvite } from "../lib/api";
import { CustomSelect } from "./CustomSelect";
import { AppButton } from "./templates/AppButton";
import { AppModal, AppModalHeader } from "./templates/AppModal";
import { AppCard, AppEmptyState, AppSection } from "./templates/AppSurface";

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
  const { t } = useUiText();

  if (!open) return null;

  const isOwner = Boolean(currentMarket && currentMarket.ownerCountryId === countryId);

  return (
    <AppModal
      modalKey="market-membership"
      open={open}
      onClose={onClose}
      zIndexClassName="z-[179]"
      panelClassName="arc-market-subpanel w-[min(92vw,700px)]"
      paddingClassName="p-4 md:p-6 flex items-center justify-center"
    >
          <AppModalHeader
            title={t("market.membershipTitle")}
            description={t("market.membershipDescription")}
            onClose={onClose}
          />

          {!currentMarket ? (
            <AppEmptyState>{t("market.notMember")}</AppEmptyState>
          ) : (
            <div className="space-y-3">
              <AppCard className="arc-market-soft-card text-sm">
                <div className="font-semibold text-[var(--arc-color-atlas-ink)]">{currentMarket.name}</div>
                <div className="mt-1 text-xs">
                  {t("market.visibilityMembers", { visibility: currentMarket.visibility, members: currentMarket.membersCount })}
                </div>
                <div className="mt-1 text-xs">{t("market.ownerLabel", { country: currentMarket.ownerCountryName })}</div>
              </AppCard>

              {isOwner ? (
                <AppCard className="arc-market-warning-card text-xs">
                  <div className="mb-1 inline-flex items-center gap-1.5 font-semibold">
                    <ShieldAlert size={13} /> {t("market.ownerWarningTitle")}
                  </div>
                  <div>{t("market.ownerWarningBody")}</div>
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
                    {t("market.leaveMarket")}
                  </AppButton>
                </div>
              )}

              <AppSection>
                <div className="arc-market-section-title mb-2">{t("market.incomingInvites")}</div>
                <div className="space-y-2">
                  {incomingInvites.map((invite) => (
                    <AppCard key={invite.id} className="arc-market-soft-card p-2 text-xs">
                      <div className="font-semibold text-[var(--arc-color-atlas-ink)]">{invite.marketName ?? invite.marketId}</div>
                      <div>{t("market.fromLabel", { country: invite.fromCountryName ?? invite.fromCountryId })}</div>
                      <div className="mt-2 flex items-center gap-2">
                        <AppButton
                          type="button"
                          disabled={pendingInviteActionId === invite.id}
                          onClick={() => onInviteAction(invite.id, "accept")}
                          variant="primary"
                          size="sm"
                          className="h-7"
                        >
                          {t("market.accept")}
                        </AppButton>
                        <AppButton
                          type="button"
                          disabled={pendingInviteActionId === invite.id}
                          onClick={() => onInviteAction(invite.id, "reject")}
                          variant="danger"
                          size="sm"
                          className="h-7"
                        >
                          {t("market.reject")}
                        </AppButton>
                      </div>
                    </AppCard>
                  ))}
                  {incomingInvites.length === 0 && <AppEmptyState>{t("market.noInvites")}</AppEmptyState>}
                </div>
              </AppSection>

              <AppSection>
                <div className="arc-market-section-title mb-2">
                  <Globe2 size={14} className="text-[var(--arc-color-atlas-primary)]" />
                  {t("market.worldMarkets")}
                </div>
                <div className="space-y-2">
                  <CustomSelect
                    value={selectedMarketId}
                    onChange={onSelectMarket}
                    options={selectableMarkets.map((market) => ({
                      value: market.id,
                      label: `${market.name} [${market.visibility}]`,
                    }))}
                    placeholder={t("market.selectMarket")}
                    buttonClassName="h-9 text-xs"
                  />
                  {selectedMarket && (
                    <AppCard className="arc-market-soft-card px-3 py-2 text-[11px]">
                      {t("market.selectedMarketSummary", {
                        owner: selectedMarket.ownerCountryName,
                        members: selectedMarket.membersCount,
                        pending: selectedMarket.hasPendingJoinRequest ? t("market.joinRequestAlreadySent") : "",
                      })}
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
                    {selectedMarket?.visibility === "private" ? t("market.sendRequest") : t("market.joinMarket")}
                  </AppButton>
                </div>
                <div className="arc-market-muted mt-1 text-[11px]">{t("market.membershipHint")}</div>
              </AppSection>
            </div>
          )}
    </AppModal>
  );
}
