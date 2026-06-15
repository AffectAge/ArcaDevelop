import { AppButton } from "../ui/AppButton";
import { useUiText } from "../../i18n/useUiText";

type Props = {
  x: number;
  y: number;
  provinceName: string;
  canOpenProvinceKnowledge: boolean;
  canCreateProvinceKnowledge: boolean;
  canOpenAdminProvinceEditor: boolean;
  onOpenColonization: () => void;
  onOpenProvinceKnowledge: () => void;
  onCreateProvinceKnowledge: () => void;
  onOpenAdminProvinceEditor: () => void;
  onClose: () => void;
};

export function ProvinceContextMenuHud({
  x,
  y,
  provinceName,
  canOpenProvinceKnowledge,
  canCreateProvinceKnowledge,
  canOpenAdminProvinceEditor,
  onOpenColonization,
  onOpenProvinceKnowledge,
  onCreateProvinceKnowledge,
  onOpenAdminProvinceEditor,
  onClose,
}: Props) {
  const { t } = useUiText();

  return (
    <div
      className="arc-hud-panel pointer-events-auto absolute z-40 min-w-[220px] rounded-lg p-2"
      style={{ left: x, top: y }}
      onMouseLeave={onClose}
    >
      <div className="arc-hud-content px-2 pb-2 text-xs font-semibold text-[var(--arc-color-text)]">{provinceName}</div>

      <div className="arc-hud-content space-y-2">
        <AppButton type="button" variant="primary" size="sm" className="w-full justify-center" onClick={onOpenColonization}>
          {t("provinceContext.openColonization")}
        </AppButton>

        {canOpenProvinceKnowledge && (
          <AppButton type="button" variant="secondary" size="sm" className="w-full justify-center" onClick={onOpenProvinceKnowledge}>
            {t("provinceContext.openProvinceKnowledge")}
          </AppButton>
        )}

        {canCreateProvinceKnowledge && (
          <AppButton type="button" variant="danger" size="sm" className="w-full justify-center" onClick={onCreateProvinceKnowledge}>
            {t("provinceContext.createProvinceKnowledge")}
          </AppButton>
        )}

        {canOpenAdminProvinceEditor && (
          <AppButton type="button" variant="danger" size="sm" className="w-full justify-center" onClick={onOpenAdminProvinceEditor}>
            {t("provinceContext.openAdminEditor")}
          </AppButton>
        )}
      </div>
    </div>
  );
}
