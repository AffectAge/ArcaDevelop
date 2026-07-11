import { Dialog } from "@headlessui/react";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { Check, Handshake, History, RefreshCw, ScrollText, X } from "lucide-react";
import { toast } from "sonner";
import type { Country, DiplomacyProposal, TreatyClause, TreatyTransportMode, WorldBase } from "@arcanorum/shared";
import { acceptDiplomacyProposal, fetchCountries, fetchDiplomacyProposals, rejectDiplomacyProposal } from "../lib/api";
import { AppButton } from "./templates/AppButton";
import { AppEmptyState } from "./templates/AppSurface";
import type { UiTextKey } from "../i18n/uiText";
import { useUiText } from "../i18n/useUiText";

type Props = {
  open: boolean;
  token: string;
  countryId: string;
  proposalId: string | null;
  worldBase: WorldBase | null;
  onClose: () => void;
  onRevise: (proposal: DiplomacyProposal) => void;
  onResolved?: (proposalId: string) => void;
};

const TRANSPORT_LABEL_KEY: Record<TreatyTransportMode, UiTextKey> = {
  land: "diplomacy.transportLand",
  sea: "diplomacy.transportSea",
  air: "diplomacy.transportAir",
  pipeline: "diplomacy.transportPipeline",
  powerGrid: "diplomacy.transportPowerGrid",
};

function countryLabel(countries: Country[], countryId: string) {
  return countries.find((country) => country.id === countryId)?.name ?? countryId;
}

function countryFlag(country: Country | null | undefined) {
  if (country?.flagUrl) {
    return <img src={country.flagUrl} alt="" className="h-3 w-6 rounded-sm border border-black/30 object-cover" />;
  }
  return <span className="h-3 w-6 rounded-sm border border-black/30" style={{ backgroundColor: country?.color ?? "var(--arc-color-text-muted)" }} />;
}

function resourceLabelKey(resource: string): UiTextKey {
  return resource === "gold" ? "diplomacy.resourceGold" : "diplomacy.resourceDucats";
}

function clauseTitle(clause: TreatyClause, t: (key: UiTextKey, params?: Record<string, string | number>) => string) {
  if (clause.kind === "transfer_money") return t("diplomacy.clauseTransferMoney");
  if (clause.kind === "transfer_region") return t("diplomacy.transferRegion");
  if (clause.kind === "infrastructure_transit") return t("diplomacy.clauseTransit");
  if (clause.kind === "infrastructure_construction_rights") return t("diplomacy.clauseConstructionRights");
  return t("diplomacy.clauseTextNote");
}

function clauseSummary(clause: TreatyClause, countries: Country[], _worldBase: WorldBase | null, t: (key: UiTextKey, params?: Record<string, string | number>) => string) {
  if (clause.kind === "transfer_money") {
    return t("diplomacy.summaryMoney", {
      from: countryLabel(countries, clause.fromCountryId),
      to: countryLabel(countries, clause.toCountryId),
      amount: clause.amount,
      resource: t(resourceLabelKey(clause.resource)),
      cadence: clause.paymentCadence === "per_turn" ? t("diplomacy.paymentPerTurn") : t("diplomacy.paymentOnce"),
    });
  }
  if (clause.kind === "transfer_region") {
    return t("diplomacy.transferRegionSummary", {
      from: countryLabel(countries, clause.fromCountryId),
      to: countryLabel(countries, clause.toCountryId),
      region: clause.regionId,
    });
  }
  if (clause.kind === "infrastructure_transit") {
    const modes = clause.transportModes.map((mode) => t(TRANSPORT_LABEL_KEY[mode])).join(", ");
    return t("diplomacy.summaryTransit", {
      from: countryLabel(countries, clause.fromCountryId),
      to: countryLabel(countries, clause.toCountryId),
      modes,
    });
  }
  if (clause.kind === "infrastructure_construction_rights") {
    const modes = clause.transportModes.map((mode) => t(TRANSPORT_LABEL_KEY[mode])).join(", ");
    const policy = clause.expirationPolicy === "nationalize_to_territory_owner" ? t("diplomacy.policyNationalize") : t("diplomacy.policyDisableWithoutTransit");
    return t("diplomacy.summaryConstructionRights", {
      from: countryLabel(countries, clause.fromCountryId),
      to: countryLabel(countries, clause.toCountryId),
      modes,
      policy,
    });
  }
  return clause.text;
}

export function DiplomacyProposalStoryModal({ open, token, countryId, proposalId, worldBase, onClose, onRevise, onResolved }: Props) {
  const { t } = useUiText();
  const [loading, setLoading] = useState(false);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [proposal, setProposal] = useState<DiplomacyProposal | null>(null);
  const [countries, setCountries] = useState<Country[]>([]);

  useEffect(() => {
    if (!open || !proposalId) return;
    let cancelled = false;
    setLoading(true);
    Promise.all([fetchCountries(), fetchDiplomacyProposals(token)])
      .then(([countryRows, proposalRows]) => {
        if (cancelled) return;
        setCountries(countryRows);
        setProposal(proposalRows.proposals.find((entry) => entry.id === proposalId) ?? null);
      })
      .catch(() => {
        if (!cancelled) toast.error(t("diplomacy.loadFailed"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, proposalId, token]);

  const canRespond = Boolean(proposal && proposal.status === "pending" && (proposal.pendingResponderCountryId ?? proposal.toCountryId) === countryId);
  const fromCountry = proposal ? countries.find((country) => country.id === proposal.fromCountryId) ?? null : null;
  const toCountry = proposal ? countries.find((country) => country.id === proposal.toCountryId) ?? null : null;

  const act = async (kind: "accept" | "reject") => {
    if (!proposal) return;
    setPendingAction(kind);
    try {
      if (kind === "accept") {
        await acceptDiplomacyProposal(token, proposal.id);
        toast.success(t("diplomacy.signed"));
      } else {
        await rejectDiplomacyProposal(token, proposal.id);
        toast.success(t("diplomacy.rejected"));
      }
      onResolved?.(proposal.id);
      onClose();
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      toast.error(message === "NOT_YOUR_TURN" ? t("diplomacy.storyYourTurnFailed") : t("diplomacy.storyActionFailed"));
    } finally {
      setPendingAction(null);
    }
  };

  const title = proposal ? proposal.name : t("diplomacy.storyDefaultTitle");

  return (
    <Dialog open={open} onClose={onClose} className="arc-modal arc-modal--diplomacy-story relative z-[190]">
      <motion.div aria-hidden="true" className="fixed inset-0 bg-[var(--arc-modal-backdrop)] backdrop-blur-[2px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
      <div className="fixed inset-0 flex items-center justify-center p-4 md:p-7">
        <Dialog.Panel
          as={motion.div}
          initial={{ opacity: 0, y: 14, scale: 0.985 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.99 }}
          className="relative flex max-h-[min(90vh,820px)] w-[min(96vw,1320px)] flex-col overflow-hidden rounded-xl border border-[var(--arc-color-gold-soft)] bg-[var(--arc-color-panel)] shadow-2xl shadow-black/70"
        >
          <div className="pointer-events-none absolute inset-0 opacity-20 [background:var(--arc-modal-ornament)]" />

          <div className="relative z-10 grid grid-cols-[44px_minmax(0,1fr)_44px] items-center gap-3 border-b border-[var(--arc-color-gold-soft)] bg-gradient-to-b from-[var(--arc-color-header-top)] to-[var(--arc-color-header-bottom)] px-4 py-3">
            <div className="grid h-10 w-10 place-items-center rounded-full border border-[var(--arc-color-gold)] bg-[var(--arc-overlay-35)] text-[var(--arc-color-gold)]">
              <ScrollText size={18} />
            </div>
            <div className="min-w-0 text-center">
              <Dialog.Title className="truncate text-2xl font-semibold text-[var(--arc-color-text)]">{title}</Dialog.Title>
              <div className="mt-1 text-xs text-[var(--arc-color-text-soft)]">
                {proposal
                  ? t("diplomacy.storySubtitle", { revision: proposal.revision ?? 1, from: proposal.createdTurnId, to: proposal.expiresTurnId })
                  : t("diplomacy.storyLoading")}
              </div>
            </div>
            <button type="button" onClick={onClose} className="grid h-10 w-10 place-items-center rounded-lg border border-[var(--arc-color-gold)] bg-[var(--arc-overlay-30)] text-[var(--arc-color-gold)] transition hover:bg-[var(--arc-overlay-50)]">
              <X size={17} />
            </button>
          </div>

          {loading || !proposal ? (
            <div className="relative z-10 p-6">
              <AppEmptyState title={t("diplomacy.storyLoading")}>{t("diplomacy.storyLoadingDescription")}</AppEmptyState>
            </div>
          ) : (
            <div className="relative z-10 grid min-h-0 flex-1 gap-4 p-4 lg:grid-cols-[330px_minmax(0,1fr)]">
              <aside className="min-h-0 overflow-hidden rounded-t-xl border border-[var(--arc-color-gold-soft)] bg-[var(--arc-color-panel-soft)] shadow-2xl">
                <div className="border-b border-[var(--arc-color-gold)] bg-gradient-to-b from-[var(--arc-color-header-top)] to-[var(--arc-color-header-bottom)] px-4 py-3 text-center">
                  <div className="font-display text-2xl text-[var(--arc-color-text-soft)]">{t("diplomacy.storyArticles")}</div>
                  <div className="mt-1 text-xs text-[var(--arc-color-text-soft)]">{t("diplomacy.storyArticlesCount", { count: proposal.clauses.length })}</div>
                </div>
                <div className="arc-scrollbar max-h-[calc(82vh-13rem)] space-y-2 overflow-auto p-3">
                  {proposal.clauses.map((clause, index) => (
                    <div key={clause.id} className="rounded-lg border border-[var(--arc-color-primary-top)] bg-gradient-to-b from-[var(--arc-color-primary-top)] to-[var(--arc-color-primary-bottom)] p-3 text-[var(--arc-color-text)]">
                      <div className="flex items-center gap-2">
                        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-[var(--arc-color-gold)] bg-[var(--arc-overlay-45)] text-xs text-[var(--arc-color-gold)]">{index + 1}</span>
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold">{clauseTitle(clause, t)}</div>
                          <div className="mt-0.5 text-[11px] text-[var(--arc-color-text-soft)]">{t("diplomacy.storyArticle", { number: index + 1 })}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </aside>

              <main className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-[var(--arc-color-gold-soft)] bg-[var(--arc-color-paper)] text-[var(--arc-color-text-paper)] shadow-2xl">
                <div className="border-b border-[var(--arc-color-brown)] bg-[var(--arc-color-paper-toolbar)] p-4">
                  <div className="grid grid-cols-[minmax(0,1fr)_48px_minmax(0,1fr)] items-center gap-3">
                    {[fromCountry, toCountry].map((party, index) => (
                      <div key={index} className={`min-w-0 ${index === 1 ? "text-right" : ""}`}>
                        <div className={`mb-1 flex items-center gap-2 ${index === 1 ? "justify-end" : ""}`}>
                          {countryFlag(party)}
                          <span className="truncate text-lg font-semibold">{party?.name ?? (index === 0 ? proposal.fromCountryId : proposal.toCountryId)}</span>
                        </div>
                        <div className="text-[11px] uppercase tracking-wide text-[var(--arc-color-text-muted)]">{index === 0 ? t("diplomacy.initiator") : t("diplomacy.secondParty")}</div>
                      </div>
                    ))}
                    <div className="grid h-12 w-12 place-items-center rounded-full border border-[var(--arc-color-brown)] bg-[var(--arc-color-paper-soft)] text-[var(--arc-color-text-muted)]">
                      <Handshake size={20} />
                    </div>
                  </div>
                  <div className="mt-4 grid gap-2 text-xs md:grid-cols-3">
                    <div className="rounded-lg border border-[var(--arc-color-brown)] bg-[var(--arc-color-paper-soft)]/75 px-3 py-2">
                      <div className="text-[var(--arc-color-text-muted)]">{t("diplomacy.storyVersion")}</div>
                      <div className="mt-1 font-semibold">{proposal.revision ?? 1}</div>
                    </div>
                    <div className="rounded-lg border border-[var(--arc-color-brown)] bg-[var(--arc-color-paper-soft)]/75 px-3 py-2">
                      <div className="text-[var(--arc-color-text-muted)]">{t("diplomacy.durationLabel")}</div>
                      <div className="mt-1 font-semibold">{t("diplomacy.storyExpires", { turn: proposal.expiresTurnId })}</div>
                    </div>
                    <div className="rounded-lg border border-[var(--arc-color-brown)] bg-[var(--arc-color-paper-soft)]/75 px-3 py-2">
                      <div className="text-[var(--arc-color-text-muted)]">{t("diplomacy.responder")}</div>
                      <div className="mt-1 font-semibold">{proposal.pendingResponderCountryId ? countryLabel(countries, proposal.pendingResponderCountryId) : t("diplomacy.noResponder")}</div>
                    </div>
                  </div>
                </div>

                <div className="arc-scrollbar min-h-0 flex-1 overflow-auto p-4">
                  <div className="grid gap-3 xl:grid-cols-2">
                    {proposal.clauses.map((clause, index) => (
                      <div key={clause.id} className="rounded-xl border border-[var(--arc-color-brown)] bg-[var(--arc-color-paper-soft)]/80 p-3 shadow-[var(--arc-shadow-inset-soft)]">
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--arc-color-text-muted)]">
                          {t("diplomacy.storyArticle", { number: index + 1 })} · {clauseTitle(clause, t)}
                        </div>
                        <div className="mt-2 text-sm leading-5 text-[var(--arc-color-text-paper)]">{clauseSummary(clause, countries, worldBase, t)}</div>
                      </div>
                    ))}
                  </div>

                  {(proposal.revisionHistory ?? []).length > 0 && (
                    <div className="mt-5">
                      <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-[var(--arc-color-text-muted)]">
                        <History size={15} />
                        {t("diplomacy.storyNegotiationChain")}
                      </div>
                      <div className="grid gap-2">
                        {(proposal.revisionHistory ?? []).slice(-5).map((entry) => (
                          <div key={`${entry.revision}-${entry.createdAt}`} className="rounded-lg border border-[var(--arc-color-brown)] bg-[var(--arc-color-paper-soft)]/70 px-3 py-2 text-xs text-[var(--arc-color-text-muted)]">
                            {t("diplomacy.storyRevision", {
                              revision: entry.revision,
                              from: countryLabel(countries, entry.editedByCountryId),
                              to: countryLabel(countries, entry.sentToCountryId),
                              turn: entry.turnId,
                            })}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="grid gap-2 border-t border-[var(--arc-color-brown)] bg-[var(--arc-color-paper-toolbar)] p-3 md:grid-cols-3">
                  <AppButton type="button" variant="primary" disabled={!canRespond || Boolean(pendingAction)} icon={<Check size={14} />} onClick={() => void act("accept")}>
                    {pendingAction === "accept" ? t("diplomacy.storyPendingAccept") : t("diplomacy.accept")}
                  </AppButton>
                  <AppButton type="button" variant="secondary" disabled={!canRespond || Boolean(pendingAction)} icon={<RefreshCw size={14} />} onClick={() => onRevise(proposal)}>
                    {t("diplomacy.submitRevision")}
                  </AppButton>
                  <AppButton type="button" variant="danger" disabled={!canRespond || Boolean(pendingAction)} icon={<X size={14} />} onClick={() => void act("reject")}>
                    {pendingAction === "reject" ? t("diplomacy.storyPendingReject") : t("diplomacy.reject")}
                  </AppButton>
                </div>
              </main>
            </div>
          )}
        </Dialog.Panel>
      </div>
    </Dialog>
  );
}
