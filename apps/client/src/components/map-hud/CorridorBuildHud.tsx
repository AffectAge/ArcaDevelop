import { useUiText } from "../../i18n/useUiText";

type CorridorBuildPoint = {
  hexId: string;
  lng: number;
  lat: number;
};

type Props = {
  points: CorridorBuildPoint[];
  hexIds: string[];
  transportMode?: string;
  costConstruction?: number | null;
  connectedRegionIds?: string[];
  blockingReason?: string | null;
  pending: boolean;
  getHexDisplayName: (hexId: string) => string;
  onUndoPoint: () => void;
  onCancel: () => void;
  onConfirm: () => void;
};

export function CorridorBuildHud({
  points,
  hexIds,
  transportMode,
  costConstruction,
  connectedRegionIds,
  blockingReason,
  pending,
  getHexDisplayName,
  onUndoPoint,
  onCancel,
  onConfirm,
}: Props) {
  const { t } = useUiText();
  const hasBlockingReason = Boolean(blockingReason);

  return (
    <div className="arc-corridor-build-panel pointer-events-auto text-sm" role="status">
      <div className="arc-corridor-build-panel__header">
        <div className="min-w-0">
          <div className="arc-corridor-build-panel__title">{t("corridorBuild.title")}</div>
          <div className="arc-corridor-build-panel__summary">
            {t("corridorBuild.summary", { points: points.length, hexes: hexIds.length })}
          </div>
        </div>
        <div className="arc-corridor-build-panel__actions">
          <button type="button" className="arc-strategy-workspace-action" disabled={points.length === 0} onClick={onUndoPoint}>
            <span>{t("corridorBuild.undoPoint")}</span>
          </button>
          <button type="button" className="arc-strategy-workspace-action" onClick={onCancel}>
            <span>{t("common.cancel")}</span>
          </button>
          <button
            type="button"
            className="arc-strategy-workspace-action arc-strategy-workspace-action--primary"
            disabled={pending || hasBlockingReason || hexIds.length < 2 || points.length < 2}
            onClick={onConfirm}
          >
            <span>{t("common.confirm")}</span>
          </button>
        </div>
      </div>
      <div className="arc-corridor-build-panel__metrics">
        <div className="arc-corridor-build-panel__metric">
          <span>{t("corridorBuild.transportMode")}</span>
          <strong>{transportMode ?? t("map.common.none")}</strong>
        </div>
        <div className="arc-corridor-build-panel__metric">
          <span>{t("corridorBuild.cost")}</span>
          <strong>{typeof costConstruction === "number" ? Math.round(costConstruction) : t("common.pending")}</strong>
        </div>
        <div className="arc-corridor-build-panel__metric">
          <span>{t("corridorBuild.connectedRegions")}</span>
          <strong>{connectedRegionIds?.length ?? 0}</strong>
        </div>
      </div>
      {hasBlockingReason ? (
        <div className="arc-corridor-build-panel__warning">
          {blockingReason}
        </div>
      ) : null}
      <div className="arc-corridor-build-panel__points">
        {points.map((point, index) => (
          <span key={`${point.hexId}-${index}`} className="arc-corridor-build-panel__point">
            {index + 1}. {getHexDisplayName(point.hexId)}
          </span>
        ))}
      </div>
    </div>
  );
}
