import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react";

type FieldProps = {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  children: ReactNode;
  className?: string;
};

type AppInputProps = InputHTMLAttributes<HTMLInputElement> & {
  invalid?: boolean;
};

type AppTextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  invalid?: boolean;
};

type AppToggleProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
  className?: string;
};

export function AppField({ label, hint, error, children, className = "" }: FieldProps) {
  return (
    <label className={`block ${className}`}>
      {label ? <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[var(--arc-color-text-muted)]">{label}</span> : null}
      {children}
      <span className="mt-1 flex min-h-4 items-center justify-between gap-2 text-[11px]">
        <span className={error ? "text-[var(--arc-color-danger-ink)]" : "text-[var(--arc-color-text-muted)]"}>{error ?? hint}</span>
      </span>
    </label>
  );
}

export function AppInput({ invalid = false, className = "", ...props }: AppInputProps) {
  return (
    <input
      {...props}
      className={`w-full rounded-lg border bg-[var(--arc-color-paper-muted)] px-3 py-2 text-sm text-[var(--arc-color-text-paper)] shadow-[var(--arc-shadow-inset-soft)] outline-none transition placeholder:text-[var(--arc-color-text-muted)] disabled:opacity-50 ${
        invalid ? "border-[var(--arc-color-danger-ink)] focus:border-[var(--arc-color-danger-ink)]" : "border-[var(--arc-color-brown-dark)] focus:border-[var(--arc-color-primary-top)]"
      } ${className}`}
    />
  );
}

export function AppTextarea({ invalid = false, className = "", ...props }: AppTextareaProps) {
  return (
    <textarea
      {...props}
      className={`w-full resize-y rounded-lg border bg-[var(--arc-color-paper-muted)] px-3 py-2 text-sm text-[var(--arc-color-text-paper)] shadow-[var(--arc-shadow-inset-soft)] outline-none transition placeholder:text-[var(--arc-color-text-muted)] disabled:opacity-50 ${
        invalid ? "border-[var(--arc-color-danger-ink)] focus:border-[var(--arc-color-danger-ink)]" : "border-[var(--arc-color-brown-dark)] focus:border-[var(--arc-color-primary-top)]"
      } ${className}`}
    />
  );
}

export function AppToggle({ checked, onChange, label, description, disabled = false, className = "" }: AppToggleProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`flex w-full items-center justify-between gap-3 rounded-lg border border-[var(--arc-color-brown)] bg-[var(--arc-color-paper-soft)] px-3 py-2 text-left shadow-[var(--arc-shadow-inset-soft)] transition hover:border-[var(--arc-color-primary-top)] disabled:opacity-50 ${className}`}
      aria-pressed={checked}
    >
      <span>
        <span className="block text-sm font-semibold text-[var(--arc-color-text-paper)]">{label}</span>
        {description ? <span className="mt-0.5 block text-xs text-[var(--arc-color-text-muted)]">{description}</span> : null}
      </span>
      <span
        className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition ${
          checked ? "border-[var(--arc-color-primary-border)] bg-[var(--arc-color-primary-top)]" : "border-[var(--arc-color-brown-dark)] bg-[var(--arc-color-paper-toolbar)]"
        }`}
      >
        <span
          className={`h-5 w-5 rounded-full transition ${
            checked ? "translate-x-6 bg-[var(--arc-color-text)]" : "translate-x-1 bg-[var(--arc-color-paper-soft)]"
          }`}
        />
      </span>
    </button>
  );
}
