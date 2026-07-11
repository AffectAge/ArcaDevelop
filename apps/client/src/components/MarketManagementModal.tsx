import { Crown, ImagePlus, Save, Send, ShieldCheck, UserPlus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  createMarketInvite,
  fetchCountries,
  fetchMarketDetails,
  fetchMarketInvites,
  respondMarketInvite,
  transferMarketOwner,
  updateMarket,
  type MarketDetails,
  type MarketInvite,
} from "../lib/api";
import { useUiText } from "../i18n/useUiText";
import { CustomSelect } from "./CustomSelect";
import { Tooltip } from "./Tooltip";
import { AppButton } from "./templates/AppButton";
import { AppField, AppInput } from "./templates/AppForm";
import { AppModal, AppModalHeader } from "./templates/AppModal";
import { AppCard, AppEmptyState, AppSection, AppSectionHeader } from "./templates/AppSurface";

type Props = {
  open: boolean;
  onClose: () => void;
  token: string;
  countryId: string;
  marketId: string | null;
  onUpdated?: () => void;
};

export function MarketManagementModal({ open, onClose, token, countryId, marketId, onUpdated }: Props) {
  const { locale, t } = useUiText();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [marketDetails, setMarketDetails] = useState<MarketDetails | null>(null);
  const [outgoingInvites, setOutgoingInvites] = useState<MarketInvite[]>([]);
  const [countries, setCountries] = useState<Array<{ id: string; name: string; flagUrl?: string | null }>>([]);

  const [marketNameEdit, setMarketNameEdit] = useState("");
  const [marketVisibilityEdit, setMarketVisibilityEdit] = useState<"public" | "private">("public");
  const [marketLogoFile, setMarketLogoFile] = useState<File | null>(null);

  const [inviteSearch, setInviteSearch] = useState("");
  const [inviteTargetCountryId, setInviteTargetCountryId] = useState("");
  const [transferOwnerCountryId, setTransferOwnerCountryId] = useState("");

  const [pendingInvite, setPendingInvite] = useState(false);
  const [pendingCancelInviteId, setPendingCancelInviteId] = useState<string | null>(null);
  const [pendingTransferOwner, setPendingTransferOwner] = useState(false);

  const load = async () => {
    if (!marketId) return;
    setLoading(true);
    try {
      const [details, invites, allCountries] = await Promise.all([
        fetchMarketDetails(token, marketId),
        fetchMarketInvites(token, marketId),
        fetchCountries(),
      ]);
      setMarketDetails(details.market);
      setOutgoingInvites(invites.invites ?? []);
      setCountries(allCountries);
      setMarketNameEdit(details.market.name);
      setMarketVisibilityEdit(details.market.visibility);
      setMarketLogoFile(null);
      setTransferOwnerCountryId(details.market.members.find((member) => !member.isOwner)?.countryId ?? "");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("market.managementLoadFailed"));
      setMarketDetails(null);
      setOutgoingInvites([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open || !marketId) return;
    void load();
  }, [open, marketId]);

  const isOwner = marketDetails?.ownerCountryId === countryId;

  const inviteOptions = useMemo(() => {
    const memberIds = new Set(marketDetails?.memberCountryIds ?? []);
    const pendingTargets = new Set(
      outgoingInvites.filter((invite) => invite.status === "pending").map((invite) => invite.toCountryId),
    );
    const q = inviteSearch.trim().toLowerCase();
    return countries
      .filter((country) => !memberIds.has(country.id))
      .filter((country) => !pendingTargets.has(country.id))
      .filter((country) => {
        if (!q) return true;
        return country.name.toLowerCase().includes(q) || country.id.toLowerCase().includes(q);
      })
      .sort((a, b) => a.name.localeCompare(b.name, locale))
      .map((country) => ({ value: country.id, label: country.name }));
  }, [countries, inviteSearch, locale, marketDetails?.memberCountryIds, outgoingInvites]);

  useEffect(() => {
    if (!inviteOptions.some((option) => option.value === inviteTargetCountryId)) {
      setInviteTargetCountryId(inviteOptions[0]?.value ?? "");
    }
  }, [inviteOptions, inviteTargetCountryId]);

  const transferOwnerOptions = useMemo(
    () =>
      (marketDetails?.members ?? [])
        .filter((member) => !member.isOwner)
        .map((member) => ({ value: member.countryId, label: member.countryName })),
    [marketDetails?.members],
  );

  useEffect(() => {
    if (!transferOwnerOptions.some((option) => option.value === transferOwnerCountryId)) {
      setTransferOwnerCountryId(transferOwnerOptions[0]?.value ?? "");
    }
  }, [transferOwnerOptions, transferOwnerCountryId]);

  const saveMarket = async () => {
    if (!marketId || !isOwner) return;
    setSaving(true);
    try {
      const updated = await updateMarket(token, marketId, {
        name: marketNameEdit,
        visibility: marketVisibilityEdit,
        logoFile: marketLogoFile,
      });
      setMarketDetails(updated.market);
      setMarketLogoFile(null);
      toast.success(t("market.updateSuccess"));
      onUpdated?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("market.updateFailed"));
    } finally {
      setSaving(false);
    }
  };

  const sendInvite = async () => {
    if (!marketId || !isOwner || !inviteTargetCountryId) return;
    setPendingInvite(true);
    try {
      await createMarketInvite(token, marketId, { toCountryId: inviteTargetCountryId });
      toast.success(t("market.inviteSent"));
      await load();
      onUpdated?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("market.inviteSendFailed"));
    } finally {
      setPendingInvite(false);
    }
  };

  const cancelInvite = async (inviteId: string) => {
    setPendingCancelInviteId(inviteId);
    try {
      await respondMarketInvite(token, inviteId, "cancel");
      toast.success(t("market.inviteCanceled"));
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("market.inviteCancelFailed"));
    } finally {
      setPendingCancelInviteId(null);
    }
  };

  const transferOwner = async () => {
    if (!marketId || !isOwner || !transferOwnerCountryId) return;
    setPendingTransferOwner(true);
    try {
      const updated = await transferMarketOwner(token, marketId, transferOwnerCountryId);
      setMarketDetails(updated.market);
      toast.success(t("market.ownerChanged"));
      onUpdated?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("market.transferFailed"));
    } finally {
      setPendingTransferOwner(false);
    }
  };

  if (!open) return null;

  return (
    <AppModal
      modalKey="market-management"
      open={open}
      onClose={onClose}
      zIndexClassName="z-[180]"
      panelClassName="arc-market-subpanel arc-scrollbar max-h-[min(92vh,920px)] w-[min(92vw,920px)] overflow-auto"
      paddingClassName="p-4 md:p-6 flex items-center justify-center"
    >
          <AppModalHeader
            title={t("market.managementTitle")}
            description={t("market.managementDescription")}
            onClose={onClose}
          />

          {loading ? (
            <div className="arc-market-muted text-sm">{t("market.loading")}</div>
          ) : !marketDetails ? (
            <AppEmptyState>{t("market.marketNotFound")}</AppEmptyState>
          ) : !isOwner ? (
            <AppCard className="arc-market-warning-card text-sm">{t("market.managementOwnerOnly")}</AppCard>
          ) : (
            <div className="space-y-4">
              <AppSection>
                <AppSectionHeader title={t("market.settingsSection")} icon={<Crown size={14} />} />
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <AppField label={t("market.nameLabel")}>
                    <AppInput
                      value={marketNameEdit}
                      onChange={(event) => setMarketNameEdit(event.target.value)}
                      className="h-9"
                    />
                  </AppField>
                  <div>
                    <label className="arc-market-muted mb-1 block text-xs">{t("market.visibilityLabel")}</label>
                    <CustomSelect
                      value={marketVisibilityEdit}
                      onChange={(value) => setMarketVisibilityEdit(value as "public" | "private")}
                      options={[
                        { value: "public", label: t("market.visibilityPublic") },
                        { value: "private", label: t("market.visibilityPrivate") },
                      ]}
                      buttonClassName="h-9 text-xs"
                    />
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <label className="arc-market-file-button">
                    <ImagePlus size={13} />
                    {t("market.logo")}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(event) => setMarketLogoFile(event.target.files?.[0] ?? null)}
                    />
                  </label>
                  <AppButton
                    type="button"
                    disabled={saving}
                    onClick={() => void saveMarket()}
                    variant="primary"
                    size="sm"
                    icon={<Save size={13} />}
                  >
                    {t("market.save")}
                  </AppButton>
                </div>
              </AppSection>

              <AppSection>
                <AppSectionHeader title={t("market.sendInvite")} icon={<UserPlus size={14} />} />
                <div className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_220px_auto]">
                  <AppInput
                    value={inviteSearch}
                    onChange={(event) => setInviteSearch(event.target.value)}
                    placeholder={t("market.countrySearch")}
                    className="h-9"
                  />
                  <CustomSelect
                    value={inviteTargetCountryId}
                    onChange={setInviteTargetCountryId}
                    options={inviteOptions}
                    placeholder={t("market.selectCountry")}
                    buttonClassName="h-9 text-xs"
                  />
                  <Tooltip content={t("market.sendInviteTooltip")}>
                    <AppButton
                      type="button"
                      disabled={pendingInvite || !inviteTargetCountryId}
                      onClick={() => void sendInvite()}
                      variant="primary"
                      size="icon"
                      className="h-9 w-9"
                    >
                      <Send size={14} />
                    </AppButton>
                  </Tooltip>
                </div>
              </AppSection>

              <AppSection>
                <AppSectionHeader title={t("market.outgoingInvites")} icon={<Send size={14} />} />
                <div className="space-y-1">
                  {outgoingInvites.map((invite) => (
                    <AppCard
                      key={invite.id}
                      className="arc-market-soft-card flex items-center justify-between px-3 py-2 text-xs"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-[var(--arc-color-atlas-ink)]">{invite.toCountryName ?? invite.toCountryId}</div>
                        <div>
                          {t("market.inviteStatusExpires", {
                            status: invite.status,
                            date: new Date(invite.expiresAt).toLocaleDateString(locale === "ru" ? "ru-RU" : "en-US"),
                          })}
                        </div>
                      </div>
                      {invite.status === "pending" ? (
                        <AppButton
                          type="button"
                          disabled={pendingCancelInviteId === invite.id}
                          onClick={() => void cancelInvite(invite.id)}
                          variant="danger"
                          size="sm"
                        >
                          {t("market.cancelInvite")}
                        </AppButton>
                      ) : (
                        <span className="arc-market-status-chip">—</span>
                      )}
                    </AppCard>
                  ))}
                  {outgoingInvites.length === 0 && <AppEmptyState>{t("market.noOutgoingInvites")}</AppEmptyState>}
                </div>
              </AppSection>

              <AppSection>
                <AppSectionHeader title={t("market.transferOwnership")} icon={<Crown size={14} />} />
                <div className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_auto]">
                  <CustomSelect
                    value={transferOwnerCountryId}
                    onChange={setTransferOwnerCountryId}
                    options={transferOwnerOptions}
                    placeholder={t("market.selectNewOwner")}
                    buttonClassName="h-9 text-xs"
                  />
                  <Tooltip content={t("market.transferOwnerTooltip")}>
                    <AppButton
                      type="button"
                      disabled={pendingTransferOwner || !transferOwnerCountryId}
                      onClick={() => void transferOwner()}
                      variant="secondary"
                      size="sm"
                      icon={<ShieldCheck size={13} />}
                    >
                      {t("market.transfer")}
                    </AppButton>
                  </Tooltip>
                </div>
              </AppSection>
            </div>
          )}
    </AppModal>
  );
}
