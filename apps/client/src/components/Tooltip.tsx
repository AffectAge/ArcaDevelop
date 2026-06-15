import { useState } from "react";
import { useFloating, offset, shift, flip, useHover, useInteractions, useRole, FloatingPortal, type Placement } from "@floating-ui/react";
import type { ReactNode } from "react";

type TooltipProps = {
  content: ReactNode;
  children: ReactNode;
  placement?: Placement;
  contentClassName?: string;
  referenceClassName?: string;
};

export function Tooltip({ content, children, placement = "right", contentClassName = "", referenceClassName = "inline-flex" }: TooltipProps) {
  const [open, setOpen] = useState(false);
  const { refs, floatingStyles, context } = useFloating({
    open,
    onOpenChange: setOpen,
    strategy: "fixed",
    placement,
    middleware: [offset(10), flip(), shift({ padding: 8 })],
  });

  const hover = useHover(context, { move: false, delay: { open: 80, close: 40 } });
  const role = useRole(context, { role: "tooltip" });
  const { getReferenceProps, getFloatingProps } = useInteractions([hover, role]);

  return (
    <>
      <span ref={refs.setReference} {...getReferenceProps()} className={referenceClassName}>
        {children}
      </span>
      <FloatingPortal>
        {open && (
          <div
            ref={refs.setFloating}
            style={floatingStyles}
            className={`panel-border z-[320] max-w-56 rounded-md bg-[var(--arc-color-panel)] px-3 py-1 text-xs text-[var(--arc-color-gold)] ${contentClassName}`}
            {...getFloatingProps()}
          >
            {content}
          </div>
        )}
      </FloatingPortal>
    </>
  );
}
