import { AppButton } from "../ui/AppButton";
import { useUiText } from "../../i18n/useUiText";

type CorridorBuildPoint = {
  hexId: string;
  lng: number;
  lat: number;
};

type Props = {
  points: CorridorBuildPoint[];
  hexIds: string[];
  pending: boolean;
  getHexDisplayName: (hexId: string) => string;
  onUndoPoint: () => void;
  onCancel: () => void;
  onConfirm: () => void;
};

export function CorridorBuildHud({ points, hexIds, pending, getHexDisplayName, onUndoPoint, onCancel, onConfirm }: Props) {
  const { t } = useUiText();

  return (
    <div className="arc-hud-panel fixed bottom-24 left-1/2 z-[170] max-h-[34vh] w-[min(92vw,680px)] -translate-x-1/2 overflow-auto rounded-xl p-3 text-sm">
      <div className="arc-hud-content">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="font-semibold text-[var(--arc-color-text)]">{t("corridorBuild.title")}</div>
            <div className="text-xs text-[var(--arc-color-text-soft)]">
              {t("corridorBuild.summary", { points: points.length, hexes: hexIds.length })}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <AppButton type="button" variant="secondary" size="sm" disabled={points.length === 0} onClick={onUndoPoint}>
              {t("corridorBuild.undoPoint")}
            </AppButton>
            <AppButton type="button" variant="ghost" size="sm" onClick={onCancel}>
              {t("common.cancel")}
            </AppButton>
            <AppButton type="button" variant="primary" size="sm" disabled={pending || hexIds.length < 2 || points.length < 2} onClick={onConfirm}>
              {t("common.confirm")}
            </AppButton>
          </div>
        </div>
        <div className="mt-2 flex flex-wrap gap-1 text-[11px] text-[var(--arc-color-text-soft)]">
          {points.map((point, index) => (
            <span key={`${point.hexId}-${index}`} className="arc-hud-chip rounded-md px-1.5 py-0.5">
              {index + 1}. {getHexDisplayName(point.hexId)}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
