import { Monitor, Save, Sliders } from "lucide-react";
import { useEffect, useState } from "react";
import { AppButton } from "./templates/AppButton";
import { AppToggle } from "./templates/AppForm";
import { AppModal, AppModalHeader } from "./templates/AppModal";
import { AppCard, AppSection } from "./templates/AppSurface";
import { useUiText } from "../i18n/useUiText";
import type { UiLocale } from "../i18n/uiText";

type Props = {
  open: boolean;
  showMapControls: boolean;
  showZoomIndicator: boolean;
  edgeScrollEnabled: boolean;
  sortNotifications: boolean;
  onClose: () => void;
  onSave: (settings: { showMapControls: boolean; showZoomIndicator: boolean; edgeScrollEnabled: boolean; sortNotifications: boolean }) => void;
};

export function ClientSettingsModal({ open, showMapControls, showZoomIndicator, edgeScrollEnabled, sortNotifications, onClose, onSave }: Props) {
  const { locale, setLocale, t } = useUiText();
  const [draftShowMapControls, setDraftShowMapControls] = useState(showMapControls);
  const [draftShowZoomIndicator, setDraftShowZoomIndicator] = useState(showZoomIndicator);
  const [draftEdgeScrollEnabled, setDraftEdgeScrollEnabled] = useState(edgeScrollEnabled);
  const [draftSortNotifications, setDraftSortNotifications] = useState(sortNotifications);
  const [draftLocale, setDraftLocale] = useState<UiLocale>(locale);
  const [activeCategory, setActiveCategory] = useState<"interface">("interface");

  useEffect(() => {
    if (open) {
      setDraftShowMapControls(showMapControls);
      setDraftShowZoomIndicator(showZoomIndicator);
      setDraftEdgeScrollEnabled(edgeScrollEnabled);
      setDraftSortNotifications(sortNotifications);
      setDraftLocale(locale);
    }
  }, [edgeScrollEnabled, locale, open, showMapControls, showZoomIndicator, sortNotifications]);

  return (
    <AppModal open={open} onClose={onClose} modalKey="client-settings" zIndexClassName="z-[126]" paddingClassName="p-4" panelClassName="rounded-none">
          <AppModalHeader title={t("clientSettings.title")} onClose={onClose} />

          <div className="grid h-[calc(100vh-92px)] gap-4 md:grid-cols-[240px_1fr]">
            <AppSection className="arc-scrollbar overflow-auto p-2">
              <AppButton
                type="button"
                onClick={() => setActiveCategory("interface")}
                variant={activeCategory === "interface" ? "primary" : "ghost"}
                size="md"
                className="mb-2 w-full justify-start"
                icon={<Monitor size={15} />}
              >
                {t("clientSettings.interface")}
              </AppButton>
              <div className="px-3 py-2 text-xs text-[var(--arc-color-text-muted)]">
                {t("clientSettings.localNote")}
              </div>
            </AppSection>

            <AppSection className="arc-scrollbar overflow-auto p-4">
              <div className="space-y-4">
                <AppCard className="bg-[var(--arc-overlay-30)] p-4">
                  <div className="mb-3 flex items-center gap-2 text-sm text-[var(--arc-color-text)]">
                    <Monitor size={15} className="text-[var(--arc-color-gold)]" />
                    {t("clientSettings.interface")}
                  </div>
                  <label className="mb-3 block">
                    <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[var(--arc-color-text-muted)]">
                      {t("clientSettings.uiLanguage")}
                    </span>
                    <select
                      value={draftLocale}
                      onChange={(event) => setDraftLocale(event.target.value === "en" ? "en" : "ru")}
                      className="w-full rounded-lg border border-[var(--arc-color-brown-dark)] bg-[var(--arc-color-paper-muted)] px-3 py-2 text-sm text-[var(--arc-color-text-paper)] shadow-[var(--arc-shadow-inset-soft)] outline-none transition focus:border-[var(--arc-color-primary-top)]"
                    >
                      <option value="ru">{t("locale.russian")}</option>
                      <option value="en">{t("locale.english")}</option>
                    </select>
                    <span className="mt-1 block text-[11px] text-[var(--arc-color-text-muted)]">
                      {t("clientSettings.languageDescription")}
                    </span>
                  </label>
                  <AppToggle
                    checked={draftShowMapControls}
                    onChange={setDraftShowMapControls}
                    label={t("clientSettings.mapControls")}
                    description={t("clientSettings.mapControlsDescription")}
                  />

                  <AppToggle
                    checked={draftShowZoomIndicator}
                    onChange={setDraftShowZoomIndicator}
                    label={t("clientSettings.zoomIndicator")}
                    description={t("clientSettings.zoomIndicatorDescription")}
                    className="mt-3"
                  />

                  <AppToggle
                    checked={draftEdgeScrollEnabled}
                    onChange={setDraftEdgeScrollEnabled}
                    label={t("clientSettings.edgeScroll")}
                    description={t("clientSettings.edgeScrollDescription")}
                    className="mt-3"
                  />

                  <AppToggle
                    checked={draftSortNotifications}
                    onChange={setDraftSortNotifications}
                    label={t("clientSettings.sortNotifications")}
                    description={t("clientSettings.sortNotificationsDescription")}
                    className="mt-3"
                  />
                </AppCard>

                <AppCard className="bg-[var(--arc-overlay-30)] p-4">
                  <div className="mb-3 flex items-center gap-2 text-sm text-[var(--arc-color-text)]">
                    <Sliders size={15} className="text-[var(--arc-color-gold)]" />
                    {t("clientSettings.descriptionTitle")}
                  </div>
                  <p className="text-xs text-[var(--arc-color-text-muted)]">
                    {t("clientSettings.description")}
                  </p>
                </AppCard>

                <div className="flex justify-end">
                  <AppButton
                    type="button"
                    onClick={() => {
                      setLocale(draftLocale);
                      onSave({
                        showMapControls: draftShowMapControls,
                        showZoomIndicator: draftShowZoomIndicator,
                        edgeScrollEnabled: draftEdgeScrollEnabled,
                        sortNotifications: draftSortNotifications,
                      });
                      onClose();
                    }}
                    variant="primary"
                    icon={<Save size={14} />}
                  >
                    {t("clientSettings.save")}
                  </AppButton>
                </div>
              </div>
            </AppSection>
          </div>
    </AppModal>
  );
}
