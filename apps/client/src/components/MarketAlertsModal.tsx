import { AlertTriangle } from "lucide-react";
import { useUiText } from "../i18n/useUiText";
import type { MarketOverviewAlert } from "../lib/api";
import { AppModal, AppModalHeader } from "./ui/AppModal";
import { AppCard, AppEmptyState } from "./ui/AppSurface";

type Props = {
  open: boolean;
  onClose: () => void;
  alerts: MarketOverviewAlert[];
};

export function MarketAlertsModal({ open, onClose, alerts }: Props) {
  const { t } = useUiText();

  if (!open) return null;

  return (
    <AppModal
      modalKey="market-alerts"
      open={open}
      onClose={onClose}
      zIndexClassName="z-[178]"
      panelClassName="arc-market-subpanel arc-scrollbar max-h-[min(92vh,760px)] w-[min(92vw,780px)] overflow-auto"
      paddingClassName="p-4 md:p-6 flex items-center justify-center"
    >
          <AppModalHeader
            title={t("market.alertsTitle")}
            description={t("market.alertsDescription")}
            onClose={onClose}
          />

          <div className="space-y-2">
            {alerts.map((alert) => (
              <AppCard
                key={alert.id}
                className={`text-xs ${alert.severity === "critical" ? "arc-market-danger-card" : "arc-market-warning-card"}`}
              >
                <div className="mb-0.5 inline-flex items-center gap-1.5 font-semibold">
                  <AlertTriangle size={13} />
                  {alert.kind}
                </div>
                <div>{alert.message}</div>
              </AppCard>
            ))}
            {alerts.length === 0 && <AppEmptyState>{t("market.noAlerts")}</AppEmptyState>}
          </div>
    </AppModal>
  );
}
