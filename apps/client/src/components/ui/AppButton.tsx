import type { ButtonHTMLAttributes, ReactNode } from "react";

type AppButtonVariant = "primary" | "secondary" | "danger" | "ghost" | "success" | "warning" | "selected";
type AppButtonSize = "sm" | "md" | "icon";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: AppButtonVariant;
  size?: AppButtonSize;
  icon?: ReactNode;
};

const variantClass: Record<AppButtonVariant, string> = {
  primary: "border border-[var(--arc-color-primary-border)] bg-gradient-to-b from-[var(--arc-color-primary-top)] to-[var(--arc-color-primary-bottom)] font-semibold text-[var(--arc-color-text)] shadow-[var(--arc-shadow-inset-button)] hover:brightness-110",
  secondary: "border border-[var(--arc-color-brown-dark)] bg-[var(--arc-color-paper-muted)] text-[var(--arc-color-text-muted)] shadow-[var(--arc-shadow-inset-soft)] hover:border-[var(--arc-color-primary-top)] hover:text-[var(--arc-color-text-paper)]",
  danger: "border border-[var(--arc-color-danger-border)] bg-gradient-to-b from-[var(--arc-color-danger-top)] to-[var(--arc-color-danger-bottom)] font-semibold text-[var(--arc-color-danger-text)] shadow-[var(--arc-shadow-inset-button)] hover:brightness-110",
  ghost: "border border-[var(--arc-color-brown-dark)] bg-[var(--arc-color-panel)] text-[var(--arc-color-text-soft)] hover:border-[var(--arc-color-gold)] hover:bg-[var(--arc-color-panel-soft)] hover:text-[var(--arc-color-text)]",
  success: "border border-[var(--arc-color-success-border)] bg-gradient-to-b from-[var(--arc-color-success-top)] to-[var(--arc-color-success-bottom)] font-semibold text-[var(--arc-color-success-text)] shadow-[var(--arc-shadow-inset-button)] hover:brightness-110",
  warning: "border border-[var(--arc-color-warning-border)] bg-gradient-to-b from-[var(--arc-color-warning-top)] to-[var(--arc-color-warning-bottom)] font-semibold text-[var(--arc-color-text-paper)] shadow-[var(--arc-shadow-inset-button)] hover:brightness-110",
  selected: "border border-[var(--arc-color-primary-border)] bg-gradient-to-b from-[var(--arc-color-primary-top)] to-[var(--arc-color-primary-bottom)] font-semibold text-[var(--arc-color-text)] shadow-[var(--arc-shadow-inset-button)]",
};

const sizeClass: Record<AppButtonSize, string> = {
  sm: "h-8 rounded-lg px-2 text-xs",
  md: "h-10 rounded-lg px-3 text-sm",
  icon: "h-10 w-10 rounded-lg p-0",
};

export function AppButton({ variant = "secondary", size = "md", icon, children, className = "", ...props }: Props) {
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-2 whitespace-nowrap transition disabled:cursor-not-allowed disabled:opacity-50 ${variantClass[variant]} ${sizeClass[size]} ${className}`}
    >
      {icon}
      {children}
    </button>
  );
}
