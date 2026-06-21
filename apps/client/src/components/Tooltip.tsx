import { forwardRef, isValidElement, useId, useState } from "react";
import {
  autoUpdate,
  flip,
  FloatingPortal,
  offset,
  shift,
  useClick,
  useDismiss,
  useFloating,
  useFocus,
  useHover,
  useInteractions,
  useRole,
  type Placement,
} from "@floating-ui/react";
import type { HTMLAttributes, ReactNode } from "react";

export type TooltipTone = "default" | "positive" | "negative" | "warning" | "info" | "muted" | "accent";

export type TooltipRow = {
  id?: string;
  label: ReactNode;
  value: ReactNode;
  detail?: ReactNode;
  tone?: TooltipTone;
};

export type TooltipSection = {
  id?: string;
  title?: ReactNode;
  rows?: TooltipRow[];
  content?: ReactNode;
};

export type TooltipStructuredContent = {
  title?: ReactNode;
  eyebrow?: ReactNode;
  icon?: ReactNode;
  description?: ReactNode;
  rows?: TooltipRow[];
  sections?: TooltipSection[];
  shortcut?: ReactNode;
  footer?: ReactNode;
  tone?: TooltipTone;
};

type TooltipProps = {
  content: ReactNode | TooltipStructuredContent;
  children: ReactNode;
  placement?: Placement;
  variant?: "compact" | "rich";
  disabled?: boolean;
  interactive?: boolean;
  openDelay?: number;
  closeDelay?: number;
  contentClassName?: string;
  referenceClassName?: string;
};

function isStructuredContent(content: ReactNode | TooltipStructuredContent): content is TooltipStructuredContent {
  return Boolean(
    content &&
      typeof content === "object" &&
      !Array.isArray(content) &&
      !isValidElement(content) &&
      ("title" in content || "eyebrow" in content || "description" in content || "rows" in content || "sections" in content),
  );
}

function toneClass(tone: TooltipTone | undefined): string {
  return tone && tone !== "default" ? `arc-tooltip-tone-${tone}` : "";
}

type TooltipPanelProps = HTMLAttributes<HTMLDivElement> & {
  variant?: "compact" | "rich";
  tone?: TooltipTone;
};

export const TooltipPanel = forwardRef<HTMLDivElement, TooltipPanelProps>(function TooltipPanel(
  { children, variant = "compact", tone = "default", className = "", style, ...props },
  ref,
) {
  return (
    <div ref={ref} className={`arc-tooltip arc-tooltip--${variant} ${toneClass(tone)} ${className}`.trim()} style={style} {...props}>
      {children}
    </div>
  );
});

export function TooltipContent({ content }: { content: ReactNode | TooltipStructuredContent }) {
  if (!isStructuredContent(content)) {
    return <div className="arc-tooltip-text">{content}</div>;
  }

  return (
    <>
      {(content.title || content.eyebrow || content.icon || content.shortcut) && (
        <div className="arc-tooltip-header">
          {content.icon ? <div className="arc-tooltip-icon">{content.icon}</div> : null}
          <div className="arc-tooltip-heading">
            {content.eyebrow ? <div className="arc-tooltip-eyebrow">{content.eyebrow}</div> : null}
            {content.title ? <div className="arc-tooltip-title">{content.title}</div> : null}
          </div>
          {content.shortcut ? <TooltipShortcut>{content.shortcut}</TooltipShortcut> : null}
        </div>
      )}
      {content.description ? <div className="arc-tooltip-description">{content.description}</div> : null}
      {content.rows?.length ? <TooltipSectionRows rows={content.rows} /> : null}
      {content.sections?.map((section, index) => (
        <TooltipSectionBlock key={section.id ?? index} section={section} />
      ))}
      {content.footer ? <div className="arc-tooltip-footer">{content.footer}</div> : null}
    </>
  );
}

export function TooltipSectionBlock({ section }: { section: TooltipSection }) {
  return (
    <div className="arc-tooltip-section">
      {section.title ? <div className="arc-tooltip-section-title">{section.title}</div> : null}
      {section.rows?.length ? <TooltipSectionRows rows={section.rows} /> : null}
      {section.content ? <div className="arc-tooltip-section-content">{section.content}</div> : null}
    </div>
  );
}

export function TooltipSectionRows({ rows }: { rows: TooltipRow[] }) {
  return (
    <div className="arc-tooltip-rows">
      {rows.map((row, index) => (
        <TooltipRowItem key={row.id ?? index} row={row} />
      ))}
    </div>
  );
}

export function TooltipRowItem({ row }: { row: TooltipRow }) {
  return (
    <div className="arc-tooltip-row">
      <span className="arc-tooltip-row-label">{row.label}</span>
      <span className={`arc-tooltip-row-value ${toneClass(row.tone)}`.trim()}>{row.value}</span>
      {row.detail ? <span className="arc-tooltip-row-detail">{row.detail}</span> : null}
    </div>
  );
}

export function TooltipShortcut({ children }: { children: ReactNode }) {
  return <span className="arc-tooltip-shortcut">{children}</span>;
}

export function Tooltip({
  content,
  children,
  placement = "right",
  variant,
  disabled = false,
  interactive = false,
  openDelay = 80,
  closeDelay = 60,
  contentClassName = "",
  referenceClassName = "inline-flex",
}: TooltipProps) {
  const [open, setOpen] = useState(false);
  const tooltipId = useId();
  const resolvedVariant = variant ?? (isStructuredContent(content) ? "rich" : "compact");
  const { refs, floatingStyles, context } = useFloating({
    open: disabled ? false : open,
    onOpenChange: (nextOpen) => setOpen(disabled ? false : nextOpen),
    strategy: "fixed",
    placement,
    whileElementsMounted: autoUpdate,
    middleware: [offset(10), flip(), shift({ padding: 8 })],
  });

  const hover = useHover(context, { enabled: !disabled, move: false, delay: { open: openDelay, close: closeDelay } });
  const focus = useFocus(context, { enabled: !disabled });
  const click = useClick(context, { enabled: !disabled, ignoreMouse: true });
  const dismiss = useDismiss(context, { enabled: !disabled, escapeKey: true, outsidePress: true });
  const role = useRole(context, { role: "tooltip" });
  const { getReferenceProps, getFloatingProps } = useInteractions([hover, focus, click, dismiss, role]);

  return (
    <>
      <span ref={refs.setReference} {...getReferenceProps({ "aria-describedby": open ? tooltipId : undefined })} className={referenceClassName}>
        {children}
      </span>
      <FloatingPortal>
        {!disabled && open && (
          <TooltipPanel
            ref={refs.setFloating}
            style={floatingStyles}
            variant={resolvedVariant}
            tone={isStructuredContent(content) ? content.tone : undefined}
            className={`${interactive ? "pointer-events-auto" : "pointer-events-none"} ${contentClassName}`.trim()}
            {...getFloatingProps({ id: tooltipId })}
          >
            <TooltipContent content={content} />
          </TooltipPanel>
        )}
      </FloatingPortal>
    </>
  );
}
