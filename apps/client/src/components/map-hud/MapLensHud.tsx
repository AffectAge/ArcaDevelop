import { AnimatePresence, motion } from "framer-motion";
import type { ReactNode } from "react";
import { Tooltip } from "../Tooltip";
import { Briefcase, type LucideIcon } from "lucide-react";

type MapLensOption<T extends string> = {
  id: T;
  label: string;
  tooltip?: string;
  icon?: LucideIcon;
};

type Props<TMode extends string, TLens extends string> = {
  modes: Array<MapLensOption<TMode>>;
  lenses: Array<MapLensOption<TLens>>;
  activeModeId: TMode;
  activeLensId: TLens;
  legend: ReactNode;
  onModeChange: (modeId: TMode) => void;
  onLensChange: (lensId: TLens) => void;
};

export function getLensIconButtonClass(active: boolean) {
  return `arc-map-lens-button ${active ? "arc-map-lens-button--active" : ""}`;
}

export function MapLensHud<TMode extends string, TLens extends string>({
  modes,
  lenses,
  activeModeId,
  activeLensId,
  legend,
  onModeChange,
  onLensChange,
}: Props<TMode, TLens>) {
  return (
    <div className="arc-map-lens-hud pointer-events-auto absolute bottom-0 left-1/2 z-[34] w-[min(92vw,860px)] -translate-x-1/2 text-[var(--arc-color-text-soft)]">
      <div className="relative mx-auto mb-3 w-[min(100%,820px)]">
        <div className="arc-hud-content">
          <AnimatePresence initial={false}>
            {legend ? (
              <motion.div
                key="lens-legend-row"
                initial={{ height: 0, opacity: 0, y: 4 }}
                animate={{ height: 42, opacity: 1, y: 0 }}
                exit={{ height: 0, opacity: 0, y: 4 }}
                transition={{ duration: 0.16, ease: "easeOut" }}
                className="relative z-20 flex items-center justify-center overflow-visible px-3 pt-2"
              >
                {legend}
              </motion.div>
            ) : null}
          </AnimatePresence>
          <motion.div
            layout
            transition={{ layout: { duration: 0.16, ease: "easeOut" } }}
            className="arc-scrollbar relative z-10 flex min-h-[58px] max-h-[66px] items-center justify-center gap-2 overflow-x-auto overflow-y-hidden px-3 py-2.5"
          >
            {lenses.map((lens) => {
              const active = activeLensId === lens.id;
              const Icon = lens.icon ?? Briefcase;
              return (
                <Tooltip key={lens.id} content={lens.tooltip ?? lens.label}>
                  <motion.button
                    type="button"
                    onClick={() => onLensChange(lens.id)}
                    className={getLensIconButtonClass(active)}
                    aria-label={lens.label}
                    aria-pressed={active}
                  >
                    <Icon size={20} />
                  </motion.button>
                </Tooltip>
              );
            })}
          </motion.div>
        </div>
      </div>

      <div className="arc-map-lens-mode-row relative z-10 flex justify-center gap-2 pb-2">
        {modes.map((mode) => {
          const active = activeModeId === mode.id;
          const Icon = mode.icon ?? Briefcase;
          return (
            <Tooltip key={mode.id} content={mode.tooltip ?? mode.label}>
              <motion.button
                type="button"
                onClick={() => onModeChange(mode.id)}
                className={getLensIconButtonClass(active)}
                aria-label={mode.label}
                aria-pressed={active}
              >
                <Icon size={20} />
              </motion.button>
            </Tooltip>
          );
        })}
      </div>
    </div>
  );
}
