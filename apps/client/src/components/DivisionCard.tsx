import { useMemo, useState } from "react";
import { ArrowRight, ChevronDown, Crosshair, Shield, Trash2, Users, X } from "lucide-react";
import type { Country, Division, DivisionTemplate } from "@arcanorum/shared";
import { AppButton } from "./ui/AppButton";
import { AppCard, AppSection, AppSectionHeader } from "./ui/AppSurface";
import { Tooltip } from "./Tooltip";

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

function formatNumber(value: number, digits = 0) {
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: digits }).format(value);
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

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50 pointer-events-auto">
      <div className="w-full max-w-2xl mx-4 pointer-events-auto">
        <AppCard className="border-2 border-blue-500">
          <div className="flex items-start justify-between mb-4 p-4 border-b border-slate-700">
            <div className="flex-1">
              <h2 className="text-xl font-bold text-white mb-1">{division.name}</h2>
              <p className="text-sm text-slate-400 mb-2">
                <Shield className="inline w-4 h-4 mr-1" />
                {template?.name || "Неизвестный шаблон"}
              </p>
              {country && (
                <div className="flex items-center gap-2">
                  <div
                    className="w-4 h-4 rounded border border-slate-400"
                    style={{ backgroundColor: country.color }}
                  />
                  <p className="text-sm text-slate-300">{country.name}</p>
                </div>
              )}
            </div>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4 p-4 border-b border-slate-700">
            <div className="bg-slate-800/50 p-3 rounded">
              <p className="text-xs text-slate-400 mb-1">Местоположение</p>
              <p className="text-sm font-semibold text-white">{currentProvinceName}</p>
            </div>
            <div className="bg-slate-800/50 p-3 rounded">
              <p className="text-xs text-slate-400 mb-1">Боевой состав</p>
              <p className="text-sm font-semibold text-white">{battalionStats.battalionCount} батальонов</p>
            </div>
            <div className="bg-slate-800/50 p-3 rounded">
              <p className="text-xs text-slate-400 mb-1">Боевая сила</p>
              <p className="text-sm font-semibold text-green-400">{formatNumber(battalionStats.totalSoldiers)} солдат</p>
            </div>
            <div className="bg-slate-800/50 p-3 rounded">
              <p className="text-xs text-slate-400 mb-1">Средний боевой дух</p>
              <p className="text-sm font-semibold text-yellow-400">{battalionStats.averageMorale.toFixed(1)}%</p>
            </div>
          </div>

          {/* Батальоны */}
          <div className="p-4 border-b border-slate-700">
            <button
              onClick={() => setExpandBattalions(!expandBattalions)}
              className="flex items-center gap-2 w-full text-left text-sm font-semibold text-white hover:text-blue-400 transition-colors"
            >
              <ChevronDown className={`w-4 h-4 transition-transform ${expandBattalions ? "rotate-180" : ""}`} />
              <Users className="w-4 h-4" />
              Батальоны ({battalionStats.battalionCount})
            </button>

            {expandBattalions && (
              <div className="mt-3 space-y-2 max-h-48 overflow-y-auto">
                {(template?.battalions ?? []).map((battalion, idx) => (
                  <div key={idx} className="flex items-center justify-between bg-slate-800/50 p-2 rounded text-xs">
                    <span className="text-slate-300">{battalion.battalionTypeId || `Батальон ${idx + 1}`}</span>
                    <div className="flex gap-3 text-slate-400">
                      <span>x{formatNumber(battalion.count)}</span>
                      <Tooltip content={`Организация дивизии: ${battalionStats.averageMorale.toFixed(1)}%`}>
                        <span className={battalionStats.averageMorale > 80 ? "text-green-400" : battalionStats.averageMorale > 50 ? "text-yellow-400" : "text-red-400"}>
                          {battalionStats.averageMorale.toFixed(0)}%
                        </span>
                      </Tooltip>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Движение */}
          {isMoving && (
            <div className="p-4 bg-blue-900/20 border-b border-blue-700">
              <div className="flex items-center gap-2 text-blue-400 text-sm mb-2">
                <Crosshair className="w-4 h-4" />
                <span>Режим перемещения активен</span>
              </div>
              {targetProvinceName && (
                <div className="flex items-center gap-2 text-blue-300 text-sm">
                  <span>{currentProvinceName}</span>
                  <ArrowRight className="w-4 h-4" />
                  <span className="font-semibold">{targetProvinceName}</span>
                </div>
              )}
              {!targetProvinceName && <p className="text-blue-300 text-sm">Нажмите на провинцию на карте, чтобы выбрать пункт назначения</p>}
            </div>
          )}

          {/* Кнопки действия */}
          <div className="flex gap-2 p-4">
            {isOwnDivision ? (
              <>
                <AppButton
                  variant="primary"
                  size="sm"
                  onClick={isMoving ? onMoveCancel : onMoveStart}
                  className="flex-1"
                >
                  {isMoving ? "Отменить перемещение" : "Отправить в поход"}
                </AppButton>
                {onDelete && (
                  <AppButton
                    variant="danger"
                    size="sm"
                    onClick={onDelete}
                    title="Расформировать дивизию"
                  >
                    <Trash2 className="w-4 h-4" />
                  </AppButton>
                )}
              </>
            ) : (
              <AppButton variant="secondary" size="sm" onClick={onClose} className="flex-1">
                Закрыть
              </AppButton>
            )}
          </div>
        </AppCard>
      </div>
    </div>
  );
}
