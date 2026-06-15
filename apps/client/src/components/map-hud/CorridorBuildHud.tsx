import { AppButton } from "../ui/AppButton";
import { useUiText } from "../../i18n/useUiText";

type CorridorBuildPoint = {
  provinceId: string;
  lng: number;
  lat: number;
};

type Props = {
  points: CorridorBuildPoint[];
  provinceIds: string[];
  pending: boolean;
  getProvinceDisplayName: (provinceId: string) => string;
  onUndoPoint: () => void;
  onCancel: () => void;
  onConfirm: () => void;
};

export function CorridorBuildHud({ points, provinceIds, pending, getProvinceDisplayName, onUndoPoint, onCancel, onConfirm }: Props) {
  const { t } = useUiText();

  return (
    <div className="arc-hud-panel fixed bottom-24 left-1/2 z-[170] max-h-[34vh] w-[min(92vw,680px)] -translate-x-1/2 overflow-auto rounded-xl p-3 text-sm">
      <div className="arc-hud-content">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="font-semibold text-[var(--arc-color-text)]">{t("corridorBuild.title")}</div>
            <div className="text-xs text-[var(--arc-color-text-soft)]">
              {t("corridorBuild.summary", { points: points.length, provinces: provinceIds.length })}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <AppButton type="button" variant="secondary" size="sm" disabled={points.length === 0} onClick={onUndoPoint}>
              {t("corridorBuild.undoPoint")}
            </AppButton>
            <AppButton type="button" variant="ghost" size="sm" onClick={onCancel}>
              {t("common.cancel")}
            </AppButton>
            <AppButton type="button" variant="primary" size="sm" disabled={pending || provinceIds.length < 2 || points.length < 2} onClick={onConfirm}>
              {t("common.confirm")}
            </AppButton>
          </div>
        </div>
        <div className="mt-2 flex flex-wrap gap-1 text-[11px] text-[var(--arc-color-text-soft)]">
          {points.map((point, index) => (
            <span key={`${point.provinceId}-${index}`} className="arc-hud-chip rounded-md px-1.5 py-0.5">
              {index + 1}. {getProvinceDisplayName(point.provinceId)}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
