import {
  LocateFixed,
  Lock,
  LockOpen,
  Minus,
  MousePointer2,
  Move,
  Plus,
} from "lucide-react";
import type { Ref } from "react";
import { Tooltip } from "../Tooltip";
import { useUiText } from "../../i18n/useUiText";

type Props = {
  view: {
    lng: number;
    lat: number;
  };
  coordinateTextRef?: Ref<HTMLSpanElement>;
  interactionLocked: boolean;
  edgeScrollEnabled: boolean;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetView: () => void;
  onToggleInteraction: () => void;
  onToggleEdgeScroll: () => void;
};

export function MapControlsHud({
  view,
  coordinateTextRef,
  interactionLocked,
  edgeScrollEnabled,
  onZoomIn,
  onZoomOut,
  onResetView,
  onToggleInteraction,
  onToggleEdgeScroll,
}: Props) {
  const { t } = useUiText();

  return (
    <div className="arc-hud-panel pointer-events-auto absolute bottom-4 left-4 z-30 flex flex-col gap-1 rounded-xl p-1.5">
      <div className="arc-hud-content flex items-center justify-center gap-1">
        <Tooltip content={t("map.controls.zoomIn")}>
          <button
            onClick={onZoomIn}
            className="map-btn"
            aria-label={t("map.controls.zoomIn")}
          >
            <Plus size={16} />
          </button>
        </Tooltip>
        <Tooltip content={t("map.controls.zoomOut")}>
          <button
            onClick={onZoomOut}
            className="map-btn"
            aria-label={t("map.controls.zoomOut")}
          >
            <Minus size={16} />
          </button>
        </Tooltip>
        <Tooltip content={t("map.controls.resetView")}>
          <button
            onClick={onResetView}
            className="map-btn"
            aria-label={t("map.controls.resetView")}
          >
            <LocateFixed size={16} />
          </button>
        </Tooltip>
        <Tooltip
          content={
            interactionLocked
              ? t("map.controls.unlockInteraction")
              : t("map.controls.lockInteraction")
          }
        >
          <button
            onClick={onToggleInteraction}
            className="map-btn"
            aria-label={
              interactionLocked
                ? t("map.controls.unlockInteraction")
                : t("map.controls.lockInteraction")
            }
          >
            {interactionLocked ? <Lock size={16} /> : <LockOpen size={16} />}
          </button>
        </Tooltip>
        <Tooltip
          content={
            edgeScrollEnabled
              ? t("map.controls.disableEdgeScroll")
              : t("map.controls.enableEdgeScroll")
          }
        >
          <button
            onClick={onToggleEdgeScroll}
            className="map-btn"
            aria-pressed={edgeScrollEnabled}
            aria-label={
              edgeScrollEnabled
                ? t("map.controls.disableEdgeScroll")
                : t("map.controls.enableEdgeScroll")
            }
          >
            <MousePointer2 size={16} />
          </button>
        </Tooltip>
      </div>
      <div className="arc-hud-chip pointer-events-none relative z-10 flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs">
        <Move size={14} className="text-[var(--arc-color-gold)]" />
        <span ref={coordinateTextRef}>
          {view.lng.toFixed(2)}, {view.lat.toFixed(2)}
        </span>
      </div>
    </div>
  );
}
