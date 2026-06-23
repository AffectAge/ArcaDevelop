import { useEffect, useMemo, useState } from "react";
import { Coins, Palette, Save, Upload } from "lucide-react";
import { toast } from "sonner";
import { fetchPublicCustomizationPrices, type CustomizationPrices, updateOwnCountryCustomization } from "../lib/api";
import { AppButton } from "./ui/AppButton";
import { AppModal, AppModalHeader } from "./ui/AppModal";
import { AppCard, AppSection } from "./ui/AppSurface";
import type { UiTextKey } from "../i18n/uiText";
import { useUiText } from "../i18n/useUiText";

type Props = {
  open: boolean;
  token: string;
  country: {
    name: string;
    color: string;
    flagUrl?: string | null;
    crestUrl?: string | null;
  };
  currentDucats: number;
  ducatsIconUrl?: string | null;
  onClose: () => void;
  onSaved: (payload: { name: string; color: string; flagUrl?: string | null; crestUrl?: string | null; ducats: number; chargedDucats: number }) => void;
};

const defaultPrices: CustomizationPrices = {
  renameDucats: 20,
  recolorDucats: 10,
  flagDucats: 15,
  crestDucats: 15,
  hexRenameDucats: 25,
};

function formatCompact(value: number): string {
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  const units = [
    { n: 1_000_000_000_000, s: "T" },
    { n: 1_000_000_000, s: "B" },
    { n: 1_000_000, s: "M" },
    { n: 1_000, s: "K" },
  ] as const;

  for (const unit of units) {
    if (abs >= unit.n) {
      const scaled = abs / unit.n;
      const text =
        scaled >= 100
          ? Math.floor(scaled).toString()
          : scaled >= 10
            ? scaled.toFixed(1).replace(/\.0$/, "")
            : scaled.toFixed(2).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1");
      return `${sign}${text}${unit.s}`;
    }
  }

  return `${sign}${Math.floor(abs)}`;
}

function DucatValue({ value, iconUrl, className = "" }: { value: number; iconUrl?: string | null; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 ${className}`.trim()}>
      {iconUrl ? (
        <img src={iconUrl} alt="" className="h-[20px] w-[20px] object-contain" />
      ) : (
        <Coins size={13} className="text-[var(--arc-color-gold)]" />
      )}
      <span>{formatCompact(value)}</span>
    </span>
  );
}

async function isImageWithinRule(
  file: File,
  rule: { maxWidth: number; maxHeight: number; ratioWidth: number; ratioHeight: number },
): Promise<boolean> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const ratio = img.width / Math.max(1, img.height);
      const targetRatio = rule.ratioWidth / rule.ratioHeight;
      const ok =
        img.width <= rule.maxWidth &&
        img.height <= rule.maxHeight &&
        Math.abs(ratio - targetRatio) <= 0.01;
      URL.revokeObjectURL(url);
      resolve(ok);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(false);
    };
    img.src = url;
  });
}

function FilePicker({
  label,
  file,
  hint,
  selectLabel,
  onChange,
}: {
  label: string;
  file: File | null;
  hint: string;
  selectLabel: string;
  onChange: (file: File | null) => void;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs text-[var(--arc-color-text-soft)]">{label}</label>
      <label className="panel-border flex cursor-pointer items-center gap-2 rounded-lg bg-[var(--arc-overlay-35)] px-3 py-2 text-sm text-[var(--arc-color-text)] transition hover:border-[var(--arc-color-gold)]">
        <Upload size={14} className="text-[var(--arc-color-gold)]" />
        <span className="truncate">{file ? file.name : selectLabel}</span>
        <input type="file" accept="image/*" className="hidden" onChange={(e) => onChange(e.target.files?.[0] ?? null)} />
      </label>
      <p className="mt-1 text-xs text-[var(--arc-color-text-muted)]">{hint}</p>
    </div>
  );
}

export function CountryCustomizationModal({ open, token, country, currentDucats, ducatsIconUrl, onClose, onSaved }: Props) {
  const { t } = useUiText();
  const [loadingPrices, setLoadingPrices] = useState(false);
  const [saving, setSaving] = useState(false);
  const [prices, setPrices] = useState<CustomizationPrices>(defaultPrices);
  const [name, setName] = useState(country.name);
  const [color, setColor] = useState(country.color);
  const [flagFile, setFlagFile] = useState<File | null>(null);
  const [crestFile, setCrestFile] = useState<File | null>(null);
  const [flagPreviewUrl, setFlagPreviewUrl] = useState<string | null>(null);
  const [crestPreviewUrl, setCrestPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    setName(country.name);
    setColor(country.color);
    setFlagFile(null);
    setCrestFile(null);
  }, [open, country.color, country.name]);

  useEffect(() => {
    if (!open) {
      return;
    }
    let cancelled = false;
    setLoadingPrices(true);
    fetchPublicCustomizationPrices()
      .then((next) => {
        if (!cancelled) {
          setPrices(next);
        }
      })
      .catch(() => {
        if (!cancelled) {
          toast.error(t("customization.loadPricesFailed"));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingPrices(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!flagFile) {
      setFlagPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(flagFile);
    setFlagPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [flagFile]);

  useEffect(() => {
    if (!crestFile) {
      setCrestPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(crestFile);
    setCrestPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [crestFile]);

  const normalizedName = name.trim();
  const normalizedColor = color.trim();
  const nameChanged = normalizedName.length >= 2 && normalizedName !== country.name;
  const colorChanged = /^#[0-9a-fA-F]{6}$/.test(normalizedColor) && normalizedColor.toLowerCase() !== country.color.toLowerCase();
  const totalCost = (nameChanged ? prices.renameDucats : 0) + (colorChanged ? prices.recolorDucats : 0) + (flagFile ? prices.flagDucats : 0) + (crestFile ? prices.crestDucats : 0);
  const canAfford = currentDucats >= totalCost;

  const changes = useMemo(
    () => [
      { labelKey: "customization.rename" as UiTextKey, enabled: nameChanged, cost: prices.renameDucats },
      { labelKey: "customization.changeColor" as UiTextKey, enabled: colorChanged, cost: prices.recolorDucats },
      { labelKey: "customization.changeFlag" as UiTextKey, enabled: Boolean(flagFile), cost: prices.flagDucats },
      { labelKey: "customization.changeCrest" as UiTextKey, enabled: Boolean(crestFile), cost: prices.crestDucats },
    ],
    [colorChanged, crestFile, flagFile, nameChanged, prices],
  );

  const submit = async () => {
    if (!nameChanged && !colorChanged && !flagFile && !crestFile) {
      toast.error(t("customization.noChanges"));
      return;
    }

    if (normalizedName.length > 0 && normalizedName.length < 2) {
      toast.error(t("auth.min2"));
      return;
    }

    if (normalizedColor && !/^#[0-9a-fA-F]{6}$/.test(normalizedColor)) {
      toast.error(t("auth.invalidHex"));
      return;
    }

    if (!canAfford) {
      toast.error(t("customization.insufficientDucats", { need: totalCost, available: currentDucats }));
      return;
    }

    if (flagFile && !(await isImageWithinRule(flagFile, { maxWidth: 192, maxHeight: 128, ratioWidth: 3, ratioHeight: 2 }))) {
      toast.error(t("auth.flagInvalid"));
      return;
    }
    if (crestFile && !(await isImageWithinRule(crestFile, { maxWidth: 128, maxHeight: 192, ratioWidth: 2, ratioHeight: 3 }))) {
      toast.error(t("auth.crestInvalid"));
      return;
    }

    setSaving(true);
    try {
      const result = await updateOwnCountryCustomization(token, {
        countryName: nameChanged ? normalizedName : undefined,
        countryColor: colorChanged ? normalizedColor : undefined,
        flagFile,
        crestFile,
      });

      onSaved({
        name: result.country.name,
        color: result.country.color,
        flagUrl: result.country.flagUrl,
        crestUrl: result.country.crestUrl,
        ducats: result.resources.ducats,
        chargedDucats: result.chargedDucats,
      });
      toast.success(t("customization.applied", { ducats: result.chargedDucats }));
      onClose();
    } catch (err) {
      const code = err instanceof Error ? err.message : "COUNTRY_CUSTOMIZATION_FAILED";
      if (code === "INSUFFICIENT_DUCATS") {
        toast.error(t("customization.notEnoughDucats"));
      } else if (code === "IMAGE_DIMENSIONS_TOO_LARGE") {
        toast.error(t("auth.imageFormatInvalid"));
      } else if (code === "FILE_TOO_LARGE") {
        toast.error(t("auth.fileTooLarge"));
      } else if (code === "ONLY_IMAGES") {
        toast.error(t("auth.onlyImages"));
      } else if (code === "NO_CHANGES") {
        toast.error(t("customization.noChanges"));
      } else {
        toast.error(t("customization.applyFailed"));
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppModal
      modalKey="country-customization"
      open={open}
      onClose={onClose}
      zIndexClassName="z-[130]"
      panelClassName="h-auto w-full max-w-3xl"
      paddingClassName="p-4 flex items-center justify-center"
    >
          <AppModalHeader
            title={t("shell.action.customization")}
            description={t("customization.availableDucats", { ducats: formatCompact(currentDucats) })}
            onClose={onClose}
          />

          <div className="grid gap-4 md:grid-cols-[1.25fr_.85fr]">
            <AppSection className="space-y-4 p-4">
              <div>
                <label className="mb-1 block text-xs text-[var(--arc-color-text-soft)]">{t("auth.countryName")}</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-lg border border-[var(--arc-color-gold-soft)] bg-[var(--arc-overlay-35)] px-3 py-2 text-sm text-[var(--arc-color-text)] outline-none transition placeholder:text-[var(--arc-color-text-muted)] focus:border-[var(--arc-color-gold)]"
                  placeholder={t("auth.countryName")}
                />
              </div>

              <div>
                <label className="mb-1 flex items-center gap-2 text-xs text-[var(--arc-color-text-soft)]">
                  <Palette size={13} /> {t("auth.countryColor")}
                </label>
                <div className="flex items-center gap-2">
                  <input type="color" value={/^#[0-9a-fA-F]{6}$/.test(color) ? color : "#4ade80"} onChange={(e) => setColor(e.target.value)} className="panel-border h-10 w-12 rounded-lg bg-[var(--arc-overlay-35)] p-1" />
                  <input
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="flex-1 rounded-lg border border-[var(--arc-color-gold-soft)] bg-[var(--arc-overlay-35)] px-3 py-2 text-sm text-[var(--arc-color-text)] outline-none transition placeholder:text-[var(--arc-color-text-muted)] focus:border-[var(--arc-color-gold)]"
                    placeholder="#4ade80"
                  />
                  <span className="panel-border h-9 w-9 rounded-md" style={{ backgroundColor: /^#[0-9a-fA-F]{6}$/.test(color) ? color : "var(--arc-color-panel-soft)" }} />
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <FilePicker
                  label={t("auth.flag")}
                  file={flagFile}
                  hint={t("auth.flagHint")}
                  selectLabel={t("auth.selectImage")}
                  onChange={setFlagFile}
                />
                <FilePicker
                  label={t("auth.crest")}
                  file={crestFile}
                  hint={t("auth.crestHint")}
                  selectLabel={t("auth.selectImage")}
                  onChange={setCrestFile}
                />
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <AppCard className="bg-[var(--arc-overlay-30)] p-2">
                  <div className="mb-2 text-xs text-[var(--arc-color-text-muted)]">{t("auth.flagPreview")}</div>
                  <div className="h-24 overflow-hidden rounded-md bg-[var(--arc-overlay-35)]">
                    {flagPreviewUrl ? (
                      <img src={flagPreviewUrl} alt={t("customization.flagPreviewAlt")} className="h-full w-full object-contain p-1" />
                    ) : country.flagUrl ? (
                      <img src={country.flagUrl} alt={t("customization.currentFlagAlt")} className="h-full w-full object-contain p-1 opacity-80" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs text-[var(--arc-color-text-muted)]">{t("customization.notSelected")}</div>
                    )}
                  </div>
                </AppCard>

                <AppCard className="bg-[var(--arc-overlay-30)] p-2">
                  <div className="mb-2 text-xs text-[var(--arc-color-text-muted)]">{t("auth.crestPreview")}</div>
                  <div className="h-24 overflow-hidden rounded-md bg-[var(--arc-overlay-35)]">
                    {crestPreviewUrl ? (
                      <img src={crestPreviewUrl} alt={t("customization.crestPreviewAlt")} className="h-full w-full object-contain p-1" />
                    ) : country.crestUrl ? (
                      <img src={country.crestUrl} alt={t("customization.currentCrestAlt")} className="h-full w-full object-contain p-1 opacity-80" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs text-[var(--arc-color-text-muted)]">{t("customization.notSelected")}</div>
                    )}
                  </div>
                </AppCard>
              </div>
            </AppSection>

            <AppSection className="space-y-3 p-4">
              <div className="text-sm font-semibold text-[var(--arc-color-text)]">{t("customization.costTitle")}</div>
              {loadingPrices && <div className="text-xs text-[var(--arc-color-text-muted)]">{t("customization.loadingPrices")}</div>}

              <div className="space-y-2 text-sm">
                {changes.map((item) => (
                  <div key={item.labelKey} className={`flex items-center justify-between rounded-lg px-2 py-1 ${item.enabled ? "bg-[var(--arc-overlay-30)] text-[var(--arc-color-text)]" : "text-[var(--arc-color-text-muted)]"}`}>
                    <span>{t(item.labelKey)}</span>
                    <DucatValue value={item.enabled ? item.cost : 0} iconUrl={ducatsIconUrl} className={item.enabled ? "text-[var(--arc-color-text)]" : "text-[var(--arc-color-text-muted)]"} />
                  </div>
                ))}
              </div>

              <AppCard className="bg-[var(--arc-overlay-30)]">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[var(--arc-color-text-soft)]">{t("customization.total")}</span>
                  <strong className="text-[var(--arc-color-gold)]">
                    <DucatValue value={totalCost} iconUrl={ducatsIconUrl} className="text-[var(--arc-color-gold)]" />
                  </strong>
                </div>
                <div className="mt-1 flex items-center justify-between text-xs">
                  <span className="text-[var(--arc-color-text-muted)]">{t("customization.afterPurchase")}</span>
                  <DucatValue value={currentDucats - totalCost} iconUrl={ducatsIconUrl} className={canAfford ? "text-[var(--arc-color-text-soft)]" : "text-[var(--arc-color-danger-text)]"} />
                </div>
              </AppCard>

              <AppButton
                type="button"
                onClick={submit}
                disabled={saving || totalCost <= 0 || !canAfford}
                variant="primary"
                className="w-full"
                icon={<Save size={14} />}
              >
                {saving ? t("customization.saving") : t("customization.buyAndApply")}
              </AppButton>
            </AppSection>
          </div>
    </AppModal>
  );
}
