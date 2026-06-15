import { AnimatePresence, motion } from "framer-motion";
import type { ReactNode } from "react";
import { Tooltip } from "../Tooltip";
import { Briefcase, Crosshair, Flag, Gauge, Globe2, Landmark, Pickaxe, Scale, Users, type LucideIcon } from "lucide-react";

type MapLensModeOption<T extends string> = {
  id: T;
  label: string;
};

type Props<T extends string> = {
  modes: Array<MapLensModeOption<T>>;
  activeModeId: T;
  activeLensControl: ReactNode;
  activeLensFilterControl: ReactNode;
  onModeChange: (modeId: T) => void;
};

const lensIconButtonClass =
  "arc-hud-button-solid relative inline-flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl transition hover:scale-105";

const activeLensIconButtonClass =
  "relative inline-flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[var(--arc-color-primary-border)] bg-gradient-to-b from-[var(--arc-color-primary-top)] to-[var(--arc-color-primary-bottom)] text-[var(--arc-color-text)] shadow-[var(--arc-shadow-inset-button)] transition hover:scale-105 hover:brightness-110";

export function getLensIconButtonClass(active: boolean) {
  return active ? activeLensIconButtonClass : lensIconButtonClass;
}

const modeIcons: Partial<Record<string, LucideIcon>> = {
  political: Landmark,
  diplomacy: Scale,
  markets: Globe2,
  population: Users,
  resources: Pickaxe,
  infrastructure: Gauge,
  colonization: Flag,
  military: Crosshair,
};

export function MapLensHud<T extends string>({ modes, activeModeId, activeLensControl, activeLensFilterControl, onModeChange }: Props<T>) {
  return (
    <div className="pointer-events-auto absolute bottom-0 left-1/2 z-[34] w-[min(92vw,860px)] -translate-x-1/2 text-[var(--arc-color-text-soft)] drop-shadow-[0_18px_28px_rgba(0,0,0,0.42)]">
      <div className="relative mx-auto mb-3 w-[min(100%,820px)] rounded-xl">
        <div className="arc-hud-content">
          <AnimatePresence initial={false}>
            {activeLensFilterControl ? (
              <motion.div
                key="lens-filter-row"
                initial={{ height: 0, opacity: 0, y: 4 }}
                animate={{ height: 42, opacity: 1, y: 0 }}
                exit={{ height: 0, opacity: 0, y: 4 }}
                transition={{ duration: 0.16, ease: "easeOut" }}
                className="relative z-20 flex items-center justify-center overflow-visible px-3 pt-2"
              >
                {activeLensFilterControl}
              </motion.div>
            ) : null}
          </AnimatePresence>
          <motion.div
            layout
            transition={{ layout: { duration: 0.16, ease: "easeOut" } }}
            className="arc-scrollbar relative z-10 flex min-h-[58px] max-h-[66px] items-center justify-center gap-2 overflow-x-auto overflow-y-hidden px-3 py-2.5"
          >
            {activeLensControl}
          </motion.div>
        </div>
      </div>

      <div className="relative z-10 flex justify-center gap-2 pb-2">
        {modes.map((mode) => {
          const active = activeModeId === mode.id;
          return (
            <Tooltip key={mode.id} content={mode.label}>
              <motion.button
                type="button"
                onClick={() => onModeChange(mode.id)}
                className={getLensIconButtonClass(active)}
                aria-label={mode.label}
                aria-pressed={active}
              >
                {(() => {
                  const Icon = modeIcons[mode.id] ?? Briefcase;
                  return <Icon size={20} />;
                })()}
              </motion.button>
            </Tooltip>
          );
        })}
      </div>
    </div>
  );
}
