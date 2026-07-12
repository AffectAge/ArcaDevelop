import { Check } from "lucide-react";
import { AppButton } from "./templates/AppButton";
import { AppModal, AppModalHeader } from "./templates/AppModal";
import { AppCard, AppEmptyState } from "./templates/AppSurface";
import { useUiText } from "../i18n/useUiText";

type Props = {
  open: boolean;
  pending?: boolean;
  country:
    | {
        id: string;
        name: string;
        color: string;
        flagUrl?: string | null;
        crestUrl?: string | null;
      }
    | null;
  onClose: () => void;
  onApprove: () => void;
  onReject: () => void;
};

export function RegistrationApprovalModal({ open, pending = false, country, onClose, onApprove, onReject }: Props) {
  const { t } = useUiText();

  return (
    <AppModal
      modalKey="registration"
      open={open}
      onClose={() => !pending && onClose()}
      zIndexClassName="z-[130]"
      panelClassName="h-auto w-full max-w-xl"
      paddingClassName="p-4 flex items-center justify-center"
    >
            <AppModalHeader title={t("shell.registrationReviewTitle")} onClose={onClose} closeDisabled={pending} />

            {country ? (
              <div className="space-y-4">
                <AppCard className="border border-[var(--arc-color-gold-soft)] bg-[var(--arc-overlay-30)]">
                  <div className="mb-2 flex items-center gap-3">
                    {country.flagUrl ? (
                      <img src={country.flagUrl} alt="" className="h-8 w-12 rounded-[var(--arc-radius-sm)] object-cover" />
                    ) : (
                      <span className="h-8 w-8 rounded-full border border-[var(--arc-color-gold-soft)]" style={{ backgroundColor: country.color }} />
                    )}
                    {country.crestUrl ? (
                      <img src={country.crestUrl} alt="" className="h-8 w-8 rounded-full border border-[var(--arc-color-gold-soft)] object-cover" />
                    ) : (
                      <span
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[var(--arc-color-gold-soft)] text-[10px] font-semibold text-[var(--arc-color-text)]"
                        style={{ backgroundColor: country.color }}
                      >
                        {country.name.slice(0, 1).toUpperCase()}
                      </span>
                    )}
                    <div>
                      <div className="text-sm font-semibold text-[var(--arc-color-text)]">{country.name}</div>
                    </div>
                  </div>
                  <div className="text-xs text-[var(--arc-color-text-soft)]">{t("shell.registrationReviewPrompt")}</div>
                </AppCard>

                <div className="flex items-center justify-end gap-2">
                  <AppButton
                    type="button"
                    onClick={onReject}
                    disabled={pending}
                    variant="danger"
                    size="sm"
                  >
                    {pending ? t("common.pending") : t("diplomacy.reject")}
                  </AppButton>
                  <AppButton
                    type="button"
                    onClick={onApprove}
                    disabled={pending}
                    variant="primary"
                    size="sm"
                    icon={<Check size={14} />}
                  >
                    {pending ? t("common.pending") : t("common.confirm")}
                  </AppButton>
                </div>
              </div>
            ) : (
              <AppEmptyState>{t("shell.registrationReviewUnavailable")}</AppEmptyState>
            )}
    </AppModal>
  );
}
