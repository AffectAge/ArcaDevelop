import { Listbox } from "@headlessui/react";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { colord } from "colord";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  Coins,
  GraduationCap,
  Hammer,
  Heart,
  ImagePlus,
  LoaderCircle,
  LogIn,
  Palette,
  Ruler,
  Server,
  ShieldCheck,
  Sparkles,
  Star,
  UserPlus,
  Users,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { fetchContentEntries, fetchCountries, fetchServerStatus, login, register } from "../lib/api";
import type { ContentEntry } from "../lib/api";
import type { Country, ServerStatus } from "@arcanorum/shared";
import { toast } from "sonner";
import { AnimatePresence, motion } from "framer-motion";
import { Tooltip } from "./Tooltip";
import { useUiText } from "../i18n/useUiText";
import type { UiTextKey } from "../i18n/uiText";

const REMEMBER_LOGIN_KEY = "arc.auth.rememberedLogin";

type LoginFormValues = {
  countryId: string;
  password: string;
  rememberMe: boolean;
};

type RegisterFormValues = {
  countryName: string;
  countryColor: string;
  cultureGroupId: string;
  cultureName: string;
  cultureColor: string;
  religionGroupId: string;
  religionName: string;
  religionColor: string;
  raceId: string;
  password: string;
  confirmPassword: string;
};

type AuthMode = "login" | "register";
type RegisterStep = "info" | "culture" | "religion" | "race" | "confirm";
type ContentModifierEffect = NonNullable<NonNullable<ContentEntry["modifiers"]>[number]["effects"]>[number];
type AuthTranslator = (key: UiTextKey | string, params?: Record<string, string | number>) => string;

export type AuthSuccess = {
  token: string;
  countryId: string;
  playerId: string;
  countryName: string;
  countryColor: string;
  flagUrl?: string | null;
  crestUrl?: string | null;
  turnId: number;
  isAdmin: boolean;
  clientSettings?: {
    eventLogRetentionTurns: number;
  };
};

type Props = {
  onSuccess: (payload: AuthSuccess) => void;
  onOpenCivilopedia?: () => void;
};

const statusMeta: Record<ServerStatus, { labelKey: UiTextKey; cls: string }> = {
  online: { labelKey: "auth.serverStatus.online", cls: "bg-[var(--arc-color-success-text)]" },
  offline: { labelKey: "auth.serverStatus.offline", cls: "bg-[var(--arc-color-danger-text)]" },
  maintenance: { labelKey: "auth.serverStatus.maintenance", cls: "bg-[var(--arc-color-warning-top)]" },
};

const presetColors = ["#4ade80", "#22d3ee", "#60a5fa", "#f59e0b", "#ef4444", "#a78bfa"];
const AUTH_LABEL_CLASS = "arc-auth-label";
const AUTH_INPUT_CLASS = "arc-auth-input";
const AUTH_OPTION_CLASS = (active: boolean) =>
  `arc-auth-option ${active ? "arc-auth-option--active" : ""}`;
const AUTH_STATUS_OK_CLASS = "arc-auth-check arc-auth-check--ok";
const AUTH_STATUS_IDLE_CLASS = "arc-auth-check";
const REGISTER_STEPS: Array<{ id: RegisterStep; labelKey: UiTextKey }> = [
  { id: "info", labelKey: "auth.step.info" },
  { id: "culture", labelKey: "auth.step.culture" },
  { id: "religion", labelKey: "auth.step.religion" },
  { id: "race", labelKey: "auth.step.race" },
  { id: "confirm", labelKey: "auth.step.confirm" },
];

function FieldError({ text }: { text?: string }) {
  if (!text) {
    return null;
  }

  return <p className="arc-auth-error">{text}</p>;
}

function ImageUploadFrame({
  label,
  file,
  previewUrl,
  hint,
  onChange,
  onClear,
  t,
}: {
  label: string;
  file: File | null;
  previewUrl: string | null;
  hint: string;
  onChange: (file: File | null) => void;
  onClear: () => void;
  t: AuthTranslator;
}) {
  return (
    <div className="arc-auth-upload-field">
      <div className="arc-auth-upload-heading">
        <label className={AUTH_LABEL_CLASS}>{label}</label>
        {file && (
          <Tooltip content={t("auth.clearImage")}>
            <button type="button" className="arc-auth-upload-clear" onClick={onClear} aria-label={t("auth.clearImage")}>
              <X size={13} />
            </button>
          </Tooltip>
        )}
      </div>
      <Tooltip content={file ? t("auth.replaceImage") : t("auth.selectImage")}>
        <label className={`arc-auth-upload-frame ${previewUrl ? "arc-auth-upload-frame--filled" : ""}`}>
          {previewUrl ? (
            <img src={previewUrl} alt="" aria-hidden="true" />
          ) : (
            <span className="arc-auth-upload-empty">
              <ImagePlus size={18} />
              <span>{t("auth.selectImage")}</span>
            </span>
          )}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => {
              onChange(event.target.files?.[0] ?? null);
              event.currentTarget.value = "";
            }}
            aria-label={label}
          />
        </label>
      </Tooltip>
      {file && <div className="arc-auth-upload-file" title={file.name}>{file.name}</div>}
      <p className="arc-auth-hint">{hint}</p>
    </div>
  );
}

function ColorPickerField({
  label,
  value,
  onChange,
  error,
  t,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  t: AuthTranslator;
}) {
  const safeColor = colord(value).isValid() ? colord(value).toHex() : "#4ade80";
  return (
    <div>
      <label className="arc-auth-label arc-auth-label-row">
        <Palette size={13} /> {label}
      </label>
      <div className="arc-auth-color-choice">
        <span className="arc-auth-color-preview" style={{ backgroundColor: safeColor }} />
        <div className="arc-auth-color-swatches">
          {presetColors.map((color) => {
            const selected = colord(color).toHex() === safeColor;
            return (
              <button
                key={color}
                type="button"
                onClick={() => onChange(color)}
                className={`arc-auth-color-preset ${selected ? "arc-auth-color-preset--selected" : ""}`}
                style={{ backgroundColor: color }}
                aria-label={t("auth.presetColor", { color })}
              />
            );
          })}
        </div>
        <label className="arc-auth-color-custom">
          <Palette size={14} />
          {t("auth.customColor")}
          <input
            type="color"
            value={safeColor}
            onChange={(event) => onChange(event.target.value)}
            aria-label={label}
          />
        </label>
      </div>
      <FieldError text={error} />
    </div>
  );
}

function getIdentityName(entry: ContentEntry, t: AuthTranslator): string {
  return entry.nameKey ? t(entry.nameKey) : entry.name;
}

function getIdentityDescription(entry: ContentEntry, t: AuthTranslator): string {
  return entry.descriptionKey ? t(entry.descriptionKey) : entry.description;
}

function IdentityEmblem({
  entry,
  t,
  size = "normal",
}: {
  entry: ContentEntry;
  t: AuthTranslator;
  size?: "normal" | "large";
}) {
  const label = getIdentityName(entry, t)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
  return (
    <span
      className={`arc-auth-identity-emblem ${size === "large" ? "arc-auth-identity-emblem--large" : ""}`}
      style={{ "--arc-auth-identity-color": entry.color || "#d6b66a" } as CSSProperties}
    >
      {entry.logoUrl ? <img src={entry.logoUrl} alt="" aria-hidden="true" /> : <span>{label || "?"}</span>}
    </span>
  );
}

function formatModifierEffect(
  t: AuthTranslator,
  effect: ContentModifierEffect,
): string {
  const statKey = `modifiers.stat.${effect.stat}` as UiTextKey;
  const value = effect.mode === "mult" ? `x${effect.value}` : effect.value > 0 ? `+${effect.value}` : `${effect.value}`;
  return `${t(statKey)} ${value}`;
}

function formatEffectValue(effect: ContentModifierEffect): string {
  if (effect.mode === "mult") return `x${effect.value}`;
  return effect.value > 0 ? `+${effect.value}` : `${effect.value}`;
}

function getModifierIcon(stat: string): LucideIcon {
  if (stat.includes("ducat") || stat.includes("gold")) return Coins;
  if (stat.includes("construction")) return Hammer;
  if (stat.includes("science")) return GraduationCap;
  if (stat.includes("culture")) return Star;
  if (stat.includes("religion")) return Sparkles;
  if (stat.includes("colonization")) return Users;
  return Zap;
}

function StatChip({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="arc-auth-stat-chip">
      <span className="arc-auth-stat-chip__icon">
        <Icon size={15} />
      </span>
      <span className="arc-auth-stat-chip__label">{label}</span>
      <span className="arc-auth-stat-chip__value">{value}</span>
    </div>
  );
}

function IdentityDetails({
  entry,
  t,
}: {
  entry: ContentEntry | null;
  t: AuthTranslator;
}) {
  if (!entry) {
    return (
      <div className="arc-auth-identity-detail arc-auth-identity-detail--empty">
        {t("auth.identitySelectPrompt")}
      </div>
    );
  }
  const modifierEffects = (entry.modifiers ?? []).flatMap((modifier) => modifier.effects ?? []);
  const startingPop = entry.startingPop;
  const startingRows: Array<{ icon: LucideIcon; label: string; value: string }> = [
    startingPop?.literacy != null
      ? { icon: GraduationCap, label: t("auth.startingPop.literacyLabel"), value: `${Math.round(startingPop.literacy * 100)}%` }
      : null,
    startingPop?.standardOfLiving != null
      ? { icon: Heart, label: t("auth.startingPop.solLabel"), value: `${startingPop.standardOfLiving}` }
      : null,
    startingPop?.ducats != null ? { icon: Coins, label: t("auth.startingPop.ducatsLabel"), value: `+${startingPop.ducats}` } : null,
    startingPop?.loyalists != null ? { icon: Users, label: t("auth.startingPop.loyalistsLabel"), value: `+${startingPop.loyalists}` } : null,
    startingPop?.radicals != null ? { icon: Zap, label: t("auth.startingPop.radicalsLabel"), value: `+${startingPop.radicals}` } : null,
  ].filter((row): row is { icon: LucideIcon; label: string; value: string } => Boolean(row));
  return (
    <div className="arc-auth-identity-detail">
      <div className="arc-auth-identity-detail__header">
        <IdentityEmblem entry={entry} t={t} size="large" />
        <div>
          <div className="arc-auth-identity-detail__name">{getIdentityName(entry, t)}</div>
          <div className="arc-auth-identity-detail__id">{entry.id}</div>
        </div>
      </div>
      <p className="arc-auth-identity-detail__description">{getIdentityDescription(entry, t) || t("auth.identityNoDescription")}</p>
      <div className="arc-auth-identity-section-title">{t("auth.identityBonuses")}</div>
      {modifierEffects.length > 0 ? (
        <div className="arc-auth-stat-chip-grid">
          {modifierEffects.map((effect, index) => (
            <StatChip
              key={`${effect.stat}:${index}`}
              icon={getModifierIcon(effect.stat)}
              label={t(`modifiers.stat.${effect.stat}`)}
              value={formatEffectValue(effect)}
            />
          ))}
        </div>
      ) : (
        <div className="arc-auth-identity-muted">{t("auth.noBonuses")}</div>
      )}
      <div className="arc-auth-identity-section-title">{t("auth.startingPopulation")}</div>
      {startingRows.length > 0 ? (
        <div className="arc-auth-stat-chip-grid">
          {startingRows.map((row) => (
            <StatChip key={`${row.label}:${row.value}`} icon={row.icon} label={row.label} value={row.value} />
          ))}
        </div>
      ) : (
        <div className="arc-auth-identity-muted">{t("auth.noStartingPopChanges")}</div>
      )}
    </div>
  );
}

function IdentitySelectionPanel({
  entries,
  selectedId,
  onSelect,
  t,
}: {
  entries: ContentEntry[];
  selectedId: string;
  onSelect: (id: string) => void;
  t: AuthTranslator;
}) {
  const selectedEntry = entries.find((entry) => entry.id === selectedId) ?? null;
  return (
    <div className="arc-auth-identity-layout">
      <div className="arc-auth-identity-grid" role="listbox" aria-label={t("auth.identityOptions")}>
        {entries.map((entry) => {
          const selected = entry.id === selectedId;
          return (
            <button
              key={entry.id}
              type="button"
              className={`arc-auth-identity-tile ${selected ? "arc-auth-identity-tile--selected" : ""}`}
              onClick={() => onSelect(entry.id)}
              role="option"
              aria-selected={selected}
              aria-label={getIdentityName(entry, t)}
            >
              <IdentityEmblem entry={entry} t={t} />
              {selected && <Check size={14} className="arc-auth-identity-tile__check" />}
            </button>
          );
        })}
      </div>
      <IdentityDetails entry={selectedEntry} t={t} />
    </div>
  );
}

function getMissingRegistrationFields(
  values: RegisterFormValues,
  t: AuthTranslator,
): string[] {
  const missing: string[] = [];
  if (!values.countryName.trim()) missing.push(t("auth.countryName"));
  if (!colord(values.countryColor).isValid()) missing.push(t("auth.countryColor"));
  if (!values.cultureGroupId) missing.push(t("auth.cultureGroup"));
  if (!values.cultureName.trim()) missing.push(t("auth.cultureName"));
  if (!colord(values.cultureColor).isValid()) missing.push(t("auth.cultureColor"));
  if (!values.religionGroupId) missing.push(t("auth.religionGroup"));
  if (!values.religionName.trim()) missing.push(t("auth.religionName"));
  if (!colord(values.religionColor).isValid()) missing.push(t("auth.religionColor"));
  if (!values.raceId) missing.push(t("auth.race"));
  if (values.password.length < 8) missing.push(t("auth.password"));
  if (!values.confirmPassword || values.password !== values.confirmPassword) missing.push(t("auth.repeatPassword"));
  return missing;
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

export function AuthPanel({ onSuccess, onOpenCivilopedia }: Props) {
  const { t } = useUiText();
  const loginSchema = useMemo(
    () =>
      z.object({
        countryId: z.string().min(1, t("auth.chooseCountry")),
        password: z.string().min(1, t("auth.enterPassword")),
        rememberMe: z.boolean(),
      }),
    [t],
  );
  const registerSchema = useMemo(
    () =>
      z
        .object({
          countryName: z.string().min(2, t("auth.min2")),
          countryColor: z.string().min(1),
          cultureGroupId: z.string().min(1, t("auth.chooseCultureGroup")),
          cultureName: z.string().min(2, t("auth.min2")),
          cultureColor: z.string().min(1),
          religionGroupId: z.string().min(1, t("auth.chooseReligionGroup")),
          religionName: z.string().min(2, t("auth.min2")),
          religionColor: z.string().min(1),
          raceId: z.string().min(1, t("auth.chooseRace")),
          password: z.string().min(8, t("auth.min8")),
          confirmPassword: z.string().min(1, t("auth.repeatPassword")),
        })
        .superRefine((val, ctx) => {
          if (val.password !== val.confirmPassword) {
            ctx.addIssue({ code: "custom", message: t("auth.passwordMismatch"), path: ["confirmPassword"] });
          }

          const parsed = colord(val.countryColor);
          if (!parsed.isValid()) {
            ctx.addIssue({ code: "custom", message: t("auth.invalidHex"), path: ["countryColor"] });
          }
          if (!colord(val.cultureColor).isValid()) {
            ctx.addIssue({ code: "custom", message: t("auth.invalidHex"), path: ["cultureColor"] });
          }
          if (!colord(val.religionColor).isValid()) {
            ctx.addIssue({ code: "custom", message: t("auth.invalidHex"), path: ["religionColor"] });
          }
        }),
    [t],
  );
  const [countries, setCountries] = useState<Country[]>([]);
  const [serverStatus, setServerStatus] = useState<ServerStatus>("offline");
  const [cultureGroups, setCultureGroups] = useState<ContentEntry[]>([]);
  const [religionGroups, setReligionGroups] = useState<ContentEntry[]>([]);
  const [races, setRaces] = useState<ContentEntry[]>([]);
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [registerStep, setRegisterStep] = useState<RegisterStep>("info");
  const [loading, setLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(8);
  const [submitting, setSubmitting] = useState(false);
  const [flagFile, setFlagFile] = useState<File | null>(null);
  const [crestFile, setCrestFile] = useState<File | null>(null);
  const [cultureLogoFile, setCultureLogoFile] = useState<File | null>(null);
  const [religionLogoFile, setReligionLogoFile] = useState<File | null>(null);
  const [flagPreviewUrl, setFlagPreviewUrl] = useState<string | null>(null);
  const [crestPreviewUrl, setCrestPreviewUrl] = useState<string | null>(null);
  const [cultureLogoPreviewUrl, setCultureLogoPreviewUrl] = useState<string | null>(null);
  const [religionLogoPreviewUrl, setReligionLogoPreviewUrl] = useState<string | null>(null);
  const [registrationPendingModal, setRegistrationPendingModal] = useState<{ open: boolean; countryName: string }>({
    open: false,
    countryName: "",
  });

  const loginForm = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { countryId: "", password: "", rememberMe: true },
  });

  const registerForm = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      countryName: "",
      countryColor: "#4ade80",
      cultureGroupId: "",
      cultureName: "",
      cultureColor: "#4ade80",
      religionGroupId: "",
      religionName: "",
      religionColor: "#a78bfa",
      raceId: "",
      password: "",
      confirmPassword: "",
    },
  });

  useEffect(() => {
    try {
      const raw = localStorage.getItem(REMEMBER_LOGIN_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<LoginFormValues>;
      if (typeof parsed.countryId === "string") {
        loginForm.setValue("countryId", parsed.countryId);
      }
      if (typeof parsed.password === "string") {
        loginForm.setValue("password", parsed.password);
      }
      if (typeof parsed.rememberMe === "boolean") {
        loginForm.setValue("rememberMe", parsed.rememberMe);
      }
    } catch {
      // ignore malformed localStorage
    }
  }, [loginForm]);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const [status, countriesList, cultureGroupList, religionGroupList, raceList] = await Promise.all([
          fetchServerStatus(),
          fetchCountries(),
          fetchContentEntries("cultureGroups"),
          fetchContentEntries("religionGroups"),
          fetchContentEntries("races"),
        ]);
        if (!mounted) {
          return;
        }
        setServerStatus(status.status);
        setCountries(countriesList);
        setCultureGroups(cultureGroupList);
        setReligionGroups(religionGroupList);
        setRaces(raceList);
      } catch {
        if (mounted) {
          setServerStatus("offline");
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    load();
    return () => {
      mounted = false;
    };
  }, []);

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

  useEffect(() => {
    if (!cultureLogoFile) {
      setCultureLogoPreviewUrl(null);
      return;
    }

    const url = URL.createObjectURL(cultureLogoFile);
    setCultureLogoPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [cultureLogoFile]);

  useEffect(() => {
    if (!religionLogoFile) {
      setReligionLogoPreviewUrl(null);
      return;
    }

    const url = URL.createObjectURL(religionLogoFile);
    setReligionLogoPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [religionLogoFile]);

  useEffect(() => {
    if (!loading) {
      setLoadingProgress(100);
      return;
    }

    const timer = setInterval(() => {
      setLoadingProgress((prev) => (prev >= 92 ? prev : prev + 4));
    }, 120);

    return () => clearInterval(timer);
  }, [loading]);

  const selectedCountryId = loginForm.watch("countryId");
  const selectedCountry = countries.find((c) => c.id === selectedCountryId);
  const loginPassword = loginForm.watch("password");
  const registerValues = registerForm.watch();
  const registerPassword = registerForm.watch("password");
  const registerColor = registerForm.watch("countryColor");
  const selectedCultureGroup = cultureGroups.find((entry) => entry.id === registerValues.cultureGroupId) ?? null;
  const selectedReligionGroup = religionGroups.find((entry) => entry.id === registerValues.religionGroupId) ?? null;
  const selectedRace = races.find((entry) => entry.id === registerValues.raceId) ?? null;
  const missingRegistrationFields = getMissingRegistrationFields(registerValues, t);
  const canSubmitRegistration = missingRegistrationFields.length === 0 && !submitting;
  const currentStepIndex = REGISTER_STEPS.findIndex((step) => step.id === registerStep);
  const goToNextRegisterStep = () => {
    const next = REGISTER_STEPS[Math.min(REGISTER_STEPS.length - 1, Math.max(0, currentStepIndex) + 1)];
    if (next) setRegisterStep(next.id);
  };
  const goToPreviousRegisterStep = () => {
    const previous = REGISTER_STEPS[Math.max(0, Math.max(0, currentStepIndex) - 1)];
    if (previous) setRegisterStep(previous.id);
  };

  const passwordChecks = useMemo(() => {
    return {
      length: loginPassword.length >= 8,
      complexity: /[A-Z]/.test(loginPassword) && /\d/.test(loginPassword) && /[^A-Za-z0-9]/.test(loginPassword),
    };
  }, [loginPassword]);

  const registerPasswordChecks = useMemo(() => {
    return {
      length: registerPassword.length >= 8,
      complexity: /[A-Z]/.test(registerPassword) && /\d/.test(registerPassword) && /[^A-Za-z0-9]/.test(registerPassword),
    };
  }, [registerPassword]);

  const submitLogin = loginForm.handleSubmit(async (values) => {
    setSubmitting(true);
    try {
      const result = await login(values);
      const country = countries.find((c) => c.id === result.countryId);
      if (!country) {
        throw new Error("COUNTRY_NOT_FOUND");
      }

      toast.success(t("auth.loginSuccess"));
      try {
        if (values.rememberMe) {
          localStorage.setItem(
            REMEMBER_LOGIN_KEY,
            JSON.stringify({
              countryId: values.countryId,
              password: values.password,
              rememberMe: true,
            }),
          );
        } else {
          localStorage.removeItem(REMEMBER_LOGIN_KEY);
        }
      } catch {
        // ignore storage errors
      }
      onSuccess({
        ...result,
        countryName: country.name,
        countryColor: country.color,
        flagUrl: country.flagUrl,
        crestUrl: country.crestUrl,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "LOGIN_FAILED";
      const [msgCode, lockReasonRaw] = msg.split("__REASON__");
      const lockReasonText = lockReasonRaw ? decodeURIComponent(lockReasonRaw) : "";
      let text = t("auth.serverUnavailable");

      if (msgCode === "INVALID_PASSWORD") {
        text = t("auth.invalidPassword");
      } else if (msgCode === "REGISTRATION_PENDING_APPROVAL") {
        text = t("auth.registrationPendingApproval");
      } else if (msgCode === "ACCOUNT_LOCKED_PERMANENT" || msgCode === "ACCOUNT_LOCKED") {
        text = t("auth.accountLockedPermanent");
      } else if (msgCode.startsWith("ACCOUNT_LOCKED_TURN_")) {
        const turn = msgCode.replace("ACCOUNT_LOCKED_TURN_", "");
        text = t("auth.accountLockedTurn", { turn });
      } else if (msgCode.startsWith("ACCOUNT_LOCKED_TIME_")) {
        const raw = msgCode.replace("ACCOUNT_LOCKED_TIME_", "");
        const when = new Date(raw);
        text = Number.isNaN(when.getTime())
          ? t("auth.accountLockedTime", { time: raw })
          : t("auth.accountLockedTime", { time: when.toLocaleString() });
      }
      toast.error(text, lockReasonText ? { description: t("auth.lockReason", { reason: lockReasonText }) } : undefined);
    } finally {
      setSubmitting(false);
    }
  });

  const submitRegister = registerForm.handleSubmit(async (values) => {
    if (flagFile && !(await isImageWithinRule(flagFile, { maxWidth: 192, maxHeight: 128, ratioWidth: 3, ratioHeight: 2 }))) {
      toast.error(t("auth.flagInvalid"));
      return;
    }

    if (crestFile && !(await isImageWithinRule(crestFile, { maxWidth: 128, maxHeight: 192, ratioWidth: 2, ratioHeight: 3 }))) {
      toast.error(t("auth.crestInvalid"));
      return;
    }
    if (cultureLogoFile && !(await isImageWithinRule(cultureLogoFile, { maxWidth: 128, maxHeight: 192, ratioWidth: 2, ratioHeight: 3 }))) {
      toast.error(t("auth.identityLogoInvalid"));
      return;
    }
    if (religionLogoFile && !(await isImageWithinRule(religionLogoFile, { maxWidth: 128, maxHeight: 192, ratioWidth: 2, ratioHeight: 3 }))) {
      toast.error(t("auth.identityLogoInvalid"));
      return;
    }

    setSubmitting(true);
    try {
      const normalizedColor = colord(values.countryColor).toHex();
      const country = await register({
        countryName: values.countryName,
        countryColor: normalizedColor,
        cultureGroupId: values.cultureGroupId,
        cultureName: values.cultureName,
        cultureColor: colord(values.cultureColor).toHex(),
        religionGroupId: values.religionGroupId,
        religionName: values.religionName,
        religionColor: colord(values.religionColor).toHex(),
        raceId: values.raceId,
        password: values.password,
        flagFile,
        crestFile,
        cultureLogoFile,
        religionLogoFile,
      });
      setCountries((prev) => [...prev, country]);
      setFlagFile(null);
      setCrestFile(null);
      setCultureLogoFile(null);
      setReligionLogoFile(null);
      registerForm.reset({
        countryName: "",
        countryColor: "#4ade80",
        cultureGroupId: "",
        cultureName: "",
        cultureColor: "#4ade80",
        religionGroupId: "",
        religionName: "",
        religionColor: "#a78bfa",
        raceId: "",
        password: "",
        confirmPassword: "",
      });
      if (country.isRegistrationApproved === false) {
        setRegistrationPendingModal({ open: true, countryName: country.name });
        toast.success(t("auth.registrationSent"));
      } else {
        toast.success(t("auth.countryCreated"));
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "REGISTER_FAILED";
      if (msg === "IMAGE_DIMENSIONS_TOO_LARGE") {
        toast.error(t("auth.imageFormatInvalid"));
      } else if (msg === "FILE_TOO_LARGE") {
        toast.error(t("auth.fileTooLarge"));
      } else if (msg === "ONLY_IMAGES") {
        toast.error(t("auth.onlyImages"));
      } else {
        toast.error(t("auth.registrationError"));
      }
    } finally {
      setSubmitting(false);
    }
  });

  return (
    <motion.div
      layout
      transition={{ layout: { duration: 0.28, ease: [0.22, 1, 0.36, 1] } }}
      className={`arc-building-overview-modal arc-auth-modal ${
        authMode === "register" ? "arc-auth-modal--wizard" : ""
      }`}
    >
      <AnimatePresence>
        {registrationPendingModal.open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="arc-auth-pending-backdrop"
          >
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              transition={{ duration: 0.16, ease: "easeOut" }}
              className="arc-building-overview-card arc-building-overview-card--working arc-auth-pending-card"
            >
              <div className="arc-auth-pending-title">
                <ShieldCheck size={15} />
                <span>{t("auth.registrationSent")}</span>
              </div>
              <div className="arc-auth-pending-message">
                {t("auth.registrationSentMessage", { country: registrationPendingModal.countryName })}
              </div>
              <div className="arc-auth-pending-description">{t("auth.registrationPendingDescription")}</div>
              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={() => setRegistrationPendingModal({ open: false, countryName: "" })}
                  className="arc-auth-primary-button"
                >
                  {t("auth.waitButton")}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <header className="arc-building-overview-header">
        <div>
          <div className="arc-building-overview-title arc-auth-title">ARCANORUM</div>
          <p>{t("auth.clientVersion")}</p>
        </div>
        <div className="arc-auth-server-status">
          <Server size={14} />
          <span className={`arc-auth-status-dot ${statusMeta[serverStatus].cls} ${serverStatus === "online" ? "pulse-status" : ""}`} />
          {t(statusMeta[serverStatus].labelKey)}
        </div>
      </header>

      {loading ? (
        <div className="arc-building-overview-body">
          <div className="arc-auth-loading-card">
            <div className="arc-auth-loading-title">
            <LoaderCircle className="animate-spin" size={16} />
            {t("auth.loadingGame")}
            </div>
            <div className="arc-auth-progress-track">
              <div style={{ width: `${loadingProgress}%` }} />
            </div>
            <div className="arc-auth-progress-value">{loadingProgress}%</div>
          </div>
        </div>
      ) : authMode === "login" ? (
        <motion.div layout transition={{ layout: { duration: 0.28, ease: [0.22, 1, 0.36, 1] } }} className="arc-building-overview-body arc-auth-body arc-scrollbar">
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, ease: "easeOut" }}>
              <form onSubmit={submitLogin} className="space-y-4">
                <div>
                  <label className={AUTH_LABEL_CLASS}>{t("auth.country")}</label>
                  <Listbox
                    value={selectedCountryId}
                    onChange={(value: string) => loginForm.setValue("countryId", value, { shouldDirty: true, shouldValidate: true })}
                  >
                    <div className="relative">
                      <Listbox.Button className={`${AUTH_INPUT_CLASS} pr-10 text-left`}>
                        {selectedCountry ? selectedCountry.name : t("auth.selectCountry")}
                      </Listbox.Button>
                      <Listbox.Options className="arc-scrollbar arc-auth-options">
                        <Listbox.Option
                          value=""
                          className={({ active }) => AUTH_OPTION_CLASS(active)}
                        >
                          {({ selected }) => (
                            <>
                              <span className={selected ? "arc-auth-selected-option" : ""}>{t("auth.selectCountry")}</span>
                              {selected && <Check size={14} className="arc-auth-option-check" />}
                            </>
                          )}
                        </Listbox.Option>
                        {countries.map((country) => (
                          <Listbox.Option
                            key={country.id}
                            value={country.id}
                            className={({ active }) => AUTH_OPTION_CLASS(active)}
                          >
                            {({ selected }) => (
                              <>
                                <span className={selected ? "arc-auth-selected-option" : ""}>{country.name}</span>
                                {selected && <Check size={14} className="arc-auth-option-check" />}
                              </>
                            )}
                          </Listbox.Option>
                        ))}
                      </Listbox.Options>
                    </div>
                  </Listbox>
                  <FieldError text={loginForm.formState.errors.countryId?.message} />
                </div>

                <div>
                  <label className={AUTH_LABEL_CLASS}>{t("auth.password")}</label>
                  <input type="password" className={AUTH_INPUT_CLASS} {...loginForm.register("password")} />
                  <FieldError text={loginForm.formState.errors.password?.message} />
                  <div className="mt-2 flex gap-2">
                    <Tooltip
                      content={
                        passwordChecks.length
                          ? t("auth.passwordLengthOk")
                          : t("auth.passwordLengthNeed")
                      }
                    >
                      <span
                        className={`${
                          passwordChecks.length
                            ? AUTH_STATUS_OK_CLASS
                            : AUTH_STATUS_IDLE_CLASS
                        }`}
                        aria-label={t("auth.passwordLengthAria")}
                      >
                        <Ruler size={14} />
                      </span>
                    </Tooltip>
                    <Tooltip
                      content={
                        passwordChecks.complexity
                          ? t("auth.passwordComplexityOk")
                          : t("auth.passwordComplexityLoginNeed")
                      }
                    >
                      <span
                        className={`${
                          passwordChecks.complexity
                            ? AUTH_STATUS_OK_CLASS
                            : AUTH_STATUS_IDLE_CLASS
                        }`}
                        aria-label={t("auth.passwordComplexityAria")}
                      >
                        <Sparkles size={14} />
                      </span>
                    </Tooltip>
                  </div>
                </div>

                <label className="arc-auth-checkbox">
                  <input type="checkbox" className="accent-arc-accent" {...loginForm.register("rememberMe")} />
                  {t("auth.rememberMe")}
                </label>

                <button disabled={submitting} className="arc-auth-primary-button arc-auth-full-button">
                  <ShieldCheck size={15} />
                  {submitting ? t("auth.loginPending") : t("auth.enterGame")}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode("register");
                    setRegisterStep("info");
                  }}
                  className="arc-auth-secondary-button arc-auth-full-button"
                >
                  <UserPlus size={15} />
                  {t("auth.createCountry")}
                </button>
                <button
                  type="button"
                  onClick={onOpenCivilopedia}
                  className="arc-auth-secondary-button arc-auth-full-button"
                >
                  <BookOpen size={15} />
                  {t("auth.knowledge")}
                </button>
              </form>
          </motion.div>
        </motion.div>
      ) : (
        <>
          <div className="arc-auth-tabs arc-auth-tabs--wizard">
            {REGISTER_STEPS.map((step) => (
              <button
                key={step.id}
                type="button"
                onClick={() => setRegisterStep(step.id)}
                className={`arc-auth-tab arc-auth-wizard-tab ${registerStep === step.id ? "arc-auth-tab--selected" : ""}`}
              >
                <span>{t(step.labelKey)}</span>
              </button>
            ))}
          </div>

          <motion.div className="arc-building-overview-body arc-auth-body arc-auth-wizard-body">
            <motion.div
              className="arc-auth-wizard-motion"
              key={registerStep}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.16, ease: "easeOut" }}
            >
              <form onSubmit={submitRegister} className="arc-auth-wizard-form">
                {registerStep === "info" && (
                  <div className="arc-auth-wizard-panel">
                    <div className="arc-auth-panel-title">{t("auth.step.info")}</div>
                <div>
                  <label className={AUTH_LABEL_CLASS}>{t("auth.countryName")}</label>
                  <input className={AUTH_INPUT_CLASS} {...registerForm.register("countryName")} />
                  <FieldError text={registerForm.formState.errors.countryName?.message} />
                </div>

                <ColorPickerField
                  label={t("auth.countryColor")}
                  value={registerColor}
                  onChange={(value) => registerForm.setValue("countryColor", value, { shouldDirty: true, shouldValidate: true })}
                  error={registerForm.formState.errors.countryColor?.message}
                  t={t}
                />

                <div className="arc-auth-upload-grid">
                  <ImageUploadFrame
                    label={t("auth.flag")}
                    file={flagFile}
                    previewUrl={flagPreviewUrl}
                    hint={t("auth.flagHint")}
                    onChange={setFlagFile}
                    onClear={() => setFlagFile(null)}
                    t={t}
                  />
                  <ImageUploadFrame
                    label={t("auth.crest")}
                    file={crestFile}
                    previewUrl={crestPreviewUrl}
                    hint={t("auth.crestHint")}
                    onChange={setCrestFile}
                    onClear={() => setCrestFile(null)}
                    t={t}
                  />
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <label className={AUTH_LABEL_CLASS}>{t("auth.password")}</label>
                    <input type="password" className={AUTH_INPUT_CLASS} {...registerForm.register("password")} />
                    <FieldError text={registerForm.formState.errors.password?.message} />
                    <div className="mt-2 flex gap-2">
                      <Tooltip
                        content={
                          registerPasswordChecks.length
                            ? t("auth.passwordLengthOk")
                            : t("auth.passwordLengthNeed")
                        }
                      >
                        <span
                          className={`${
                            registerPasswordChecks.length
                              ? AUTH_STATUS_OK_CLASS
                              : AUTH_STATUS_IDLE_CLASS
                          }`}
                          aria-label={t("auth.passwordLengthAria")}
                        >
                          <Ruler size={14} />
                        </span>
                      </Tooltip>
                      <Tooltip
                        content={
                          registerPasswordChecks.complexity
                            ? t("auth.passwordComplexityOk")
                            : t("auth.passwordComplexityNeed")
                        }
                      >
                        <span
                          className={`${
                            registerPasswordChecks.complexity
                              ? AUTH_STATUS_OK_CLASS
                              : AUTH_STATUS_IDLE_CLASS
                          }`}
                          aria-label={t("auth.passwordComplexityAria")}
                        >
                          <Sparkles size={14} />
                        </span>
                      </Tooltip>
                    </div>
                  </div>
                  <div>
                    <label className={AUTH_LABEL_CLASS}>{t("auth.repeatPassword")}</label>
                    <input type="password" className={AUTH_INPUT_CLASS} {...registerForm.register("confirmPassword")} />
                    <FieldError text={registerForm.formState.errors.confirmPassword?.message} />
                  </div>
                </div>
                  </div>
                )}

                {registerStep === "culture" && (
                  <div className="arc-auth-wizard-panel">
                    <div className="arc-auth-panel-title">{t("auth.step.culture")}</div>
                    <div className="arc-auth-info-section arc-auth-identity-form">
                      <div className="arc-auth-wizard-fields">
                        <div>
                          <label className={AUTH_LABEL_CLASS}>{t("auth.cultureName")}</label>
                          <input className={AUTH_INPUT_CLASS} {...registerForm.register("cultureName")} />
                          <FieldError text={registerForm.formState.errors.cultureName?.message} />
                        </div>
                        <ColorPickerField
                          label={t("auth.cultureColor")}
                          value={registerValues.cultureColor}
                          onChange={(value) => registerForm.setValue("cultureColor", value, { shouldDirty: true, shouldValidate: true })}
                          error={registerForm.formState.errors.cultureColor?.message}
                          t={t}
                        />
                        <ImageUploadFrame
                          label={t("auth.cultureLogo")}
                          file={cultureLogoFile}
                          previewUrl={cultureLogoPreviewUrl}
                          hint={t("auth.identityLogoHint")}
                          onChange={setCultureLogoFile}
                          onClear={() => setCultureLogoFile(null)}
                          t={t}
                        />
                      </div>
                    </div>
                    <IdentitySelectionPanel
                      entries={cultureGroups}
                      selectedId={registerValues.cultureGroupId}
                      onSelect={(value) => registerForm.setValue("cultureGroupId", value, { shouldDirty: true, shouldValidate: true })}
                      t={t}
                    />
                  </div>
                )}

                {registerStep === "religion" && (
                  <div className="arc-auth-wizard-panel">
                    <div className="arc-auth-panel-title">{t("auth.step.religion")}</div>
                    <div className="arc-auth-info-section arc-auth-identity-form">
                      <div className="arc-auth-wizard-fields">
                        <div>
                          <label className={AUTH_LABEL_CLASS}>{t("auth.religionName")}</label>
                          <input className={AUTH_INPUT_CLASS} {...registerForm.register("religionName")} />
                          <FieldError text={registerForm.formState.errors.religionName?.message} />
                        </div>
                        <ColorPickerField
                          label={t("auth.religionColor")}
                          value={registerValues.religionColor}
                          onChange={(value) => registerForm.setValue("religionColor", value, { shouldDirty: true, shouldValidate: true })}
                          error={registerForm.formState.errors.religionColor?.message}
                          t={t}
                        />
                        <ImageUploadFrame
                          label={t("auth.religionLogo")}
                          file={religionLogoFile}
                          previewUrl={religionLogoPreviewUrl}
                          hint={t("auth.identityLogoHint")}
                          onChange={setReligionLogoFile}
                          onClear={() => setReligionLogoFile(null)}
                          t={t}
                        />
                      </div>
                    </div>
                    <IdentitySelectionPanel
                      entries={religionGroups}
                      selectedId={registerValues.religionGroupId}
                      onSelect={(value) => registerForm.setValue("religionGroupId", value, { shouldDirty: true, shouldValidate: true })}
                      t={t}
                    />
                  </div>
                )}

                {registerStep === "race" && (
                  <div className="arc-auth-wizard-panel">
                    <div className="arc-auth-panel-title">{t("auth.step.race")}</div>
                    <IdentitySelectionPanel
                      entries={races}
                      selectedId={registerValues.raceId}
                      onSelect={(value) => registerForm.setValue("raceId", value, { shouldDirty: true, shouldValidate: true })}
                      t={t}
                    />
                  </div>
                )}

                {registerStep === "confirm" && (
                  <div className="arc-auth-wizard-panel">
                    <div className="arc-auth-panel-title">{t("auth.step.confirm")}</div>
                    <div className="arc-auth-confirm-grid">
                      <div className="arc-auth-preview-card">
                        <div className="arc-auth-preview-title">{t("auth.country")}</div>
                        <div className="arc-auth-confirm-name">{registerValues.countryName || t("auth.missingValue")}</div>
                        <div className="arc-auth-confirm-row">
                          <span>{t("auth.countryColor")}</span>
                          <span className="arc-auth-confirm-swatch" style={{ backgroundColor: colord(registerValues.countryColor).isValid() ? colord(registerValues.countryColor).toHex() : "#111827" }} />
                        </div>
                      </div>
                      <div className="arc-auth-preview-card">
                        <div className="arc-auth-preview-title">{t("auth.identity")}</div>
                        <div className="arc-auth-confirm-identity">
                          {selectedCultureGroup && <IdentityEmblem entry={selectedCultureGroup} t={t} />}
                          <span>{selectedCultureGroup ? getIdentityName(selectedCultureGroup, t) : t("auth.chooseCultureGroup")}</span>
                        </div>
                        <div className="arc-auth-confirm-identity">
                          {selectedReligionGroup && <IdentityEmblem entry={selectedReligionGroup} t={t} />}
                          <span>{selectedReligionGroup ? getIdentityName(selectedReligionGroup, t) : t("auth.chooseReligionGroup")}</span>
                        </div>
                        <div className="arc-auth-confirm-identity">
                          {selectedRace && <IdentityEmblem entry={selectedRace} t={t} />}
                          <span>{selectedRace ? getIdentityName(selectedRace, t) : t("auth.chooseRace")}</span>
                        </div>
                      </div>
                    </div>
                    {missingRegistrationFields.length > 0 ? (
                      <div className="arc-auth-missing-list">
                        <div className="arc-auth-preview-title">{t("auth.confirmMissingTitle")}</div>
                        {missingRegistrationFields.map((field) => (
                          <span key={field}>{field}</span>
                        ))}
                      </div>
                    ) : (
                      <div className="arc-auth-ready-box">{t("auth.confirmReady")}</div>
                    )}
                    <button disabled={!canSubmitRegistration} className="arc-auth-primary-button arc-auth-full-button">
                      <UserPlus size={15} />
                      {submitting ? t("auth.creating") : t("auth.createCountry")}
                    </button>
                  </div>
                )}

                <div className="arc-auth-wizard-actions">
                  <button
                    type="button"
                    onClick={() => {
                      if (registerStep === "info") {
                        setAuthMode("login");
                        return;
                      }
                      goToPreviousRegisterStep();
                    }}
                    className="arc-auth-wizard-action"
                  >
                    <ArrowLeft size={15} />
                    <span>{registerStep === "info" ? t("auth.backToLogin") : t("auth.previousStep")}</span>
                  </button>
                  {registerStep !== "confirm" && (
                    <button type="button" onClick={goToNextRegisterStep} className="arc-auth-wizard-action arc-auth-wizard-action--primary">
                      <span>{t("auth.nextStep")}</span>
                      <ArrowRight size={15} />
                    </button>
                  )}
                </div>
              </form>
            </motion.div>
          </motion.div>
        </>
      )}
    </motion.div>
  );
}
