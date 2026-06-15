import { Check, Coins, FileText, Handshake, Landmark, Plus, RefreshCw, Route, ScrollText, Send, Trash2, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import type { Country, DiplomacyProposal, TreatyClause, TreatyClauseKind, TreatyConstructionExpirationPolicy, TreatyMoneyPaymentCadence, TreatyMoneyResource, TreatyTransportMode, WorldBase } from "@arcanorum/shared";
import {
  acceptDiplomacyProposal,
  createDiplomacyProposal,
  declineDiplomacyProposalRenewal,
  fetchCountries,
  fetchDiplomacyProposals,
  rejectDiplomacyProposal,
  renewDiplomacyProposal,
  reviseDiplomacyProposal,
} from "../lib/api";
import { CustomSelect } from "./CustomSelect";
import { Tooltip } from "./Tooltip";
import { AppButton } from "./ui/AppButton";
import { AppInput, AppTextarea } from "./ui/AppForm";
import { AppModal } from "./ui/AppModal";
import { tUi } from "../i18n/uiText";

type Props = {
  open: boolean;
  token: string;
  countryId: string;
  countryName: string;
  worldBase: WorldBase | null;
  focusProposalId?: string | null;
  revisionDraft?: DiplomacyProposal | null;
  onFocusedProposalHandled?: () => void;
  onRevisionDraftHandled?: () => void;
  onProposalRevised?: (proposalId: string) => void;
  onClose: () => void;
};

type ClauseDraft =
  | {
      id: string;
      kind: "transfer_money";
      fromCountryId: string;
      toCountryId: string;
      resource: TreatyMoneyResource;
      amount: string;
      paymentCadence: TreatyMoneyPaymentCadence;
    }
  | {
      id: string;
      kind: "transfer_region";
      fromCountryId: string;
      toCountryId: string;
      regionId: string;
    }
  | {
      id: string;
      kind: "infrastructure_transit";
      fromCountryId: string;
      toCountryId: string;
      transportModes: TreatyTransportMode[];
    }
  | {
      id: string;
      kind: "infrastructure_construction_rights";
      fromCountryId: string;
      toCountryId: string;
      transportModes: TreatyTransportMode[];
      expirationPolicy: TreatyConstructionExpirationPolicy;
    }
  | {
      id: string;
      kind: "text_note";
      text: string;
    };

const CLAUSE_KIND_OPTIONS: Array<{ value: TreatyClauseKind; label: string; category: "Экономика" | "Территории" | "Инфраструктура" | "Прочее"; icon: LucideIcon }> = [
  { value: "transfer_money", label: "Передача денег", category: "Экономика", icon: Coins },
  { value: "transfer_region", label: tUi("diplomacy.transferRegion"), category: "Территории", icon: Landmark },
  { value: "infrastructure_transit", label: "Права транзита", category: "Инфраструктура", icon: Route },
  { value: "infrastructure_construction_rights", label: "Строительство коридоров", category: "Инфраструктура", icon: Landmark },
  { value: "text_note", label: "Текстовый пункт", category: "Прочее", icon: FileText },
];

const CLAUSE_CATEGORIES = ["Экономика", "Территории", "Инфраструктура", "Прочее"] as const;

const TRANSPORT_MODE_OPTIONS: Array<{ value: TreatyTransportMode; label: string }> = [
  { value: "land", label: "Сухопутный транспорт" },
  { value: "sea", label: "Море" },
  { value: "air", label: "Воздух" },
  { value: "pipeline", label: "Трубы" },
  { value: "powerGrid", label: "Электросети" },
];

const CONSTRUCTION_EXPIRATION_POLICY_OPTIONS: Array<{ value: TreatyConstructionExpirationPolicy; label: string; description: string }> = [
  {
    value: "disable_without_transit",
    label: "Отключить без транзита",
    description: "Построенные участки остаются у строителя, но без транзита перестают работать.",
  },
  {
    value: "nationalize_to_territory_owner",
    label: "Национализировать",
    description: "После окончания договора коридор переходит владельцу территории.",
  },
];

const STATUS_LABEL: Record<DiplomacyProposal["status"], string> = {
  pending: "Ожидает подписи",
  accepted: "Подписан",
  renewal_pending: "Ожидает продления",
  rejected: "Отклонён",
  expired: "Истёк",
  failed: "Не исполнен",
};

const RESOURCE_LABEL: Record<TreatyMoneyResource, string> = {
  ducats: "Дукаты",
  gold: "Золото",
};

const MONEY_CADENCE_LABEL: Record<TreatyMoneyPaymentCadence, string> = {
  once: "разово",
  per_turn: "за ход",
};

function makeId() {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function countryLabel(countries: Country[], countryId: string) {
  return countries.find((country) => country.id === countryId)?.name ?? countryId;
}

function countryFlag(country: Country | null | undefined) {
  if (country?.flagUrl) {
    return <img src={country.flagUrl} alt="" className="h-4 w-7 rounded-sm border border-black/35 object-cover" />;
  }
  return <span className="h-4 w-7 rounded-sm border border-black/35" style={{ backgroundColor: country?.color ?? "var(--arc-color-text-muted)" }} />;
}

function regionLabel(worldBase: WorldBase | null, regionId: string) {
  return regionId;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 3 }).format(value);
}

function clauseSummary(clause: TreatyClause, countries: Country[], worldBase: WorldBase | null) {
  if (clause.kind === "transfer_money") {
    return `${countryLabel(countries, clause.fromCountryId)} передаёт ${countryLabel(countries, clause.toCountryId)} ${formatNumber(clause.amount)} ${RESOURCE_LABEL[clause.resource].toLowerCase()} ${MONEY_CADENCE_LABEL[clause.paymentCadence]}`;
  }
  if (clause.kind === "transfer_region") {
    return tUi("diplomacy.transferRegionSummary", {
      from: countryLabel(countries, clause.fromCountryId),
      to: countryLabel(countries, clause.toCountryId),
      region: regionLabel(worldBase, clause.regionId),
    });
  }
  if (clause.kind === "infrastructure_transit") {
    const modes = clause.transportModes
      .map((mode) => TRANSPORT_MODE_OPTIONS.find((option) => option.value === mode)?.label ?? mode)
      .join(", ");
    return `${countryLabel(countries, clause.fromCountryId)} предоставляет ${countryLabel(countries, clause.toCountryId)} транзит: ${modes}`;
  }
  if (clause.kind === "infrastructure_construction_rights") {
    const modes = clause.transportModes
      .map((mode) => TRANSPORT_MODE_OPTIONS.find((option) => option.value === mode)?.label ?? mode)
      .join(", ");
    const policy = CONSTRUCTION_EXPIRATION_POLICY_OPTIONS.find((option) => option.value === clause.expirationPolicy)?.label ?? clause.expirationPolicy;
    return `${countryLabel(countries, clause.fromCountryId)} разрешает ${countryLabel(countries, clause.toCountryId)} строительство коридоров: ${modes}. После окончания: ${policy}`;
  }
  return clause.text;
}

function getDiplomacyOtherCountryId(proposal: DiplomacyProposal, countryId: string) {
  return proposal.fromCountryId === countryId ? proposal.toCountryId : proposal.fromCountryId;
}

function draftToClause(draft: ClauseDraft): TreatyClause | null {
  if (draft.kind === "transfer_money") {
    const amount = Number(draft.amount);
    if (!draft.fromCountryId || !draft.toCountryId || draft.fromCountryId === draft.toCountryId || !Number.isFinite(amount) || amount <= 0) {
      return null;
    }
    return {
      id: draft.id,
      kind: "transfer_money",
      fromCountryId: draft.fromCountryId,
      toCountryId: draft.toCountryId,
      resource: draft.resource,
      amount: Number(amount.toFixed(3)),
      paymentCadence: draft.paymentCadence,
    };
  }
  if (draft.kind === "transfer_region") {
    if (!draft.fromCountryId || !draft.toCountryId || draft.fromCountryId === draft.toCountryId || !draft.regionId) return null;
    return {
      id: draft.id,
      kind: "transfer_region",
      fromCountryId: draft.fromCountryId,
      toCountryId: draft.toCountryId,
      regionId: draft.regionId,
    };
  }
  if (draft.kind === "infrastructure_transit") {
    if (!draft.fromCountryId || !draft.toCountryId || draft.fromCountryId === draft.toCountryId || draft.transportModes.length === 0) return null;
    return {
      id: draft.id,
      kind: "infrastructure_transit",
      fromCountryId: draft.fromCountryId,
      toCountryId: draft.toCountryId,
      transportModes: draft.transportModes,
    };
  }
  if (draft.kind === "infrastructure_construction_rights") {
    if (!draft.fromCountryId || !draft.toCountryId || draft.fromCountryId === draft.toCountryId || draft.transportModes.length === 0) return null;
    return {
      id: draft.id,
      kind: "infrastructure_construction_rights",
      fromCountryId: draft.fromCountryId,
      toCountryId: draft.toCountryId,
      transportModes: draft.transportModes,
      expirationPolicy: draft.expirationPolicy,
    };
  }
  const text = draft.text.trim();
  return text ? { id: draft.id, kind: "text_note", text } : null;
}

function clauseToDraft(clause: TreatyClause): ClauseDraft {
  if (clause.kind === "transfer_money") return { ...clause, amount: String(clause.amount), paymentCadence: clause.paymentCadence ?? "once" };
  if (clause.kind === "transfer_region") return { ...clause };
  if (clause.kind === "infrastructure_transit") return { ...clause };
  if (clause.kind === "infrastructure_construction_rights") return { ...clause };
  return { ...clause };
}

export function DiplomacyModal({ open, token, countryId, countryName, worldBase, focusProposalId, revisionDraft, onFocusedProposalHandled, onRevisionDraftHandled, onProposalRevised, onClose }: Props) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [countries, setCountries] = useState<Country[]>([]);
  const [proposals, setProposals] = useState<DiplomacyProposal[]>([]);
  const [targetCountryId, setTargetCountryId] = useState("");
  const [proposalName, setProposalName] = useState("");
  const [expiresInTurns, setExpiresInTurns] = useState("3");
  const [clauses, setClauses] = useState<ClauseDraft[]>([]);
  const [activeTab, setActiveTab] = useState<"incoming" | "outgoing" | "active">("incoming");
  const [newProposalOpen, setNewProposalOpen] = useState(false);
  const [editingProposalId, setEditingProposalId] = useState<string | null>(null);

  const countryOptions = useMemo(
    () => countries.filter((country) => country.id !== countryId).map((country) => ({ value: country.id, label: country.name })),
    [countries, countryId],
  );

  const filteredProposals = useMemo(() => {
    if (activeTab === "incoming") return proposals.filter((proposal) => proposal.status === "pending" && proposal.toCountryId === countryId);
    if (activeTab === "outgoing") return proposals.filter((proposal) => proposal.status === "pending" && proposal.fromCountryId === countryId);
    return proposals.filter((proposal) => proposal.status === "accepted" || proposal.status === "renewal_pending");
  }, [activeTab, countryId, proposals]);

  const submitClauses = useMemo(() => clauses.map(draftToClause).filter((clause): clause is TreatyClause => Boolean(clause)), [clauses]);

  const load = async () => {
    setLoading(true);
    try {
      const [countriesResult, proposalsResult] = await Promise.all([fetchCountries(), fetchDiplomacyProposals(token)]);
      setCountries(countriesResult);
      setProposals(proposalsResult.proposals);
      setTargetCountryId((prev) => prev || countriesResult.find((country) => country.id !== countryId)?.id || "");
    } catch {
      toast.error("Не удалось загрузить дипломатию");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    void load();
  }, [open, token]);

  useEffect(() => {
    if (!open || !focusProposalId || proposals.length === 0) return;
    const proposal = proposals.find((entry) => entry.id === focusProposalId);
    if (!proposal) return;
    setActiveTab(proposal.status === "accepted" || proposal.status === "renewal_pending" ? "active" : proposal.pendingResponderCountryId === countryId ? "incoming" : "outgoing");
    onFocusedProposalHandled?.();
  }, [countryId, focusProposalId, onFocusedProposalHandled, open, proposals]);

  useEffect(() => {
    if (!open || !revisionDraft) return;
    beginReviseProposal(revisionDraft);
    onRevisionDraftHandled?.();
  }, [open, onRevisionDraftHandled, revisionDraft]);

  const beginNewProposal = () => {
    setEditingProposalId(null);
    setProposalName("");
    setClauses([]);
    setNewProposalOpen(true);
  };

  const beginReviseProposal = (proposal: DiplomacyProposal) => {
    setEditingProposalId(proposal.id);
    setTargetCountryId(getDiplomacyOtherCountryId(proposal, countryId));
    setProposalName(proposal.name ?? "");
    setExpiresInTurns(String(Math.max(1, proposal.expiresTurnId - (proposal.createdTurnId ?? 0))));
    setClauses(proposal.clauses.map(clauseToDraft));
    setNewProposalOpen(true);
  };

  const getOppositePartyId = (ownerId: string, otherPartyId = targetCountryId) => (ownerId === countryId ? otherPartyId : countryId);

  const retargetClauses = (nextTargetCountryId: string) => {
    setTargetCountryId(nextTargetCountryId);
    setClauses((prev) =>
      prev.map((clause) => {
        if (clause.kind === "text_note") return clause;
        const ownerId = clause.fromCountryId === countryId ? countryId : nextTargetCountryId;
        return { ...clause, fromCountryId: ownerId, toCountryId: getOppositePartyId(ownerId, nextTargetCountryId) } as ClauseDraft;
      }),
    );
  };

  const addClause = (kind: TreatyClauseKind, ownerId = countryId) => {
    const otherId = getOppositePartyId(ownerId);
    if (kind !== "text_note" && (!ownerId || !otherId || ownerId === otherId)) {
      toast.error("Сначала выберите вторую сторону договора");
      return;
    }
    if (kind === "transfer_money") {
      setClauses((prev) => [
        ...prev,
        { id: makeId(), kind, fromCountryId: ownerId, toCountryId: otherId, resource: "ducats", amount: "100", paymentCadence: "once" },
      ]);
      return;
    }
    if (kind === "transfer_region") {
      setClauses((prev) => [
        ...prev,
        { id: makeId(), kind, fromCountryId: ownerId, toCountryId: otherId, regionId: "" },
      ]);
      return;
    }
    if (kind === "infrastructure_transit") {
      setClauses((prev) => [
        ...prev,
        {
          id: makeId(),
          kind,
          fromCountryId: ownerId,
          toCountryId: otherId,
          transportModes: ["land", "sea", "air"],
        },
      ]);
      return;
    }
    if (kind === "infrastructure_construction_rights") {
      setClauses((prev) => [
        ...prev,
        {
          id: makeId(),
          kind,
          fromCountryId: ownerId,
          toCountryId: otherId,
          transportModes: ["land", "sea", "air"],
          expirationPolicy: "disable_without_transit",
        },
      ]);
      return;
    }
    setClauses((prev) => [...prev, { id: makeId(), kind, text: "" }]);
  };

  const updateClause = (index: number, next: ClauseDraft) => {
    setClauses((prev) => prev.map((clause, i) => (i === index ? next : clause)));
  };

  const sendProposal = async () => {
    if (!targetCountryId) {
      toast.error("Выберите страну для договора");
      return;
    }
    if (submitClauses.length !== clauses.length || submitClauses.length === 0) {
      toast.error("Заполните пункты договора");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: proposalName.trim() || undefined,
        expiresInTurns: Math.max(1, Math.floor(Number(expiresInTurns || "3"))),
        clauses: submitClauses,
      };
      const result = editingProposalId
        ? await reviseDiplomacyProposal(token, editingProposalId, payload)
        : await createDiplomacyProposal(token, { toCountryId: targetCountryId, ...payload });
      setProposals(result.proposals);
      if (editingProposalId) onProposalRevised?.(editingProposalId);
      setClauses([]);
      setProposalName("");
      setEditingProposalId(null);
      setNewProposalOpen(false);
      setActiveTab("outgoing");
      toast.success(editingProposalId ? "Новая версия договора отправлена" : "Договор отправлен");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "CREATE_DIPLOMACY_PROPOSAL_FAILED";
      if (msg === "REGION_NOT_OWNED") toast.error(tUi("diplomacy.regionNotOwned"));
      else if (msg === "CLAUSE_COUNTRY_OUTSIDE_PARTIES") toast.error("В пункте указана страна вне договора");
      else toast.error("Не удалось отправить договор");
    } finally {
      setSaving(false);
    }
  };

  const acceptProposal = async (proposalId: string) => {
    setSaving(true);
    try {
      const result = await acceptDiplomacyProposal(token, proposalId);
      setProposals(result.proposals);
      toast.success("Договор подписан");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "ACCEPT_DIPLOMACY_PROPOSAL_FAILED";
      if (msg === "INSUFFICIENT_FUNDS") toast.error("У одной из сторон не хватает денег");
      else if (msg === "REGION_NOT_OWNED") toast.error(tUi("diplomacy.regionNotOwned"));
      else toast.error("Не удалось подписать договор");
      void load();
    } finally {
      setSaving(false);
    }
  };

  const rejectProposal = async (proposalId: string) => {
    setSaving(true);
    try {
      const result = await rejectDiplomacyProposal(token, proposalId);
      setProposals(result.proposals);
      toast.success("Договор отклонён");
    } catch {
      toast.error("Не удалось отклонить договор");
    } finally {
      setSaving(false);
    }
  };

  const renewProposal = async (proposalId: string) => {
    setSaving(true);
    try {
      const result = await renewDiplomacyProposal(token, proposalId);
      setProposals(result.proposals);
      toast.success(result.proposal.status === "accepted" ? "Договор продлён" : "Согласие на продление отправлено");
    } catch {
      toast.error("Не удалось продлить договор");
    } finally {
      setSaving(false);
    }
  };

  const declineRenewal = async (proposalId: string) => {
    setSaving(true);
    try {
      const result = await declineDiplomacyProposalRenewal(token, proposalId);
      setProposals(result.proposals);
      toast.success("Продление отклонено");
    } catch {
      toast.error("Не удалось отклонить продление");
    } finally {
      setSaving(false);
    }
  };

  const renderClauseEditor = (clause: ClauseDraft, index: number) => {
    const directionCard =
      clause.kind === "text_note" ? null : (
        <div className="mb-3 rounded-lg border border-[var(--arc-color-brown-dark)] bg-[var(--arc-color-paper-muted)] px-3 py-2">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--arc-color-text-muted)]">
            {clause.fromCountryId === countryId ? "Ваша сторона" : "Вторая сторона"}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm font-semibold text-[var(--arc-color-text-paper)]">
            <span>{countryLabel(countries, clause.fromCountryId)}</span>
            <span className="text-[var(--arc-color-text-muted)]">→</span>
            <span>{countryLabel(countries, clause.toCountryId)}</span>
          </div>
        </div>
      );
    const removeButton = (
      <AppButton
        type="button"
        onClick={() => setClauses((prev) => prev.filter((_, i) => i !== index))}
        variant="danger"
        size="icon"
        className="h-9 w-9"
      >
        <Trash2 size={14} />
      </AppButton>
    );
    if (clause.kind === "text_note") {
      return (
        <div className="rounded-xl border border-[var(--arc-color-brown)] bg-[var(--arc-color-paper-soft)]/80 p-3 shadow-[var(--arc-shadow-inset-soft)]">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-[var(--arc-color-text-muted)]">Текстовый пункт</span>
            {removeButton}
          </div>
          <AppTextarea
            value={clause.text}
            onChange={(e) => updateClause(index, { ...clause, text: e.target.value })}
            rows={3}
            placeholder="Например: стороны обязуются не вмешиваться в колонизацию региона..."
            className="border-[var(--arc-color-brown-dark)] bg-[var(--arc-color-paper-muted)] text-[var(--arc-color-text-paper)] placeholder:text-[var(--arc-color-text-muted)]/45"
          />
        </div>
      );
    }
    if (clause.kind === "infrastructure_transit" || clause.kind === "infrastructure_construction_rights") {
      const toggleMode = (mode: TreatyTransportMode) => {
        const nextModes = clause.transportModes.includes(mode)
          ? clause.transportModes.filter((entry) => entry !== mode)
          : [...clause.transportModes, mode];
        updateClause(index, { ...clause, transportModes: nextModes });
      };
      const isConstructionRights = clause.kind === "infrastructure_construction_rights";
      return (
        <div className="rounded-xl border border-[var(--arc-color-brown)] bg-[var(--arc-color-paper-soft)]/80 p-3 shadow-[var(--arc-shadow-inset-soft)]">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-[var(--arc-color-text-muted)]">
              {isConstructionRights ? "Строительство коридоров" : "Транзит инфраструктуры"}
            </span>
            {removeButton}
          </div>
          {directionCard}
          <div className="mt-3">
            <div className="mb-1 text-[11px] text-[var(--arc-color-text-muted)]">Типы транспорта</div>
            <div className="flex flex-wrap gap-1.5">
              {TRANSPORT_MODE_OPTIONS.map((mode) => {
                const active = clause.transportModes.includes(mode.value);
                return (
                  <button
                    key={mode.value}
                    type="button"
                    onClick={() => toggleMode(mode.value)}
                    className={`rounded-lg border px-2.5 py-1.5 text-xs transition ${
                      active
                        ? "border-[var(--arc-color-primary-top)] bg-[var(--arc-color-primary-top)] text-[var(--arc-color-primary-bottom)]"
                        : "border-[var(--arc-color-brown-dark)] bg-[var(--arc-color-paper-muted)] text-[var(--arc-color-text-muted)] hover:border-[var(--arc-color-primary-top)] hover:text-[var(--arc-color-text-paper)]"
                    }`}
                  >
                    {mode.label}
                  </button>
                );
              })}
            </div>
          </div>
          {isConstructionRights && (
            <div className="mt-3 rounded-lg border border-[var(--arc-color-brown-dark)] bg-[var(--arc-color-paper-muted)] p-2">
              <div className="mb-1 text-[11px] text-[var(--arc-color-text-muted)]">Что произойдёт после окончания договора</div>
              <CustomSelect
                value={clause.expirationPolicy}
                onChange={(value) => updateClause(index, { ...clause, expirationPolicy: value as TreatyConstructionExpirationPolicy })}
                options={CONSTRUCTION_EXPIRATION_POLICY_OPTIONS.map((option) => ({ value: option.value, label: option.label }))}
                buttonClassName="h-[38px] border-[var(--arc-color-brown-dark)] bg-[var(--arc-color-paper-soft)] text-[var(--arc-color-text-paper)]"
              />
              <div className="mt-1 text-[11px] leading-snug text-[var(--arc-color-text-muted)]">
                {CONSTRUCTION_EXPIRATION_POLICY_OPTIONS.find((option) => option.value === clause.expirationPolicy)?.description}
              </div>
            </div>
          )}
        </div>
      );
    }
    const regionOptions = Object.entries(worldBase?.regionOwner ?? {})
      .filter(([, ownerId]) => ownerId === clause.fromCountryId)
      .map(([regionId]) => ({ value: regionId, label: regionLabel(worldBase, regionId) }))
      .sort((a, b) => a.label.localeCompare(b.label, "ru"));
    return (
      <div className="rounded-xl border border-[var(--arc-color-brown)] bg-[var(--arc-color-paper-soft)]/80 p-3 shadow-[var(--arc-shadow-inset-soft)]">
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-[var(--arc-color-text-muted)]">
            {clause.kind === "transfer_money" ? "Передача денег" : tUi("diplomacy.transferRegion")}
          </span>
          {removeButton}
        </div>
        {directionCard}
        {clause.kind === "transfer_money" ? (
          <div className="mt-2 grid gap-2 md:grid-cols-[minmax(0,1fr)_190px_140px]">
            <CustomSelect
              value={clause.resource}
              onChange={(value) => updateClause(index, { ...clause, resource: value as TreatyMoneyResource })}
              options={[
                { value: "ducats", label: "Дукаты" },
                { value: "gold", label: "Золото" },
              ]}
              buttonClassName="h-[38px] border-[var(--arc-color-brown-dark)] bg-[var(--arc-color-paper-muted)] text-[var(--arc-color-text-paper)]"
            />
            <CustomSelect
              value={clause.paymentCadence}
              onChange={(value) => updateClause(index, { ...clause, paymentCadence: value as TreatyMoneyPaymentCadence })}
              options={[
                { value: "once", label: "Разово при подписании" },
                { value: "per_turn", label: "Каждый ход" },
              ]}
              buttonClassName="h-[38px] border-[var(--arc-color-brown-dark)] bg-[var(--arc-color-paper-muted)] text-[var(--arc-color-text-paper)]"
            />
            <AppInput
              value={clause.amount}
              onChange={(e) => updateClause(index, { ...clause, amount: e.target.value })}
              inputMode="decimal"
              className="h-[38px] border-[var(--arc-color-brown-dark)] bg-[var(--arc-color-paper-muted)] text-[var(--arc-color-text-paper)]"
            />
          </div>
        ) : (
          <div className="mt-2">
            <CustomSelect
              value={clause.regionId}
              onChange={(value) => updateClause(index, { ...clause, regionId: value })}
              options={[{ value: "", label: tUi("diplomacy.selectRegion") }, ...regionOptions]}
              buttonClassName="h-[38px] border-[var(--arc-color-brown-dark)] bg-[var(--arc-color-paper-muted)] text-[var(--arc-color-text-paper)]"
            />
          </div>
        )}
      </div>
    );
  };

  const currentCountry = countries.find((country) => country.id === countryId) ?? null;
  const targetCountry = countries.find((country) => country.id === targetCountryId) ?? null;
  const renderArticleColumn = (title: string, subtitle: string, ownerId: string, align: "left" | "right") => (
    <aside className="min-h-0 rounded-t-xl border border-[var(--arc-color-gold-soft)] bg-[var(--arc-color-panel-soft)] shadow-2xl">
      <div className="border-b border-[var(--arc-color-gold)] bg-gradient-to-b from-[var(--arc-color-header-top)] to-[var(--arc-color-header-bottom)] px-4 py-3 text-center">
        <div className="font-display text-2xl text-[var(--arc-color-text-soft)]">
          {title} <span className="text-[var(--arc-color-gold-warm)]">статьи</span>
        </div>
        <div className="mt-1 text-xs text-[var(--arc-color-text-soft)]">{subtitle}</div>
      </div>
      <div className="arc-scrollbar max-h-[calc(82vh-10rem)] overflow-auto p-3">
        {CLAUSE_CATEGORIES.map((category) => (
          <div key={`${align}-${category}`} className="mb-4 last:mb-0">
            <div className="mb-2 rounded-md border border-[var(--arc-color-primary-top)] bg-[var(--arc-color-panel-soft)] px-3 py-2 text-center text-sm font-semibold uppercase tracking-wide text-[var(--arc-color-text-soft)]">
              {category}
            </div>
            <div className="space-y-2">
              {CLAUSE_KIND_OPTIONS.filter((option) => option.category === category).map((option) => {
                const Icon = option.icon;
                return (
                  <button
                    key={`${align}-${option.value}`}
                    type="button"
                    onClick={() => addClause(option.value, ownerId)}
                    disabled={!ownerId || !targetCountryId}
                    className="group grid w-full grid-cols-[38px_minmax(0,1fr)_28px] items-center gap-2 rounded-lg border border-[var(--arc-color-primary-top)] bg-gradient-to-b from-[var(--arc-color-primary-top)] to-[var(--arc-color-primary-bottom)] px-2 py-2 text-left text-[var(--arc-color-text)] shadow-[var(--arc-shadow-inset-button)] transition hover:border-[var(--arc-color-gold)] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    <span className="grid h-9 w-9 place-items-center rounded-full border border-[var(--arc-color-gold)] bg-[var(--arc-overlay-45)] text-[var(--arc-color-gold)]"><Icon size={18} /></span>
                    <span className="truncate text-sm font-semibold">{option.label}</span>
                    <Plus size={18} className="text-[var(--arc-color-gold)]" />
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </aside>
  );

  const newProposalPanel = (
    <AppModal
      modalKey="diplomacy"
      open={newProposalOpen}
      onClose={() => !saving && setNewProposalOpen(false)}
      zIndexClassName="z-[215]"
      paddingClassName="p-3 md:p-6"
      panelClassName="relative mx-auto max-h-full max-w-[1500px] overflow-hidden border-[var(--arc-color-gold-soft)] bg-[var(--arc-color-panel)]"
    >
      <div className="pointer-events-none absolute inset-0 opacity-20 [background:var(--arc-modal-ornament)]" />
      <div className="relative flex min-h-0 flex-1 flex-col">
        <div className="mb-3 grid grid-cols-[48px_minmax(0,1fr)_48px] items-center gap-3 rounded-xl border border-[var(--arc-color-gold-soft)] bg-gradient-to-b from-[var(--arc-color-header-top)] to-[var(--arc-color-header-bottom)] px-4 py-3 shadow-xl">
          <button
            type="button"
            onClick={() => {
              setNewProposalOpen(false);
              setEditingProposalId(null);
            }}
            disabled={saving}
            className="grid h-10 w-10 place-items-center rounded-full border border-[var(--arc-color-gold)] bg-[var(--arc-overlay-35)] text-[var(--arc-color-gold)] transition hover:bg-[var(--arc-overlay-55)] disabled:opacity-50"
          >
            <X size={18} />
          </button>
          <div className="min-w-0 text-center">
            <div className="flex items-center justify-center gap-3">
              <span className="inline-flex items-center gap-2 truncate text-xl font-semibold text-[var(--arc-color-text)]">
                {countryFlag(currentCountry)}
                {countryName}
              </span>
              <Handshake size={22} className="shrink-0 text-[var(--arc-color-gold)]" />
              <span className="inline-flex items-center gap-2 truncate text-xl font-semibold text-[var(--arc-color-text)]">
                {countryFlag(targetCountry)}
                {targetCountry ? targetCountry.name : "Выберите страну"}
              </span>
            </div>
            <div className="mt-1 text-xs text-[var(--arc-color-text-soft)]">{editingProposalId ? "Редакция дипломатического соглашения" : "Дипломатическое соглашение"}</div>
          </div>
          <div className="grid h-10 w-10 place-items-center rounded-full border border-[var(--arc-color-gold)] bg-[var(--arc-overlay-35)] text-[var(--arc-color-gold)]">
            <ScrollText size={18} />
          </div>
        </div>

        <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[300px_minmax(0,1fr)_300px]">
          {renderArticleColumn("Ваши", countryName, countryId, "left")}

          <main className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-[var(--arc-color-gold-soft)] bg-[var(--arc-color-paper)] text-[var(--arc-color-text-paper)] shadow-2xl">
            <div className="border-b border-[var(--arc-color-brown)] bg-[var(--arc-color-paper-toolbar)] px-4 py-3">
              <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_150px]">
                <label className="block">
                  <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[var(--arc-color-text-muted)]">Название договора</span>
                  <AppInput
                    value={proposalName}
                    onChange={(e) => setProposalName(e.target.value)}
                    placeholder="По умолчанию: договор с номером"
                    className="h-[42px] border-[var(--arc-color-brown-dark)] bg-[var(--arc-color-paper-muted)] text-[var(--arc-color-text-paper)] placeholder:text-[var(--arc-color-text-muted)]/45"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[var(--arc-color-text-muted)]">Вторая сторона</span>
                  <CustomSelect
                    value={targetCountryId}
                    onChange={retargetClauses}
                    options={[{ value: "", label: "Выберите страну" }, ...countryOptions]}
                    buttonClassName="h-[42px] border-[var(--arc-color-brown-dark)] bg-[var(--arc-color-paper-muted)] text-[var(--arc-color-text-paper)]"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[var(--arc-color-text-muted)]">Срок</span>
                  <AppInput
                    value={expiresInTurns}
                    onChange={(e) => setExpiresInTurns(e.target.value)}
                    inputMode="numeric"
                    className="h-[42px] border-[var(--arc-color-brown-dark)] bg-[var(--arc-color-paper-muted)] text-[var(--arc-color-text-paper)]"
                  />
                </label>
              </div>
            </div>

            <div className="arc-scrollbar min-h-0 flex-1 overflow-auto p-4">
              <div className="mb-4 grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-sm text-[var(--arc-color-text-muted)]">
                <div className="h-px bg-[var(--arc-color-brown)]" />
                <span className="rounded-md border border-[var(--arc-color-brown)] bg-[var(--arc-color-paper-muted)] px-4 py-2 font-semibold">Действует {Math.max(1, Math.floor(Number(expiresInTurns || "3")))} ход.</span>
                <div className="h-px bg-[var(--arc-color-brown)]" />
              </div>
              {clauses.length === 0 ? (
                <div className="grid min-h-[360px] place-items-center rounded-xl border border-dashed border-[var(--arc-color-brown)] bg-[var(--arc-color-paper-empty)] p-6 text-center text-[var(--arc-color-text-muted)]">
                  <div>
                    <ScrollText size={34} className="mx-auto mb-3 text-[var(--arc-color-text-muted)]" />
                    <div className="font-semibold">Добавьте статьи договора</div>
                    <div className="mt-1 text-sm">Выберите пункт слева или справа, чтобы собрать предложение.</div>
                  </div>
                </div>
              ) : (
                <div className="grid gap-4 xl:grid-cols-2">
                  {[
                    { id: "ours", title: "Ваши условия", party: currentCountry, clauses: clauses.map((clause, index) => ({ clause, index })).filter(({ clause }) => clause.kind === "text_note" || clause.fromCountryId === countryId) },
                    { id: "theirs", title: "Условия второй стороны", party: targetCountry, clauses: clauses.map((clause, index) => ({ clause, index })).filter(({ clause }) => clause.kind !== "text_note" && clause.fromCountryId === targetCountryId) },
                  ].map((column) => (
                    <section key={column.id} className="min-h-[220px] rounded-xl border border-[var(--arc-color-brown)] bg-[var(--arc-color-paper-empty)] p-3">
                      <div className="mb-3 flex items-center gap-2 border-b border-[var(--arc-color-brown)] pb-2 text-sm font-semibold text-[var(--arc-color-text-muted)]">
                        {countryFlag(column.party)}
                        <span>{column.title}</span>
                      </div>
                      {column.clauses.length === 0 ? (
                        <div className="grid min-h-[150px] place-items-center rounded-lg border border-dashed border-[var(--arc-color-brown)] bg-[var(--arc-color-paper-soft)]/45 p-4 text-center text-sm text-[var(--arc-color-text-muted)]">
                          Добавьте пункт из {column.id === "ours" ? "левой" : "правой"} колонки.
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {column.clauses.map(({ clause, index }) => <div key={clause.id}>{renderClauseEditor(clause, index)}</div>)}
                        </div>
                      )}
                    </section>
                  ))}
                </div>
              )}
            </div>

            <div className="border-t border-[var(--arc-color-brown)] bg-[var(--arc-color-paper-toolbar)] p-3">
              <Tooltip content="Отправляет договор второй стороне сразу, без сохранения черновика.">
                <button
                  type="button"
                  onClick={() => void sendProposal()}
                  disabled={saving || loading}
                  className="inline-flex h-12 w-full items-center justify-center gap-3 rounded-lg border border-[var(--arc-color-primary-border)] bg-gradient-to-b from-[var(--arc-color-primary-top)] to-[var(--arc-color-primary-bottom)] px-5 text-[var(--arc-color-text)] shadow-[var(--arc-shadow-inset-button)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-55"
                >
                  <Send size={16} />
                  <span className="font-semibold">{editingProposalId ? "Вернуть с новыми условиями" : "Отправить договор"}</span>
                </button>
              </Tooltip>
            </div>
          </main>

          {renderArticleColumn(targetCountry?.name ?? "Вторая сторона", "Их статьи", targetCountryId, "right")}
        </div>
      </div>
    </AppModal>
  );

  return (
    <>
    <AppModal
      modalKey="diplomacy"
      open={open}
      onClose={onClose}
      paddingClassName="p-3 md:p-6"
      panelClassName="relative mx-auto max-h-full max-w-[1320px] overflow-hidden border-[var(--arc-color-gold-soft)] bg-[var(--arc-color-panel)] p-0"
    >
      <div className="pointer-events-none absolute inset-0 opacity-20 [background:var(--arc-modal-ornament)]" />
      <div className="relative z-10 flex min-h-0 flex-1 flex-col p-3 md:p-4">
        <div className="mb-3 grid grid-cols-[48px_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-[var(--arc-color-gold-soft)] bg-gradient-to-b from-[var(--arc-color-header-top)] to-[var(--arc-color-header-bottom)] px-4 py-3 shadow-xl">
          <div className="grid h-10 w-10 place-items-center rounded-full border border-[var(--arc-color-gold)] bg-[var(--arc-overlay-35)] text-[var(--arc-color-gold)]">
            <Handshake size={18} />
          </div>
          <div className="min-w-0 text-center">
            <div className="font-display text-2xl text-[var(--arc-color-text)]">Дипломатия</div>
            <div className="mt-1 text-xs text-[var(--arc-color-text-soft)]">Конструктор договоров между живыми игроками</div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={beginNewProposal}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-[var(--arc-color-primary-border)] bg-gradient-to-b from-[var(--arc-color-primary-top)] to-[var(--arc-color-primary-bottom)] px-4 text-sm font-semibold text-[var(--arc-color-text)] shadow-[var(--arc-shadow-inset-button)] transition hover:brightness-110"
            >
              <Plus size={15} />
              Новый договор
            </button>
            <button
              type="button"
              onClick={onClose}
              className="grid h-10 w-10 place-items-center rounded-lg border border-[var(--arc-color-gold)] bg-[var(--arc-overlay-30)] text-[var(--arc-color-gold)] transition hover:bg-[var(--arc-overlay-50)]"
            >
              <X size={17} />
            </button>
          </div>
        </div>

        <main className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-[var(--arc-color-gold-soft)] bg-[var(--arc-color-paper)] text-[var(--arc-color-text-paper)] shadow-2xl">
          <div className="border-b border-[var(--arc-color-brown)] bg-[var(--arc-color-paper-toolbar)] px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-2">
                {[
                  ["incoming", "Входящие"],
                  ["outgoing", "Исходящие"],
                  ["active", "Активные договоры"],
                ].map(([key, label]) => {
                  const active = activeTab === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setActiveTab(key as typeof activeTab)}
                      className={`h-9 rounded-lg border px-3 text-sm font-semibold shadow-[var(--arc-shadow-inset-button)] transition ${
                        active
                          ? "border-[var(--arc-color-primary-border)] bg-gradient-to-b from-[var(--arc-color-primary-top)] to-[var(--arc-color-primary-bottom)] text-[var(--arc-color-text)]"
                          : "border-[var(--arc-color-brown-dark)] bg-[var(--arc-color-paper-muted)] text-[var(--arc-color-text-muted)] hover:border-[var(--arc-color-primary-top)] hover:text-[var(--arc-color-text-paper)]"
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                onClick={() => void load()}
                disabled={loading}
                className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-[var(--arc-color-brown-dark)] bg-[var(--arc-color-paper-muted)] px-3 text-sm font-semibold text-[var(--arc-color-text-muted)] transition hover:border-[var(--arc-color-primary-top)] hover:text-[var(--arc-color-text-paper)] disabled:cursor-not-allowed disabled:opacity-55"
              >
                <RefreshCw size={13} />
                Обновить
              </button>
            </div>
          </div>

          <div className="arc-scrollbar min-h-0 flex-1 space-y-3 overflow-auto p-4">
                {filteredProposals.length === 0 ? (
                  <div className="grid min-h-[360px] place-items-center rounded-xl border border-dashed border-[var(--arc-color-brown)] bg-[var(--arc-color-paper-empty)] p-6 text-center text-[var(--arc-color-text-muted)]">
                    <div>
                      <ScrollText size={34} className="mx-auto mb-3 text-[var(--arc-color-text-muted)]" />
                      <div className="font-semibold">Договоров здесь пока нет.</div>
                      <div className="mt-1 text-sm">Создайте новый договор или проверьте другую вкладку.</div>
                    </div>
                  </div>
                ) : (
                  filteredProposals.map((proposal) => (
                    <article key={proposal.id} className="rounded-xl border border-[var(--arc-color-brown)] bg-[var(--arc-color-paper-soft)]/80 p-3 shadow-[var(--arc-shadow-inset-soft)]">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-[var(--arc-color-text-paper)]">
                            {countryLabel(countries, proposal.fromCountryId)} ↔ {countryLabel(countries, proposal.toCountryId)}
                          </div>
                          <div className="mt-1 text-xs text-[var(--arc-color-text-muted)]">
                            {STATUS_LABEL[proposal.status]} · ход {proposal.createdTurnId} - {proposal.expiresTurnId}
                          </div>
                          {proposal.status === "renewal_pending" && (
                            <div className="mt-1 text-[11px] text-[var(--arc-color-warning-border)]">
                              Срок закончился. Согласились: {proposal.renewalAcceptedByCountryIds?.length ?? 0}/2
                            </div>
                          )}
                        </div>
                        {proposal.status === "pending" && (proposal.pendingResponderCountryId ?? proposal.toCountryId) === countryId && (
                          <div className="flex gap-2">
                            <AppButton type="button" disabled={saving} onClick={() => void acceptProposal(proposal.id)} variant="primary" size="sm" icon={<Check size={13} />}>
                              Подписать
                            </AppButton>
                            <AppButton type="button" disabled={saving} onClick={() => beginReviseProposal(proposal)} variant="secondary" size="sm" icon={<RefreshCw size={13} />}>
                              Изменить
                            </AppButton>
                            <AppButton type="button" disabled={saving} onClick={() => void rejectProposal(proposal.id)} variant="danger" size="sm" icon={<X size={13} />}>
                              Отклонить
                            </AppButton>
                          </div>
                        )}
                        {proposal.status === "renewal_pending" && (
                          <div className="flex gap-2">
                            <AppButton
                              type="button"
                              disabled={saving || proposal.renewalAcceptedByCountryIds?.includes(countryId)}
                              onClick={() => void renewProposal(proposal.id)}
                              variant="primary"
                              size="sm"
                              icon={<Check size={13} />}
                            >
                              {proposal.renewalAcceptedByCountryIds?.includes(countryId) ? "Ожидаем вторую сторону" : "Продлить"}
                            </AppButton>
                            <AppButton
                              type="button"
                              disabled={saving}
                              onClick={() => void declineRenewal(proposal.id)}
                              variant="danger"
                              size="sm"
                              icon={<X size={13} />}
                            >
                              Не продлевать
                            </AppButton>
                          </div>
                        )}
                      </div>
                      <div className="mt-3 space-y-2">
                        {(proposal.revision ?? 1) > 1 && (
                          <div className="rounded-lg border border-[var(--arc-color-warning-border)] bg-[var(--arc-color-warning-top)] px-3 py-2 text-xs text-[var(--arc-color-text-muted)]">
                            Переговоры: версия {proposal.revision}. Ход ответа: {proposal.pendingResponderCountryId ? countryLabel(countries, proposal.pendingResponderCountryId) : "нет"}.
                          </div>
                        )}
                        {proposal.clauses.map((clause) => (
                          <div key={clause.id} className="rounded-lg border border-[var(--arc-color-brown)] bg-[var(--arc-color-paper-muted)] px-3 py-2 text-sm leading-5 text-[var(--arc-color-text-paper)]">
                            {clauseSummary(clause, countries, worldBase)}
                          </div>
                        ))}
                      </div>
                    </article>
                  ))
                )}
          </div>
        </main>
      </div>
    </AppModal>
    {newProposalPanel}
    </>
  );
}
