import { useMemo, useState, type MouseEvent, type ReactNode } from "react";
import { AlertTriangle, Bed, Crosshair, FastForward, Flag, Footprints, Moon, Shield, SkipForward, Sun, Swords } from "lucide-react";
import type { MapUnit, TurnActionItem, UnitTypeDefinition } from "@arcanorum/shared";
import { getUnitAtlasFrameIndex, getUnitAtlasUrl } from "../assets/unitAtlas";
import type { UiTextKey } from "../i18n/uiText";
import { useUiText } from "../i18n/useUiText";
import { Tooltip } from "./Tooltip";

type Props = {
  scenarioId?: string | null;
  turnId: number;
  turnActions: TurnActionItem[];
  unitsById: Record<string, MapUnit>;
  unitTypes: UnitTypeDefinition[];
  onNextTurn: () => void;
  onForceNextTurn: () => void;
  onFocusAction: (item: TurnActionItem) => void;
  onSkipUnit: (item: TurnActionItem) => void;
  onSleepUnit: (item: TurnActionItem) => void;
  onWakeUnit: (unit: MapUnit) => void;
};

export function TurnAdvancerHub(props: Props) {
  const { t } = useUiText();
  const blockingActions = useMemo(() => props.turnActions.filter((item) => item.severity === "blocking"), [props.turnActions]);
  const [activeIndex, setActiveIndex] = useState(0);
  const activeAction = blockingActions.length > 0 ? blockingActions[Math.min(activeIndex, blockingActions.length - 1)] : null;
  const activeUnit = activeAction?.target.type === "unit" ? props.unitsById[activeAction.target.unitId] ?? null : null;
  const sleepingUnit = Object.values(props.unitsById).find((unit) => unit.status === "sleeping") ?? null;
  const activeUnitType = activeUnit ? props.unitTypes.find((unitType) => unitType.id === activeUnit.unitTypeId) ?? null : null;
  const wakeUnit = activeUnit?.status === "sleeping" ? activeUnit : sleepingUnit;
  const hasBlockingActions = blockingActions.length > 0;
  const orbLabel = hasBlockingActions ? t("turnActions.needsOrders", { count: blockingActions.length }) : t("topBar.nextTurn", { turn: props.turnId });
  const unitName = activeUnitType ? t(activeUnitType.nameKey as UiTextKey) : activeAction ? t(activeAction.labelKey as UiTextKey) : t("turnActions.readyDescription");
  const hpPct = activeUnit && activeUnitType ? Math.max(0, Math.min(100, (activeUnit.hp / Math.max(1, activeUnitType.stats.maxHp)) * 100)) : 0;

  const focusAction = (item: TurnActionItem) => {
    const index = blockingActions.findIndex((candidate) => candidate.id === item.id);
    if (index >= 0) setActiveIndex(index);
    props.onFocusAction(item);
  };

  const handleOrbClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (hasBlockingActions && event.shiftKey) {
      props.onForceNextTurn();
      return;
    }
    if (!hasBlockingActions) {
      props.onNextTurn();
      return;
    }
    const nextIndex = blockingActions.length <= 1 ? 0 : (activeIndex + 1) % blockingActions.length;
    setActiveIndex(nextIndex);
    props.onFocusAction(blockingActions[nextIndex]!);
  };

  return (
    <aside className="arc-turn-advancer-hub pointer-events-auto" aria-label={t("turnActions.commandHubAria")}>
      <div className={`arc-turn-advancer-card ${hasBlockingActions ? "arc-turn-advancer-card--blocked" : "arc-turn-advancer-card--ready"}`}>
        <div className="arc-turn-advancer-layout">
          <div className="arc-turn-advancer-action-bank" aria-label={t("turnActions.actionTrayAria")}>
            {activeAction ? (
              <HubIconButton label={t("turnActions.focusUnit")} tooltip={t("turnActions.focusUnitTooltip")} onClick={() => focusAction(activeAction)} icon={<Crosshair size={15} />} />
            ) : (
              <HubIconButton label={t("turnActions.readyTitle")} tooltip={t("turnActions.readyTooltip")} onClick={props.onNextTurn} icon={<FastForward size={15} />} />
            )}
            {activeAction && activeAction.target.type === "unit" ? (
              <>
                <HubIconButton label={t("turnActions.skipUnit")} tooltip={t("turnActions.skipUnitTooltip")} onClick={() => props.onSkipUnit(activeAction)} icon={<SkipForward size={15} />} />
                <HubIconButton label={t("turnActions.sleepUnit")} tooltip={t("turnActions.sleepUnitTooltip")} onClick={() => props.onSleepUnit(activeAction)} icon={<Moon size={15} />} />
              </>
            ) : null}
            {activeUnitType?.canFoundCity && activeAction ? (
              <HubIconButton label={t("turnActions.foundCity")} tooltip={t("turnActions.foundCityTooltip")} onClick={() => focusAction(activeAction)} icon={<Flag size={15} />} />
            ) : null}
            {wakeUnit ? (
              <HubIconButton label={t("turnActions.wakeUnit")} tooltip={t("turnActions.wakeUnitTooltip")} onClick={() => props.onWakeUnit(wakeUnit)} icon={<Sun size={15} />} />
            ) : null}
            <HubIconButton label={t("turnActions.forceEndTurn")} tooltip={t("turnActions.forceEndTurnTooltip")} onClick={props.onForceNextTurn} icon={<FastForward size={15} />} tone="danger" />
          </div>

          <div className="arc-turn-advancer-unit-panel">
            <div className="arc-turn-advancer-card__main">
              <UnitPortrait scenarioId={props.scenarioId} unit={activeUnit} unitType={activeUnitType} />
              <div className="arc-turn-advancer-card__body">
                <div className="arc-turn-advancer-card__eyebrow">{hasBlockingActions ? t("turnActions.title") : t("turnActions.readyTitle")}</div>
                <div className="arc-turn-advancer-card__title">{unitName}</div>
                {activeUnit && activeUnitType ? (
                  <div className="arc-turn-advancer-health" aria-label={`${t("turnActions.stat.hp")}: ${Math.max(0, Math.round(activeUnit.hp))}/${activeUnitType.stats.maxHp}`}>
                    <span className="arc-turn-advancer-health__text">
                      {Math.max(0, Math.round(activeUnit.hp))}/{activeUnitType.stats.maxHp}
                    </span>
                    <span className="arc-turn-advancer-health__track">
                      <span style={{ width: `${hpPct}%` }} />
                    </span>
                  </div>
                ) : (
                  <div className="arc-turn-advancer-card__description">{t("turnActions.readyTooltip")}</div>
                )}
              </div>
            </div>

            {activeUnit && activeUnitType ? (
              <div className="arc-turn-advancer-stats" aria-label={t("turnActions.unitStatsAria")}>
                <StatChip icon={<Footprints size={13} />} label={t("turnActions.stat.movement")} value={Math.max(0, Math.floor(activeUnit.movementPoints)).toString()} />
                <StatChip icon={<Swords size={13} />} label={t("turnActions.stat.attack")} value={activeUnitType.stats.attack.toString()} />
                <StatChip icon={<Shield size={13} />} label={t("turnActions.stat.defense")} value={activeUnitType.stats.defense.toString()} />
                <StatChip icon={<Crosshair size={13} />} label={t("turnActions.focusUnit")} value={activeUnit.hexId.replace("hex:", "")} />
              </div>
            ) : null}

            <div className="arc-turn-advancer-command-strip">
              <span className="arc-turn-advancer-command-strip__lead" aria-hidden="true">
                <SkipForward size={15} />
              </span>
              <span className="arc-turn-advancer-command-strip__text">
                {activeAction ? t(activeAction.descriptionKey as UiTextKey) : t("turnActions.readyTooltip")}
              </span>
            </div>
          </div>
        </div>

        {blockingActions.length > 1 ? (
          <div className="arc-turn-advancer-queue" aria-label={t("turnActions.queueAria")}>
            {blockingActions.slice(0, 6).map((item, index) => (
              <Tooltip key={item.id} content={t(item.descriptionKey as UiTextKey)} placement="top">
                <button
                  type="button"
                  className={`arc-turn-advancer-queue__dot ${index === Math.min(activeIndex, blockingActions.length - 1) ? "arc-turn-advancer-queue__dot--active" : ""}`}
                  onClick={() => focusAction(item)}
                  aria-label={t(item.labelKey as UiTextKey)}
                />
              </Tooltip>
            ))}
            {blockingActions.length > 6 ? <span className="arc-turn-advancer-queue__more">+{blockingActions.length - 6}</span> : null}
          </div>
        ) : null}
      </div>

      <Tooltip content={hasBlockingActions ? t("turnActions.nextTurnBlockedTooltip") : t("turnActions.readyTooltip")} placement="left">
        <button
          type="button"
          className={`arc-turn-advancer-orb ${hasBlockingActions ? "arc-turn-advancer-orb--blocked" : "arc-turn-advancer-orb--ready"}`}
          onClick={handleOrbClick}
          aria-label={orbLabel}
        >
          <span className="arc-turn-advancer-orb__content">
            {hasBlockingActions ? <AlertTriangle size={24} /> : <FastForward size={25} />}
            <span className="arc-turn-advancer-orb__label">{hasBlockingActions ? blockingActions.length : props.turnId}</span>
          </span>
        </button>
      </Tooltip>
    </aside>
  );
}

function UnitPortrait(props: { scenarioId?: string | null; unit: MapUnit | null; unitType: UnitTypeDefinition | null }) {
  const { t } = useUiText();
  if (!props.unit || !props.unitType) {
    return (
      <div className="arc-turn-advancer-portrait" aria-hidden="true">
        <Bed size={24} />
      </div>
    );
  }
  const frame = props.unit.hp < props.unitType.stats.maxHp * 0.35 ? getUnitAtlasFrameIndex("damaged") : getUnitAtlasFrameIndex("idle");
  return (
    <div
      className="arc-turn-advancer-portrait arc-turn-advancer-portrait--texture"
      role="img"
      aria-label={t("turnActions.unitPortraitAria")}
      style={{
        backgroundImage: `url("${getUnitAtlasUrl(props.scenarioId, props.unitType.id)}")`,
        backgroundPosition: `-${frame * 64}px 0`,
      }}
    />
  );
}

function StatChip(props: { icon: ReactNode; label: string; value: string }) {
  return (
    <Tooltip content={props.label} placement="top">
      <span className="arc-turn-advancer-stat" aria-label={`${props.label}: ${props.value}`}>
        {props.icon}
        <span>{props.value}</span>
      </span>
    </Tooltip>
  );
}

function HubIconButton(props: { label: string; tooltip: string; icon: ReactNode; onClick: () => void; tone?: "default" | "danger" }) {
  return (
    <Tooltip content={props.tooltip} placement="top">
      <button
        type="button"
        className={`arc-turn-advancer-action ${props.tone === "danger" ? "arc-turn-advancer-action--danger" : ""}`}
        onClick={props.onClick}
        aria-label={props.label}
      >
        {props.icon}
      </button>
    </Tooltip>
  );
}
