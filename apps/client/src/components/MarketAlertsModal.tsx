import { AlertTriangle } from "lucide-react";
import type { MarketOverviewAlert } from "../lib/api";
import { AppModal, AppModalHeader } from "./ui/AppModal";
import { AppCard, AppEmptyState } from "./ui/AppSurface";

type Props = {
  open: boolean;
  onClose: () => void;
  alerts: MarketOverviewAlert[];
};

export function MarketAlertsModal({ open, onClose, alerts }: Props) {
  if (!open) return null;

  return (
    <AppModal
      modalKey="market-alerts"
      open={open}
      onClose={onClose}
      zIndexClassName="z-[178]"
      panelClassName="arc-scrollbar max-h-[min(92vh,760px)] w-[min(92vw,780px)] overflow-auto"
      paddingClassName="p-4 md:p-6 flex items-center justify-center"
    >
          <AppModalHeader
            title="Алерты рынка"
            description="События дефицита, перегруза и неактивности зданий"
            onClose={onClose}
          />

          <div className="space-y-2">
            {alerts.map((alert) => (
              <AppCard
                key={alert.id}
                className={`text-xs ${
                  alert.severity === "critical"
                    ? "border-red-400/35 bg-red-500/10 text-red-100"
                    : "border-amber-400/35 bg-amber-500/10 text-amber-100"
                }`}
              >
                <div className="mb-0.5 inline-flex items-center gap-1.5 font-semibold">
                  <AlertTriangle size={13} />
                  {alert.kind}
                </div>
                <div>{alert.message}</div>
              </AppCard>
            ))}
            {alerts.length === 0 && <AppEmptyState>Нет алертов.</AppEmptyState>}
          </div>
    </AppModal>
  );
}
