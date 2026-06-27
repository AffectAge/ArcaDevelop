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

type MapLayerOption<T extends string> = MapLensOption<T> & {
  active: boolean;
};

type Props<TLayer extends string, TLens extends string> = {
  layers: Array<MapLayerOption<TLayer>>;
  lenses: Array<MapLensOption<TLens>>;
  activeLensId: TLens;
  legend: ReactNode;
  onLayerToggle: (layerId: TLayer) => void;
  onLensChange: (lensId: TLens) => void;
};

export function getLensIconButtonClass(active: boolean) {
  return `arc-map-lens-button ${active ? "arc-map-lens-button--active" : ""}`;
}

export function MapLensHud<TLayer extends string, TLens extends string>({
  layers,
  lenses,
  activeLensId,
  legend,
  onLayerToggle,
  onLensChange,
}: Props<TLayer, TLens>) {
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
            {layers.map((layer) => {
              const Icon = layer.icon ?? Briefcase;
              return (
                <Tooltip key={layer.id} content={layer.tooltip ?? layer.label}>
                  <motion.button
                    type="button"
                    onClick={() => onLayerToggle(layer.id)}
                    className={getLensIconButtonClass(layer.active)}
                    aria-label={layer.label}
                    aria-pressed={layer.active}
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
      </div>
    </div>
  );
}
