import { AppButton } from "./ui/AppButton";
import { AppField, AppInput } from "./ui/AppForm";
import { AppModal, AppModalHeader } from "./ui/AppModal";
import { AppCard } from "./ui/AppSurface";
import { useUiText } from "../i18n/useUiText";

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  label?: string;
  placeholder?: string;
  description?: string;
  hint?: string;
  maxLength?: number;
  submitLabel?: string;
  cancelLabel?: string;
  pending?: boolean;
  disabledSubmit?: boolean;
  zIndexClassName?: string;
};

export function TextInputModal({
  open,
  onClose,
  title,
  value,
  onChange,
  onSubmit,
  label,
  placeholder,
  description,
  hint,
  maxLength = 80,
  submitLabel,
  cancelLabel,
  pending = false,
  disabledSubmit = false,
  zIndexClassName = "z-[210]",
}: Props) {
  const { t } = useUiText();
  const canSubmit = !pending && !disabledSubmit;
  const submitText = submitLabel ?? t("common.save");
  const cancelText = cancelLabel ?? t("common.cancel");

  return (
    <AppModal
      modalKey="text-input"
      open={open}
      onClose={() => !pending && onClose()}
      zIndexClassName={zIndexClassName}
      panelClassName="h-auto w-full max-w-lg"
      paddingClassName="p-4 flex items-center justify-center"
    >
            <AppModalHeader title={title} onClose={onClose} closeDisabled={pending} />

            {description ? (
              <AppCard className="mb-3 bg-[var(--arc-overlay-30)] text-xs text-[var(--arc-color-text-soft)]">{description}</AppCard>
            ) : null}

            <AppField
              label={label}
              hint={hint ?? t("textInput.emptyResets")}
            >
              <AppInput
                autoFocus
                value={value}
                maxLength={maxLength}
                onChange={(e) => onChange(e.target.value.slice(0, maxLength))}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && canSubmit) {
                    e.preventDefault();
                    onSubmit();
                  }
                }}
                placeholder={placeholder}
              />
              <div className="-mt-5 flex justify-end text-[11px]">
                <span className={value.trim().length >= maxLength ? "text-[var(--arc-color-gold)]" : "text-[var(--arc-color-text-muted)]"}>
                  {value.length}/{maxLength}
                </span>
              </div>
            </AppField>

            <div className="mt-4 flex items-center justify-end gap-2">
              <AppButton
                type="button"
                onClick={onClose}
                disabled={pending}
                variant="ghost"
                size="sm"
              >
                {cancelText}
              </AppButton>
              <AppButton
                type="button"
                onClick={onSubmit}
                disabled={!canSubmit}
                variant="primary"
                size="sm"
              >
                {pending ? t("common.saving") : submitText}
              </AppButton>
            </div>
    </AppModal>
  );
}
