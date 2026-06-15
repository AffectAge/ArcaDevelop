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
import { CustomSelect } from "./CustomSelect";
import { Tooltip } from "./Tooltip";
import { AppButton } from "./ui/AppButton";
import { AppField, AppInput } from "./ui/AppForm";
import { AppModal, AppModalHeader } from "./ui/AppModal";
import { AppCard, AppEmptyState, AppSection, AppSectionHeader } from "./ui/AppSurface";

type Props = {
  open: boolean;
  onClose: () => void;
  token: string;
  countryId: string;
  marketId: string | null;
  onUpdated?: () => void;
};

export function MarketManagementModal({ open, onClose, token, countryId, marketId, onUpdated }: Props) {
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
      toast.error(error instanceof Error ? error.message : "Не удалось загрузить управление рынком");
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
      .sort((a, b) => a.name.localeCompare(b.name, "ru"))
      .map((country) => ({ value: country.id, label: country.name }));
  }, [countries, inviteSearch, marketDetails?.memberCountryIds, outgoingInvites]);

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
      toast.success("Параметры рынка обновлены");
      onUpdated?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось обновить рынок");
    } finally {
      setSaving(false);
    }
  };

  const sendInvite = async () => {
    if (!marketId || !isOwner || !inviteTargetCountryId) return;
    setPendingInvite(true);
    try {
      await createMarketInvite(token, marketId, { toCountryId: inviteTargetCountryId });
      toast.success("Приглашение отправлено");
      await load();
      onUpdated?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось отправить приглашение");
    } finally {
      setPendingInvite(false);
    }
  };

  const cancelInvite = async (inviteId: string) => {
    setPendingCancelInviteId(inviteId);
    try {
      await respondMarketInvite(token, inviteId, "cancel");
      toast.success("Приглашение отменено");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось отменить приглашение");
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
      toast.success("Владелец рынка изменен");
      onUpdated?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось передать владение");
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
      panelClassName="arc-scrollbar max-h-[min(92vh,920px)] w-[min(92vw,920px)] overflow-auto"
      paddingClassName="p-4 md:p-6 flex items-center justify-center"
    >
          <AppModalHeader
            title="Управление рынком"
            description="Параметры рынка, исходящие приглашения и передача владения"
            onClose={onClose}
          />

          {loading ? (
            <div className="text-sm text-white/60">Загрузка...</div>
          ) : !marketDetails ? (
            <AppEmptyState>Рынок не найден или нет доступа.</AppEmptyState>
          ) : !isOwner ? (
            <AppCard className="border-amber-400/35 bg-amber-500/10 text-sm text-amber-200">Управление доступно только владельцу рынка.</AppCard>
          ) : (
            <div className="space-y-4">
              <AppSection>
                <AppSectionHeader title="Параметры рынка" icon={<Crown size={14} />} />
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <AppField label="Название">
                    <AppInput
                      value={marketNameEdit}
                      onChange={(event) => setMarketNameEdit(event.target.value)}
                      className="h-9"
                    />
                  </AppField>
                  <div>
                    <label className="mb-1 block text-xs text-white/60">Видимость</label>
                    <CustomSelect
                      value={marketVisibilityEdit}
                      onChange={(value) => setMarketVisibilityEdit(value as "public" | "private")}
                      options={[
                        { value: "public", label: "Публичный" },
                        { value: "private", label: "Приватный" },
                      ]}
                      buttonClassName="h-9 text-xs"
                    />
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <label className="panel-border inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg bg-black/35 px-3 text-xs text-white/75 hover:border-arc-accent/40">
                    <ImagePlus size={13} />
                    Логотип
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
                    Сохранить
                  </AppButton>
                </div>
              </AppSection>

              <AppSection>
                <AppSectionHeader title="Отправить приглашение" icon={<UserPlus size={14} />} />
                <div className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_220px_auto]">
                  <AppInput
                    value={inviteSearch}
                    onChange={(event) => setInviteSearch(event.target.value)}
                    placeholder="Поиск страны"
                    className="h-9"
                  />
                  <CustomSelect
                    value={inviteTargetCountryId}
                    onChange={setInviteTargetCountryId}
                    options={inviteOptions}
                    placeholder="Выберите страну"
                    buttonClassName="h-9 text-xs"
                  />
                  <Tooltip content="Отправить приглашение в рынок">
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
                <AppSectionHeader title="История исходящих приглашений" icon={<Send size={14} />} />
                <div className="space-y-1">
                  {outgoingInvites.map((invite) => (
                    <AppCard
                      key={invite.id}
                      className="flex items-center justify-between bg-black/25 px-3 py-2 text-xs"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-white/80">{invite.toCountryName ?? invite.toCountryId}</div>
                        <div className="text-white/50">
                          Статус: {invite.status} · Истекает: {new Date(invite.expiresAt).toLocaleDateString("ru-RU")}
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
                          Отменить
                        </AppButton>
                      ) : (
                        <span className="rounded-md border border-white/10 bg-black/35 px-2 py-1 text-[11px] text-white/50">—</span>
                      )}
                    </AppCard>
                  ))}
                  {outgoingInvites.length === 0 && <AppEmptyState>Исходящих приглашений пока нет.</AppEmptyState>}
                </div>
              </AppSection>

              <AppSection>
                <AppSectionHeader title="Передача владения рынком" icon={<Crown size={14} />} />
                <div className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_auto]">
                  <CustomSelect
                    value={transferOwnerCountryId}
                    onChange={setTransferOwnerCountryId}
                    options={transferOwnerOptions}
                    placeholder="Выберите нового владельца"
                    buttonClassName="h-9 text-xs"
                  />
                  <Tooltip content="Передать право управления рынком выбранной стране">
                    <AppButton
                      type="button"
                      disabled={pendingTransferOwner || !transferOwnerCountryId}
                      onClick={() => void transferOwner()}
                      variant="secondary"
                      size="sm"
                      icon={<ShieldCheck size={13} />}
                    >
                      Передать
                    </AppButton>
                  </Tooltip>
                </div>
              </AppSection>
            </div>
          )}
    </AppModal>
  );
}
