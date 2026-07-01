import { Listbox, Tab } from "@headlessui/react";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { colord } from "colord";
import { BookOpen, Check, LoaderCircle, LogIn, Palette, Ruler, Server, ShieldCheck, Sparkles, Upload, UserPlus } from "lucide-react";
import { fetchCountries, fetchServerStatus, login, register } from "../lib/api";
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
  password: string;
  confirmPassword: string;
};

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

function FieldError({ text }: { text?: string }) {
  if (!text) {
    return null;
  }

  return <p className="arc-auth-error">{text}</p>;
}

function FileField({
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
      <label className={AUTH_LABEL_CLASS}>{label}</label>
      <label className="arc-auth-file-field">
        <Upload size={15} className="text-[var(--arc-color-gold)]" />
        <span className="truncate">{file ? file.name : selectLabel}</span>
        <input
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => onChange(event.target.files?.[0] ?? null)}
        />
      </label>
      <p className="arc-auth-hint">{hint}</p>
    </div>
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
        }),
    [t],
  );
  const [countries, setCountries] = useState<Country[]>([]);
  const [serverStatus, setServerStatus] = useState<ServerStatus>("offline");
  const [loading, setLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(8);
  const [submitting, setSubmitting] = useState(false);
  const [flagFile, setFlagFile] = useState<File | null>(null);
  const [crestFile, setCrestFile] = useState<File | null>(null);
  const [flagPreviewUrl, setFlagPreviewUrl] = useState<string | null>(null);
  const [crestPreviewUrl, setCrestPreviewUrl] = useState<string | null>(null);
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
    defaultValues: { countryName: "", countryColor: "#4ade80", password: "", confirmPassword: "" },
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
        const [status, countriesList] = await Promise.all([fetchServerStatus(), fetchCountries()]);
        if (!mounted) {
          return;
        }
        setServerStatus(status.status);
        setCountries(countriesList);
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
  const registerPassword = registerForm.watch("password");
  const registerColor = registerForm.watch("countryColor");

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

    setSubmitting(true);
    try {
      const normalizedColor = colord(values.countryColor).toHex();
      const country = await register({
        countryName: values.countryName,
        countryColor: normalizedColor,
        password: values.password,
        flagFile,
        crestFile,
      });
      setCountries((prev) => [...prev, country]);
      setFlagFile(null);
      setCrestFile(null);
      registerForm.reset({ countryName: "", countryColor: "#4ade80", password: "", confirmPassword: "" });
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
    <motion.div layout transition={{ layout: { duration: 0.28, ease: [0.22, 1, 0.36, 1] } }} className="arc-building-overview-modal arc-auth-modal">
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
      ) : (
        <Tab.Group>
          <Tab.List className="arc-auth-tabs">
            <Tab
              className={({ selected }) =>
                `arc-auth-tab ${selected ? "arc-auth-tab--selected" : ""}`
              }
            >
              <LogIn size={15} />
              {t("auth.login")}
            </Tab>
            <Tab
              className={({ selected }) =>
                `arc-auth-tab ${selected ? "arc-auth-tab--selected" : ""}`
              }
            >
              <UserPlus size={15} />
              {t("auth.register")}
            </Tab>
          </Tab.List>

          <motion.div layout transition={{ layout: { duration: 0.28, ease: [0.22, 1, 0.36, 1] } }} className="arc-building-overview-body arc-auth-body arc-scrollbar">
            <Tab.Panels>
            <Tab.Panel>
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
                  onClick={onOpenCivilopedia}
                  className="arc-auth-secondary-button arc-auth-full-button"
                >
                  <BookOpen size={15} />
                  {t("auth.knowledge")}
                </button>
              </form>
              </motion.div>
            </Tab.Panel>

            <Tab.Panel>
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, ease: "easeOut" }}>
              <form onSubmit={submitRegister} className="space-y-4">
                <div>
                  <label className={AUTH_LABEL_CLASS}>{t("auth.countryName")}</label>
                  <input className={AUTH_INPUT_CLASS} {...registerForm.register("countryName")} />
                  <FieldError text={registerForm.formState.errors.countryName?.message} />
                </div>

                <div>
                  <label className="arc-auth-label arc-auth-label-row">
                    <Palette size={13} /> {t("auth.countryColor")}
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={colord(registerColor).isValid() ? colord(registerColor).toHex() : "#4ade80"}
                      onChange={(e) => registerForm.setValue("countryColor", e.target.value, { shouldDirty: true, shouldValidate: true })}
                      className="arc-auth-color-picker"
                    />
                    <input
                      className={AUTH_INPUT_CLASS}
                      placeholder="#4ade80"
                      {...registerForm.register("countryColor")}
                    />
                    <span
                      className="arc-auth-color-preview"
                      style={{ backgroundColor: colord(registerColor).isValid() ? colord(registerColor).toHex() : "#111827" }}
                    />
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {presetColors.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => registerForm.setValue("countryColor", color, { shouldDirty: true, shouldValidate: true })}
                        className="arc-auth-color-preset"
                        style={{ backgroundColor: color }}
                        aria-label={t("auth.presetColor", { color })}
                      />
                    ))}
                  </div>
                  <FieldError text={registerForm.formState.errors.countryColor?.message} />
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <FileField
                    label={t("auth.flag")}
                    file={flagFile}
                    hint={t("auth.flagHint")}
                    selectLabel={t("auth.selectImage")}
                    onChange={setFlagFile}
                  />
                  <FileField
                    label={t("auth.crest")}
                    file={crestFile}
                    hint={t("auth.crestHint")}
                    selectLabel={t("auth.selectImage")}
                    onChange={setCrestFile}
                  />
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="arc-auth-preview-card">
                    <div className="arc-auth-preview-title">{t("auth.flagPreview")}</div>
                    <div className="arc-auth-preview-frame">
                      {flagPreviewUrl ? (
                        <img src={flagPreviewUrl} alt="flag preview" className="h-full w-full object-contain p-1" />
                      ) : (
                        <div className="arc-auth-preview-empty">{t("auth.noFileSelected")}</div>
                      )}
                    </div>
                  </div>
                  <div className="arc-auth-preview-card">
                    <div className="arc-auth-preview-title">{t("auth.crestPreview")}</div>
                    <div className="arc-auth-preview-frame">
                      {crestPreviewUrl ? (
                        <img src={crestPreviewUrl} alt="crest preview" className="h-full w-full object-contain p-1" />
                      ) : (
                        <div className="arc-auth-preview-empty">{t("auth.noFileSelected")}</div>
                      )}
                    </div>
                  </div>
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

                <button disabled={submitting} className="arc-auth-primary-button arc-auth-full-button">
                  <UserPlus size={15} />
                  {submitting ? t("auth.creating") : t("auth.createCountry")}
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
            </Tab.Panel>
          </Tab.Panels>
          </motion.div>
        </Tab.Group>
      )}
    </motion.div>
  );
}
