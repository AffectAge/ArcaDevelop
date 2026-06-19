import { useMemo, useState } from "react";
import { ArrowRight, ChevronDown, Crosshair, Shield, Trash2, Users, X } from "lucide-react";
import type { Country, Division, DivisionTemplate } from "@arcanorum/shared";
import { AppButton } from "./ui/AppButton";
import { AppCard } from "./ui/AppSurface";
import { Tooltip } from "./Tooltip";
import { useUiText } from "../i18n/useUiText";

type Props = {
  division: Division;
  template: DivisionTemplate | null;
  country: Country | null;
  currentCountryId: string | null;
  currentProvinceName: string;
  targetProvinceName?: string | null;
  isMoving?: boolean;
  onClose: () => void;
  onMoveStart: () => void;
  onMoveCancel: () => void;
  onDelete?: () => void;
};

function formatNumber(value: number, locale: string, digits = 0) {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: digits }).format(value);
}

function moraleToneClass(value: number) {
  if (value > 80) return "text-[var(--arc-color-success-text)]";
  if (value > 50) return "text-[var(--arc-color-gold)]";
  return "text-[var(--arc-color-danger-text)]";
}

export function DivisionCard({
  division,
  template,
  country,
  currentCountryId,
  currentProvinceName,
  targetProvinceName,
  isMoving = false,
  onClose,
  onMoveStart,
  onMoveCancel,
  onDelete,
}: Props) {
  const [expandBattalions, setExpandBattalions] = useState(false);
  const { locale, t } = useUiText();

  const battalionStats = useMemo(() => {
    const battalionCount = (template?.battalions ?? []).reduce((sum, battalion) => sum + Math.max(0, Number(battalion.count) || 0), 0);
    const totalSoldiers = Math.round(Math.max(0, division.stats.manpower * division.strength));
    const averageMorale = division.stats.organization > 0 ? (division.organization / division.stats.organization) * 100 : 0;
    return {
      totalSoldiers,
      averageMorale,
      battalionCount,
      strength: division.strength * 100,
    };
  }, [division.organization, division.stats.manpower, division.stats.organization, division.strength, template?.battalions]);

  const isOwnDivision = country?.id === currentCountryId;
  const canMove = isOwnDivision && !isMoving;
  const averageMoraleLabel = `${formatNumber(battalionStats.averageMorale, locale, 1)}%`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--arc-modal-backdrop)] pointer-events-auto">
      <div className="w-full max-w-2xl mx-4 pointer-events-auto">
        <AppCard className="border-2 border-[var(--arc-color-primary-border)]">
          <div className="flex items-start justify-between mb-4 p-4 border-b border-[var(--arc-color-gold-soft)]">
            <div className="flex-1">
              <h2 className="text-xl font-bold text-[var(--arc-color-text)] mb-1">{division.name}</h2>
              <p className="arc-pop-muted mb-2 text-sm">
                <Shield className="inline w-4 h-4 mr-1" />
                {template?.name || t("army.unknownTemplate")}
              </p>
              {country && (
                <div className="flex items-center gap-2">
                  <div
                    className="w-4 h-4 rounded border border-[var(--arc-color-gold-soft)]"
                    style={{ backgroundColor: country.color }}
                  />
                  <p className="text-sm text-[var(--arc-color-text-muted)]">{country.name}</p>
                </div>
              )}
            </div>
            <button
              onClick={onClose}
              aria-label={t("common.close")}
              className="p-2 text-[var(--arc-color-text-muted)] hover:text-[var(--arc-color-text)] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4 p-4 border-b border-[var(--arc-color-gold-soft)]">
            <div className="arc-pop-panel p-3">
              <p className="arc-pop-label mb-1">{t("army.location")}</p>
              <p className="text-sm font-semibold text-[var(--arc-color-text)]">{currentProvinceName}</p>
            </div>
            <div className="arc-pop-panel p-3">
              <p className="arc-pop-label mb-1">{t("army.composition")}</p>
              <p className="text-sm font-semibold text-[var(--arc-color-text)]">{t("army.totalBattalions", { count: formatNumber(battalionStats.battalionCount, locale) })}</p>
            </div>
            <div className="arc-pop-panel p-3">
              <p className="arc-pop-label mb-1">{t("army.strengthShort")}</p>
              <p className="text-sm font-semibold text-[var(--arc-color-success-text)]">{t("army.totalSoldiers", { count: formatNumber(battalionStats.totalSoldiers, locale) })}</p>
            </div>
            <div className="arc-pop-panel p-3">
              <p className="arc-pop-label mb-1">{t("shell.preview.averageOrganization")}</p>
              <p className={`text-sm font-semibold ${moraleToneClass(battalionStats.averageMorale)}`}>{averageMoraleLabel}</p>
            </div>
          </div>

          <div className="p-4 border-b border-[var(--arc-color-gold-soft)]">
            <button
              onClick={() => setExpandBattalions(!expandBattalions)}
              className="flex items-center gap-2 w-full text-left text-sm font-semibold text-[var(--arc-color-text)] hover:text-[var(--arc-color-gold)] transition-colors"
            >
              <ChevronDown className={`w-4 h-4 transition-transform ${expandBattalions ? "rotate-180" : ""}`} />
              <Users className="w-4 h-4" />
              {t("army.totalBattalions", { count: formatNumber(battalionStats.battalionCount, locale) })}
            </button>

            {expandBattalions && (
              <div className="mt-3 space-y-2 max-h-48 overflow-y-auto">
                {(template?.battalions ?? []).map((battalion, idx) => (
                  <div key={idx} className="arc-pop-panel flex items-center justify-between p-2 text-xs">
                    <span className="text-[var(--arc-color-text-muted)]">{battalion.battalionTypeId || t("army.unknownBattalion", { number: idx + 1 })}</span>
                    <div className="flex gap-3 text-[var(--arc-color-text-muted)]">
                      <span>x{formatNumber(battalion.count, locale)}</span>
                      <Tooltip content={`${t("army.organizationShort")}: ${averageMoraleLabel}`}>
                        <span className={moraleToneClass(battalionStats.averageMorale)}>
                          {formatNumber(battalionStats.averageMorale, locale)}%
                        </span>
                      </Tooltip>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {isMoving && (
            <div className="p-4 bg-[var(--arc-overlay-35)] border-b border-[var(--arc-color-primary-border)]">
              <div className="flex items-center gap-2 text-[var(--arc-color-gold)] text-sm mb-2">
                <Crosshair className="w-4 h-4" />
                <span>{t("army.moveActive")}</span>
              </div>
              {targetProvinceName && (
                <div className="flex items-center gap-2 text-[var(--arc-color-text)] text-sm">
                  <span>{currentProvinceName}</span>
                  <ArrowRight className="w-4 h-4" />
                  <span className="font-semibold">{targetProvinceName}</span>
                </div>
              )}
              {!targetProvinceName && <p className="text-[var(--arc-color-text)] text-sm">{t("army.movePickDestination")}</p>}
            </div>
          )}

          <div className="flex gap-2 p-4">
            {isOwnDivision ? (
              <>
                <AppButton
                  variant="primary"
                  size="sm"
                  onClick={isMoving ? onMoveCancel : onMoveStart}
                  className="flex-1"
                >
                  {isMoving ? t("army.moveCancel") : t("army.march")}
                </AppButton>
                {onDelete && (
                  <AppButton
                    variant="danger"
                    size="sm"
                    onClick={onDelete}
                    title={t("army.disbandDivision")}
                  >
                    <Trash2 className="w-4 h-4" />
                  </AppButton>
                )}
              </>
            ) : (
              <AppButton variant="secondary" size="sm" onClick={onClose} className="flex-1">
                {t("common.close")}
              </AppButton>
            )}
          </div>
        </AppCard>
      </div>
    </div>
  );
}
