import { Listbox, Transition } from "@headlessui/react";
import { ChevronDown, Check } from "lucide-react";
import { Fragment } from "react";
import { useUiText } from "../i18n/useUiText";

export type CustomSelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

type CustomSelectProps = {
  value: string;
  options: CustomSelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  buttonClassName?: string;
  optionsClassName?: string;
  placement?: "bottom" | "top";
};

export function CustomSelect({
  value,
  options,
  onChange,
  placeholder,
  disabled = false,
  className = "",
  buttonClassName = "",
  optionsClassName = "",
  placement = "bottom",
}: CustomSelectProps) {
  const { t } = useUiText();
  const selected = options.find((opt) => opt.value === value);
  const optionsPlacementClass = placement === "top" ? "bottom-full mb-1" : "top-full mt-1";
  const placeholderLabel = placeholder ?? t("customSelect.placeholder");

  return (
    <div className={`relative ${className}`}>
      <Listbox value={value} onChange={onChange} disabled={disabled}>
        <Listbox.Button
          className={`panel-border flex h-10 w-full items-center justify-between rounded-lg bg-[var(--arc-color-paper-muted)] px-3 text-left text-sm text-[var(--arc-color-text-paper)] shadow-[var(--arc-shadow-inset-soft)] outline-none transition hover:border-[var(--arc-color-primary-top)] disabled:cursor-not-allowed disabled:opacity-60 ${buttonClassName}`}
        >
          <span className={selected ? "truncate text-[var(--arc-color-text-paper)]" : "truncate text-[var(--arc-color-text-muted)]"}>
            {selected?.label ?? placeholderLabel}
          </span>
          <ChevronDown size={15} className="ml-2 shrink-0 text-[var(--arc-color-text-muted)]" />
        </Listbox.Button>
        <Transition
          as={Fragment}
          leave="transition ease-in duration-100"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <Listbox.Options
            className={`arc-scrollbar panel-border absolute ${optionsPlacementClass} z-[260] max-h-64 w-full overflow-auto rounded-lg bg-[var(--arc-color-paper-soft)] p-1 text-sm text-[var(--arc-color-text-paper)] shadow-2xl ${optionsClassName}`}
          >
            {options.length === 0 && (
              <div className="px-2 py-2 text-xs text-[var(--arc-color-text-muted)]">{t("customSelect.noOptions")}</div>
            )}
            {options.map((option) => (
              <Listbox.Option
                key={option.value}
                value={option.value}
                disabled={option.disabled}
                className={({ active, disabled: optionDisabled }) =>
                  `relative flex cursor-pointer items-center rounded-md px-2 py-2 pr-8 text-sm transition ${
                    optionDisabled
                      ? "cursor-not-allowed text-[var(--arc-color-text-muted)] opacity-45"
                      : active
                        ? "bg-[var(--arc-color-primary-top)] text-[var(--arc-color-text)]"
                        : "text-[var(--arc-color-text-paper)] hover:bg-[var(--arc-color-paper-muted)]"
                  }`
                }
              >
                {({ selected: isSelected }) => (
                  <>
                    <span className={isSelected ? "truncate font-semibold" : "truncate"}>{option.label}</span>
                    {isSelected && (
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--arc-color-gold)]">
                        <Check size={14} />
                      </span>
                    )}
                  </>
                )}
              </Listbox.Option>
            ))}
          </Listbox.Options>
        </Transition>
      </Listbox>
    </div>
  );
}
