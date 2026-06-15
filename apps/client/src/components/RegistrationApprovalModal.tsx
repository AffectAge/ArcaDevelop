import { Check } from "lucide-react";
import { AppButton } from "./ui/AppButton";
import { AppModal, AppModalHeader } from "./ui/AppModal";
import { AppCard, AppEmptyState } from "./ui/AppSurface";

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
  return (
    <AppModal
      modalKey="registration"
      open={open}
      onClose={() => !pending && onClose()}
      zIndexClassName="z-[130]"
      panelClassName="h-auto w-full max-w-xl"
      paddingClassName="p-4 flex items-center justify-center"
    >
            <AppModalHeader title="Подтверждение регистрации страны" onClose={onClose} closeDisabled={pending} />

            {country ? (
              <div className="space-y-4">
                <AppCard className="bg-black/20">
                  <div className="mb-2 flex items-center gap-3">
                    {country.flagUrl ? (
                      <img src={country.flagUrl} alt="" className="h-8 w-12 rounded object-cover" />
                    ) : (
                      <span className="h-8 w-8 rounded-full border border-white/10" style={{ backgroundColor: country.color }} />
                    )}
                    {country.crestUrl ? (
                      <img src={country.crestUrl} alt="" className="h-8 w-8 rounded-full border border-white/15 object-cover" />
                    ) : (
                      <span
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/15 text-[10px] font-semibold text-white/80"
                        style={{ backgroundColor: country.color }}
                      >
                        {country.name.slice(0, 1).toUpperCase()}
                      </span>
                    )}
                    <div>
                      <div className="text-sm font-semibold text-white">{country.name}</div>
                    </div>
                  </div>
                  <div className="text-xs text-white/65">Подтвердить регистрацию этой страны и разрешить вход в игру?</div>
                </AppCard>

                <div className="flex items-center justify-end gap-2">
                  <AppButton
                    type="button"
                    onClick={onReject}
                    disabled={pending}
                    variant="danger"
                    size="sm"
                  >
                    {pending ? "Обработка..." : "Нет"}
                  </AppButton>
                  <AppButton
                    type="button"
                    onClick={onApprove}
                    disabled={pending}
                    variant="primary"
                    size="sm"
                    icon={<Check size={14} />}
                  >
                    {pending ? "Обработка..." : "Да"}
                  </AppButton>
                </div>
              </div>
            ) : (
              <AppEmptyState>Данные заявки недоступны.</AppEmptyState>
            )}
    </AppModal>
  );
}
