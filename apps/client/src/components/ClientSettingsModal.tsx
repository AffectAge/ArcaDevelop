import { Monitor, Save, Sliders } from "lucide-react";
import { useEffect, useState } from "react";
import { AppButton } from "./ui/AppButton";
import { AppToggle } from "./ui/AppForm";
import { AppModal, AppModalHeader } from "./ui/AppModal";
import { AppCard, AppSection } from "./ui/AppSurface";
import { useUiText } from "../i18n/useUiText";
import type { UiLocale } from "../i18n/uiText";

type Props = {
  open: boolean;
  showMapControls: boolean;
  sortNotifications: boolean;
  onClose: () => void;
  onSave: (settings: { showMapControls: boolean; sortNotifications: boolean }) => void;
};

export function ClientSettingsModal({ open, showMapControls, sortNotifications, onClose, onSave }: Props) {
  const { locale, setLocale, t } = useUiText();
  const [draftShowMapControls, setDraftShowMapControls] = useState(showMapControls);
  const [draftSortNotifications, setDraftSortNotifications] = useState(sortNotifications);
  const [draftLocale, setDraftLocale] = useState<UiLocale>(locale);
  const [activeCategory, setActiveCategory] = useState<"interface">("interface");

  useEffect(() => {
    if (open) {
      setDraftShowMapControls(showMapControls);
      setDraftSortNotifications(sortNotifications);
      setDraftLocale(locale);
    }
  }, [locale, open, showMapControls, sortNotifications]);

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
              <div className="px-3 py-2 text-xs text-slate-500">
                {t("clientSettings.localNote")}
              </div>
            </AppSection>

            <AppSection className="arc-scrollbar overflow-auto p-4">
              <div className="space-y-4">
                <AppCard className="bg-black/20 p-4">
                  <div className="mb-3 flex items-center gap-2 text-sm text-slate-200">
                    <Monitor size={15} className="text-arc-accent" />
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
                    checked={draftSortNotifications}
                    onChange={setDraftSortNotifications}
                    label={t("clientSettings.sortNotifications")}
                    description={t("clientSettings.sortNotificationsDescription")}
                    className="mt-3"
                  />
                </AppCard>

                <AppCard className="bg-black/20 p-4">
                  <div className="mb-3 flex items-center gap-2 text-sm text-slate-200">
                    <Sliders size={15} className="text-arc-accent" />
                    {t("clientSettings.descriptionTitle")}
                  </div>
                  <p className="text-xs text-slate-500">
                    {t("clientSettings.description")}
                  </p>
                </AppCard>

                <div className="flex justify-end">
                  <AppButton
                    type="button"
                    onClick={() => {
                      setLocale(draftLocale);
                      onSave({ showMapControls: draftShowMapControls, sortNotifications: draftSortNotifications });
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
