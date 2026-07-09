import { Listbox } from "@headlessui/react";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
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
  LoaderCircle,
  LogIn,
  Ruler,
  Server,
  ShieldCheck,
  Sparkles,
  Star,
  UserPlus,
  Users,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { fetchContentEntries, fetchCountries, fetchServerStatus, login, register } from "../lib/api";
import type { ContentEntry } from "../lib/api";
import type { Country, ServerStatus } from "@arcanorum/shared";
import { toast } from "sonner";
import { AnimatePresence, motion } from "framer-motion";
import { Tooltip } from "./Tooltip";
import { AppButton } from "./ui/AppButton";
import {
  GameChoiceGrid,
  GameColorPickerButton,
  GameDetailPanel,
  GameImageUploadCard,
  GameTabs,
  GameTextField,
  type GameChoiceItem,
} from "./templates";
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
  onModeChange?: (mode: AuthMode) => void;
};

const statusMeta: Record<ServerStatus, { labelKey: UiTextKey; cls: string }> = {
  online: { labelKey: "auth.serverStatus.online", cls: "bg-[var(--arc-color-success-text)]" },
  offline: { labelKey: "auth.serverStatus.offline", cls: "bg-[var(--arc-color-danger-text)]" },
  maintenance: { labelKey: "auth.serverStatus.maintenance", cls: "bg-[var(--arc-color-warning-top)]" },
};

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
  t,
}: {
  label: string;
  file: File | null;
  previewUrl: string | null;
  hint: string;
  onChange: (file: File | null) => void;
  t: AuthTranslator;
}) {
  return (
    <div className="arc-auth-upload-field">
      <div className="arc-auth-upload-heading">
        <label className={AUTH_LABEL_CLASS}>{label}</label>
      </div>
      <Tooltip content={file ? t("auth.replaceImage") : t("auth.selectImage")}>
        <GameImageUploadCard
          label={label}
          clearLabel={t("auth.clearImage")}
          file={file}
          src={previewUrl}
          onFileChange={onChange}
        />
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
      <label className={AUTH_LABEL_CLASS}>{label}</label>
      <GameColorPickerButton value={safeColor} label={label} onChange={onChange} />
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

function IdentityDetails({
  entry,
  t,
}: {
  entry: ContentEntry | null;
  t: AuthTranslator;
}) {
  if (!entry) {
    return (
      <GameDetailPanel
        title={t("auth.identity")}
        description={t("auth.identitySelectPrompt")}
        sections={[]}
        className="arc-auth-kit-detail"
      />
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
  const bonusRows = modifierEffects.length
    ? modifierEffects.map((effect, index) => {
        const Icon = getModifierIcon(effect.stat);
        return {
          label: t(`modifiers.stat.${effect.stat}`),
          value: formatEffectValue(effect),
          icon: <Icon key={`${effect.stat}:${index}`} size={14} aria-hidden="true" />,
        };
      })
    : [{ label: t("auth.noBonuses"), value: "-", icon: undefined }];
  const populationRows = startingRows.length
    ? startingRows.map((row) => ({
        label: row.label,
        value: row.value,
        icon: <row.icon size={14} aria-hidden="true" />,
      }))
    : [{ label: t("auth.noStartingPopChanges"), value: "-", icon: undefined }];

  return (
    <GameDetailPanel
      title={getIdentityName(entry, t)}
      description={getIdentityDescription(entry, t) || t("auth.identityNoDescription")}
      icon={<IdentityEmblem entry={entry} t={t} size="large" />}
      sections={[
        { title: t("auth.identityBonuses"), rows: bonusRows },
        { title: t("auth.startingPopulation"), rows: populationRows },
      ]}
      className="arc-auth-kit-detail"
    />
  );
}

function buildIdentityChoices(entries: ContentEntry[], t: AuthTranslator): GameChoiceItem[] {
  return entries.map((entry) => {
    const modifierEffects = (entry.modifiers ?? []).flatMap((modifier) => modifier.effects ?? []);
    return {
      id: entry.id,
      title: getIdentityName(entry, t),
      description: getIdentityDescription(entry, t) || t("auth.identityNoDescription"),
      accentColor: entry.color || "var(--arc-color-gold)",
      icon: <IdentityEmblem entry={entry} t={t} />,
      effects: modifierEffects.slice(0, 2).map((effect, index) => {
        const Icon = getModifierIcon(effect.stat);
        return {
          id: `${entry.id}:${effect.stat}:${index}`,
          label: t(`modifiers.stat.${effect.stat}`),
          value: formatEffectValue(effect),
          icon: <Icon size={13} aria-hidden="true" />,
          valueColor: effect.value >= 0 ? "var(--arc-color-success-text)" : "var(--arc-color-danger-text)",
        };
      }),
    };
  });
}

function ImagePreviewBadge({ src, label, fallback }: { src: string | null; label: string; fallback: string }) {
  if (!src) return <span>{fallback}</span>;
  return (
    <span className="arc-auth-confirm-image" aria-label={label}>
      <img src={src} alt="" aria-hidden="true" />
    </span>
  );
}

function SummaryImageSlot({
  src,
  label,
  fallback,
  className = "",
}: {
  src: string | null;
  label: string;
  fallback: string;
  className?: string;
}) {
  return (
    <div className={`arc-auth-summary-asset ${className}`}>
      <div className="arc-auth-summary-asset__label">{label}</div>
      {src ? (
        <img src={src} alt="" aria-hidden="true" />
      ) : (
        <div className="arc-auth-summary-asset__empty">{fallback}</div>
      )}
    </div>
  );
}

function IdentitySummaryTile({
  label,
  entry,
  t,
  fallback,
}: {
  label: string;
  entry: ContentEntry | null;
  t: AuthTranslator;
  fallback: string;
}) {
  return (
    <div className="arc-auth-summary-identity">
      {entry ? (
        <IdentityEmblem entry={entry} t={t} />
      ) : (
        <span className="arc-auth-summary-identity__empty">?</span>
      )}
      <span>{label}</span>
      <strong>{entry ? getIdentityName(entry, t) : fallback}</strong>
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
      <div className="arc-auth-kit-choice-frame">
        <GameChoiceGrid
          choices={buildIdentityChoices(entries, t)}
          selectedId={selectedId}
          onSelect={onSelect}
          selectedLabel={t("templates.selected")}
          ariaLabel={t("auth.identityOptions")}
          className="arc-auth-kit-choice-grid"
        />
      </div>
      <IdentityDetails entry={selectedEntry} t={t} />
    </div>
  );
}

function getFirstMissingRegistrationStep(values: RegisterFormValues): RegisterStep | null {
  if (
    !values.countryName.trim() ||
    !colord(values.countryColor).isValid() ||
    !values.cultureName.trim() ||
    !colord(values.cultureColor).isValid() ||
    !values.religionName.trim() ||
    !colord(values.religionColor).isValid() ||
    values.password.length < 8 ||
    !values.confirmPassword ||
    values.password !== values.confirmPassword
  ) {
    return "info";
  }
  if (!values.cultureGroupId) return "culture";
  if (!values.religionGroupId) return "religion";
  if (!values.raceId) return "race";
  return null;
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

export function AuthPanel({ onSuccess, onOpenCivilopedia, onModeChange }: Props) {
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
  const registerWheelStepAtRef = useRef(0);
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
    onModeChange?.(authMode);
  }, [authMode, onModeChange]);

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
  const firstMissingRegistrationStep = getFirstMissingRegistrationStep(registerValues);
  const currentStepIndex = REGISTER_STEPS.findIndex((step) => step.id === registerStep);
  const goToNextRegisterStep = () => {
    const next = REGISTER_STEPS[Math.min(REGISTER_STEPS.length - 1, Math.max(0, currentStepIndex) + 1)];
    if (next) setRegisterStep(next.id);
  };
  const goToPreviousRegisterStep = () => {
    const previous = REGISTER_STEPS[Math.max(0, Math.max(0, currentStepIndex) - 1)];
    if (previous) setRegisterStep(previous.id);
  };
  const goToFirstMissingRegisterStep = useCallback((values: RegisterFormValues) => {
    const missingStep = getFirstMissingRegistrationStep(values);
    if (!missingStep) return false;
    setRegisterStep(missingStep);
    return true;
  }, []);
  const handleRegisterWizardWheel = useCallback((event: WheelEvent) => {
    if (registrationPendingModal.open) return;
    const delta = Math.abs(event.deltaY) >= Math.abs(event.deltaX) ? event.deltaY : event.deltaX;
    if (delta === 0) return;
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest("input, textarea, select")) return;
    if (target?.closest(".arc-auth-kit-detail, .arc-auth-kit-choice-frame, .arc-auth-kit-choice-grid, .arc-kit-choice-card__effects")) return;
    event.preventDefault();
    const now = Date.now();
    if (now - registerWheelStepAtRef.current < 260) return;
    registerWheelStepAtRef.current = now;
    if (delta > 0) {
      goToNextRegisterStep();
      return;
    }
    goToPreviousRegisterStep();
  }, [goToNextRegisterStep, goToPreviousRegisterStep, registrationPendingModal.open]);

  useEffect(() => {
    if (authMode !== "register") return undefined;
    window.addEventListener("wheel", handleRegisterWizardWheel, { passive: false });
    return () => window.removeEventListener("wheel", handleRegisterWizardWheel);
  }, [authMode, handleRegisterWizardWheel]);

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
    if (goToFirstMissingRegisterStep(values)) {
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
  }, () => {
    goToFirstMissingRegisterStep(registerForm.getValues());
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
                <AppButton
                  type="button"
                  onClick={() => setRegistrationPendingModal({ open: false, countryName: "" })}
                  variant="primary"
                  size="lg"
                  sound="action.confirm"
                >
                  {t("auth.waitButton")}
                </AppButton>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      {authMode === "login" ? (
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
      ) : null}

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

                <AppButton type="submit" disabled={submitting} variant="primary" size="lg" icon={<ShieldCheck size={15} aria-hidden="true" />} className="w-full" sound="action.confirm">
                  {submitting ? t("auth.loginPending") : t("auth.enterGame")}
                </AppButton>
                <AppButton
                  type="button"
                  onClick={() => {
                    setAuthMode("register");
                    setRegisterStep("info");
                  }}
                  variant="secondary"
                  size="lg"
                  icon={<UserPlus size={15} aria-hidden="true" />}
                  className="w-full"
                >
                  {t("auth.createCountry")}
                </AppButton>
                <AppButton
                  type="button"
                  onClick={onOpenCivilopedia}
                  variant="ghost"
                  size="lg"
                  icon={<BookOpen size={15} aria-hidden="true" />}
                  className="w-full"
                >
                  {t("auth.knowledge")}
                </AppButton>
              </form>
          </motion.div>
        </motion.div>
      ) : (
        <>
          <GameTabs
            ariaLabel={t("auth.registrationSteps")}
            activeId={registerStep}
            onChange={(id) => setRegisterStep(id as RegisterStep)}
            className="arc-auth-kit-tabs"
            tabs={REGISTER_STEPS.map((step) => ({ id: step.id, label: t(step.labelKey) }))}
          />

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
                    <div className="arc-auth-info-columns">
                    <section className="arc-auth-info-section arc-auth-kit-section">
                      <h3 className="arc-kit-section-title">{t("auth.country")}</h3>
                      <div className="arc-auth-identity-editor">
                        <GameTextField
                          label={t("auth.countryName")}
                          error={registerForm.formState.errors.countryName?.message}
                          invalid={Boolean(registerForm.formState.errors.countryName)}
                          {...registerForm.register("countryName")}
                        />
                        <ColorPickerField
                          label={t("auth.countryColor")}
                          value={registerColor}
                          onChange={(value) => registerForm.setValue("countryColor", value, { shouldDirty: true, shouldValidate: true })}
                          error={registerForm.formState.errors.countryColor?.message}
                          t={t}
                        />
                        <ImageUploadFrame
                          label={t("auth.flag")}
                          file={flagFile}
                          previewUrl={flagPreviewUrl}
                          hint={t("auth.flagHint")}
                          onChange={setFlagFile}
                          t={t}
                        />
                        <ImageUploadFrame
                          label={t("auth.crest")}
                          file={crestFile}
                          previewUrl={crestPreviewUrl}
                          hint={t("auth.crestHint")}
                          onChange={setCrestFile}
                          t={t}
                        />
                      </div>
                    </section>

                    <section className="arc-auth-info-section arc-auth-kit-section">
                      <h3 className="arc-kit-section-title">{t("auth.step.culture")}</h3>
                      <div className="arc-auth-identity-editor">
                        <GameTextField
                          label={t("auth.cultureName")}
                          error={registerForm.formState.errors.cultureName?.message}
                          invalid={Boolean(registerForm.formState.errors.cultureName)}
                          {...registerForm.register("cultureName")}
                        />
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
                          t={t}
                        />
                      </div>
                    </section>

                    <section className="arc-auth-info-section arc-auth-kit-section">
                      <h3 className="arc-kit-section-title">{t("auth.step.religion")}</h3>
                      <div className="arc-auth-identity-editor">
                        <GameTextField
                          label={t("auth.religionName")}
                          error={registerForm.formState.errors.religionName?.message}
                          invalid={Boolean(registerForm.formState.errors.religionName)}
                          {...registerForm.register("religionName")}
                        />
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
                          t={t}
                        />
                      </div>
                    </section>

                    <section className="arc-auth-info-section arc-auth-kit-section">
                      <h3 className="arc-kit-section-title">{t("auth.access")}</h3>
                      <div className="grid gap-3">
                        <div>
                          <GameTextField
                            type="password"
                            label={t("auth.password")}
                            error={registerForm.formState.errors.password?.message}
                            invalid={Boolean(registerForm.formState.errors.password)}
                            {...registerForm.register("password")}
                          />
                          <div className="mt-2 flex gap-2">
                            <Tooltip content={registerPasswordChecks.length ? t("auth.passwordLengthOk") : t("auth.passwordLengthNeed")}>
                              <span className={`${registerPasswordChecks.length ? AUTH_STATUS_OK_CLASS : AUTH_STATUS_IDLE_CLASS}`} aria-label={t("auth.passwordLengthAria")}>
                                <Ruler size={14} />
                              </span>
                            </Tooltip>
                            <Tooltip content={registerPasswordChecks.complexity ? t("auth.passwordComplexityOk") : t("auth.passwordComplexityNeed")}>
                              <span className={`${registerPasswordChecks.complexity ? AUTH_STATUS_OK_CLASS : AUTH_STATUS_IDLE_CLASS}`} aria-label={t("auth.passwordComplexityAria")}>
                                <Sparkles size={14} />
                              </span>
                            </Tooltip>
                          </div>
                        </div>
                        <GameTextField
                          type="password"
                          label={t("auth.repeatPassword")}
                          error={registerForm.formState.errors.confirmPassword?.message}
                          invalid={Boolean(registerForm.formState.errors.confirmPassword)}
                          {...registerForm.register("confirmPassword")}
                        />
                      </div>
                    </section>
                    </div>
                  </div>
                )}

                {registerStep === "culture" && (
                  <div className="arc-auth-wizard-panel arc-auth-wizard-panel--identity">
                    <div className="arc-auth-panel-title">{t("auth.step.culture")}</div>
                    <IdentitySelectionPanel
                      entries={cultureGroups}
                      selectedId={registerValues.cultureGroupId}
                      onSelect={(value) => registerForm.setValue("cultureGroupId", value, { shouldDirty: true, shouldValidate: true })}
                      t={t}
                    />
                  </div>
                )}

                {registerStep === "religion" && (
                  <div className="arc-auth-wizard-panel arc-auth-wizard-panel--identity">
                    <div className="arc-auth-panel-title">{t("auth.step.religion")}</div>
                    <IdentitySelectionPanel
                      entries={religionGroups}
                      selectedId={registerValues.religionGroupId}
                      onSelect={(value) => registerForm.setValue("religionGroupId", value, { shouldDirty: true, shouldValidate: true })}
                      t={t}
                    />
                  </div>
                )}

                {registerStep === "race" && (
                  <div className="arc-auth-wizard-panel arc-auth-wizard-panel--identity">
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
                    <div className="arc-auth-summary-layout">
                      <section className="arc-auth-summary-copy">
                        <div className="arc-auth-summary-kicker">{t("auth.confirmPreviewTitle")}</div>
                        <h2>{registerValues.countryName || t("auth.missingValue")}</h2>
                        <p>{t("auth.confirmPreviewDescription")}</p>
                        <div className="arc-auth-summary-color-row">
                          <span>{t("auth.countryColor")}</span>
                          <strong>{colord(registerValues.countryColor).isValid() ? colord(registerValues.countryColor).toHex() : t("auth.missingValue")}</strong>
                          <span
                            className="arc-auth-confirm-swatch"
                            style={{ backgroundColor: colord(registerValues.countryColor).isValid() ? colord(registerValues.countryColor).toHex() : "#111827" }}
                          />
                        </div>
                        <div className="arc-auth-summary-info arc-auth-summary-info--left">
                          <div className="arc-auth-summary-info__title">{t("auth.confirmCultureReligion")}</div>
                          <div className="arc-auth-summary-row">
                            <span>{t("auth.cultureName")}</span>
                            <strong>{registerValues.cultureName || t("auth.missingValue")}</strong>
                            <ImagePreviewBadge src={cultureLogoPreviewUrl} label={t("auth.cultureLogo")} fallback={t("auth.noFileSelected")} />
                          </div>
                          <div className="arc-auth-summary-row">
                            <span>{t("auth.step.culture")}</span>
                            <strong>{selectedCultureGroup ? getIdentityName(selectedCultureGroup, t) : t("auth.chooseCultureGroup")}</strong>
                            {selectedCultureGroup ? <IdentityEmblem entry={selectedCultureGroup} t={t} /> : <span />}
                          </div>
                          <div className="arc-auth-summary-row">
                            <span>{t("auth.religionName")}</span>
                            <strong>{registerValues.religionName || t("auth.missingValue")}</strong>
                            <ImagePreviewBadge src={religionLogoPreviewUrl} label={t("auth.religionLogo")} fallback={t("auth.noFileSelected")} />
                          </div>
                          <div className="arc-auth-summary-row">
                            <span>{t("auth.step.religion")}</span>
                            <strong>{selectedReligionGroup ? getIdentityName(selectedReligionGroup, t) : t("auth.chooseReligionGroup")}</strong>
                            {selectedReligionGroup ? <IdentityEmblem entry={selectedReligionGroup} t={t} /> : <span />}
                          </div>
                        </div>
                      </section>
                      <aside className="arc-auth-summary-preview" aria-label={t("auth.confirmPreviewTitle")}>
                        <div className="arc-auth-summary-assets">
                          <SummaryImageSlot src={flagPreviewUrl} label={t("auth.flag")} fallback={t("auth.noFileSelected")} className="arc-auth-summary-asset--flag" />
                          <SummaryImageSlot src={crestPreviewUrl} label={t("auth.crest")} fallback={t("auth.noFileSelected")} className="arc-auth-summary-asset--crest" />
                        </div>
                        <div className="arc-auth-summary-identity-grid">
                          <IdentitySummaryTile label={t("auth.step.culture")} entry={selectedCultureGroup} t={t} fallback={t("auth.chooseCultureGroup")} />
                          <IdentitySummaryTile label={t("auth.step.religion")} entry={selectedReligionGroup} t={t} fallback={t("auth.chooseReligionGroup")} />
                          <IdentitySummaryTile label={t("auth.step.race")} entry={selectedRace} t={t} fallback={t("auth.chooseRace")} />
                        </div>
                      </aside>
                    </div>
                    {!firstMissingRegistrationStep ? (
                      <div className="arc-auth-ready-box">{t("auth.confirmReady")}</div>
                    ) : null}
                  </div>
                )}

                <div className="arc-auth-wizard-actions">
                  <AppButton
                    type="button"
                    onClick={() => {
                      if (registerStep === "info") {
                        setAuthMode("login");
                        return;
                      }
                      goToPreviousRegisterStep();
                    }}
                    variant="ghost"
                    size="lg"
                    icon={<ArrowLeft size={15} aria-hidden="true" />}
                  >
                    <span>{registerStep === "info" ? t("auth.backToLogin") : t("auth.previousStep")}</span>
                  </AppButton>
                  {registerStep !== "confirm" && (
                    <AppButton type="button" onClick={goToNextRegisterStep} variant="primary" size="lg" icon={<ArrowRight size={15} aria-hidden="true" />}>
                      <span>{t("auth.nextStep")}</span>
                    </AppButton>
                  )}
                  {registerStep === "confirm" ? (
                    <AppButton type="submit" disabled={submitting} variant="primary" size="lg" icon={<UserPlus size={15} aria-hidden="true" />} sound="action.confirm">
                      {submitting ? t("auth.creating") : t("auth.createCountry")}
                    </AppButton>
                  ) : null}
                </div>
              </form>
            </motion.div>
          </motion.div>
        </>
      )}
    </motion.div>
  );
}
