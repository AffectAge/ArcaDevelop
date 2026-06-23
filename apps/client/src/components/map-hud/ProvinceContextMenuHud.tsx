import { AppButton } from "../ui/AppButton";
import { useUiText } from "../../i18n/useUiText";

type Props = {
  x: number;
  y: number;
  hexName: string;
  canOpenHexKnowledge: boolean;
  canCreateHexKnowledge: boolean;
  canOpenAdminHexEditor: boolean;
  onOpenColonization: () => void;
  onOpenHexKnowledge: () => void;
  onCreateHexKnowledge: () => void;
  onOpenAdminHexEditor: () => void;
  onClose: () => void;
};

export function HexContextMenuHud({
  x,
  y,
  hexName,
  canOpenHexKnowledge,
  canCreateHexKnowledge,
  canOpenAdminHexEditor,
  onOpenColonization,
  onOpenHexKnowledge,
  onCreateHexKnowledge,
  onOpenAdminHexEditor,
  onClose,
}: Props) {
  const { t } = useUiText();

  return (
    <div
      className="arc-hud-panel pointer-events-auto absolute z-40 min-w-[220px] rounded-lg p-2"
      style={{ left: x, top: y }}
      onMouseLeave={onClose}
    >
      <div className="arc-hud-content px-2 pb-2 text-xs font-semibold text-[var(--arc-color-text)]">{hexName}</div>

      <div className="arc-hud-content space-y-2">
        <AppButton type="button" variant="primary" size="sm" className="w-full justify-center" onClick={onOpenColonization}>
          {t("provinceContext.openColonization")}
        </AppButton>

        {canOpenHexKnowledge && (
          <AppButton type="button" variant="secondary" size="sm" className="w-full justify-center" onClick={onOpenHexKnowledge}>
            {t("provinceContext.openHexKnowledge")}
          </AppButton>
        )}

        {canCreateHexKnowledge && (
          <AppButton type="button" variant="danger" size="sm" className="w-full justify-center" onClick={onCreateHexKnowledge}>
            {t("provinceContext.createHexKnowledge")}
          </AppButton>
        )}

        {canOpenAdminHexEditor && (
          <AppButton type="button" variant="danger" size="sm" className="w-full justify-center" onClick={onOpenAdminHexEditor}>
            {t("provinceContext.openAdminEditor")}
          </AppButton>
        )}
      </div>
    </div>
  );
}
