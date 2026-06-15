import type { HTMLAttributes, ReactNode } from "react";

type Props = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
};

type SectionHeaderProps = HTMLAttributes<HTMLDivElement> & {
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  actions?: ReactNode;
};

type EmptyStateProps = HTMLAttributes<HTMLDivElement> & {
  children?: ReactNode;
  title?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
};

export function AppToolbar({ children, className = "", ...props }: Props) {
  return (
    <div {...props} className={`mb-3 rounded-xl border border-[var(--arc-color-brown)] bg-[var(--arc-color-paper-toolbar)] p-3 shadow-[var(--arc-shadow-inset-soft)] ${className}`}>
      {children}
    </div>
  );
}

export function AppSection({ children, className = "", ...props }: Props) {
  return (
    <section {...props} className={`min-h-0 rounded-xl border border-[var(--arc-color-gold-soft)] bg-[var(--arc-color-paper)] p-3 text-[var(--arc-color-text-paper)] shadow-2xl ${className}`}>
      {children}
    </section>
  );
}

export function AppCard({ children, className = "", ...props }: Props) {
  return (
    <div {...props} className={`rounded-xl border border-[var(--arc-color-brown)] bg-[var(--arc-color-paper-soft)] p-3 text-[var(--arc-color-text-paper)] shadow-[var(--arc-shadow-inset-soft)] ${className}`}>
      {children}
    </div>
  );
}

export function AppSectionHeader({ title, description, icon, actions, className = "", ...props }: SectionHeaderProps) {
  return (
    <div {...props} className={`mb-3 flex items-start justify-between gap-3 ${className}`}>
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-sm font-semibold text-[var(--arc-color-text-paper)]">
          {icon ? <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--arc-color-brown-dark)] bg-[var(--arc-color-paper-muted)] text-[var(--arc-color-text-muted)]">{icon}</span> : null}
          <span className="truncate">{title}</span>
        </div>
        {description ? <div className="mt-1 text-xs text-[var(--arc-color-text-muted)]">{description}</div> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function AppEmptyState({ children, title, icon, action, className = "", ...props }: EmptyStateProps) {
  return (
    <div {...props} className={`rounded-xl border border-dashed border-[var(--arc-color-brown)] bg-[var(--arc-color-paper-empty)] px-3 py-6 text-center text-sm text-[var(--arc-color-text-muted)] ${className}`}>
      {icon ? <div className="mx-auto mb-2 inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--arc-color-brown)] bg-[var(--arc-color-paper-soft)] text-[var(--arc-color-text-muted)]">{icon}</div> : null}
      {title ? <div className="font-semibold text-[var(--arc-color-text-paper)]">{title}</div> : null}
      {children ? <div className={title ? "mt-1" : ""}>{children}</div> : null}
      {action ? <div className="mt-3 flex justify-center">{action}</div> : null}
    </div>
  );
}
