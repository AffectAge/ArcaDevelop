import { BookOpen, FlaskConical, Landmark, Coins, CircleDollarSign, ListChecks, LogOut, ShieldAlert, SkipForward, SlidersHorizontal, Cog, Flag, Sliders, Clock3, Palette, Hammer, Users, type LucideIcon } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

type Resources = {
  culture: number;
  science: number;
  religion: number;
  colonization: number;
  construction: number;
  ducats: number;
  gold: number;
};

type Props = {
  countryName: string;
  flagUrl?: string | null;
  crestUrl?: string | null;
  turnId: number;
  resources: Resources;
  populationTotal?: number;
  populationBirths?: number;
  populationDeaths?: number;
  populationNetGrowth?: number;
  populationIconUrl?: string | null;
  onOpenTurnStatus: () => void;
  onNextTurn: () => void;
  onLogout: () => void;
  isAdmin?: boolean;
  onAdminForceResolve?: () => void;
  onOpenAdminPanel?: () => void;
  onOpenContentPanel?: () => void;
  onOpenGameSettings?: () => void;
  onOpenCountryCustomization?: () => void;
  onOpenClientSettings?: () => void;
  onOpenCivilopedia?: () => void;
  resourceIconUrls?: Partial<Record<(typeof cards)[number]["key"], string | null>>;
  resourceGrowthByTurn?: Partial<Record<(typeof cards)[number]["key"], number>>;
  resourceExpenseByTurn?: Partial<Record<(typeof cards)[number]["key"], number>>;
  colonizationLimit?: { active: number; max: number } | null;
  countryDetails?: { provinceCount: number; totalAreaKm2: number } | null;
  turnTimer?: { enabled: boolean; secondsPerTurn: number; startedAtMs: number | null } | null;
};

const cards = [
  { key: "culture", label: "Культура", icon: BookOpen, tip: "Очки культуры для развития традиций" },
  { key: "science", label: "Наука", icon: FlaskConical, tip: "Очки науки ускоряют исследования" },
  { key: "religion", label: "Религия", icon: Landmark, tip: "Религия влияет на стабильность и миссии" },
  { key: "colonization", label: "Колонизация", icon: Flag, tip: "Очки колонизации за ход" },
  { key: "construction", label: "Строительство", icon: Hammer, tip: "Очки строительства для производственных приказов" },
  { key: "ducats", label: "Дукаты", icon: Coins, tip: "Планировочный бюджет текущего хода" },
  { key: "gold", label: "Золото", icon: CircleDollarSign, tip: "Госказна для больших проектов" },
] as const;

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
        scaled >= 100 ? Math.floor(scaled).toString() : scaled >= 10 ? scaled.toFixed(1).replace(/\.0$/, "") : scaled.toFixed(2).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1");
      return `${sign}${text}${unit.s}`;
    }
  }

  return `${sign}${Math.floor(abs)}`;
}

function formatSignedCompact(value: number): string {
  return value >= 0 ? `+${formatCompact(value)}` : formatCompact(value);
}

function formatPercent(value: number): string {
  if (!Number.isFinite(value)) return "0%";
  const abs = Math.abs(value);
  const digits = abs >= 10 ? 1 : 2;
  return `${value.toFixed(digits).replace(/\.0+$/, "").replace(/(\.\d)0$/, "$1")}%`;
}

function formatAreaKm2(value: number): string {
  return `${new Intl.NumberFormat("ru-RU").format(Math.max(0, Math.round(value)))} км²`;
}

function formatCountdown(secondsLeft: number): string {
  const sec = Math.max(0, Math.floor(secondsLeft));
  const days = Math.floor(sec / 86_400);
  const hours = Math.floor((sec % 86_400) / 3_600);
  const minutes = Math.floor((sec % 3_600) / 60);
  const seconds = sec % 60;
  if (days > 0) {
    return `${days}д ${hours}ч ${minutes}м ${seconds}с`;
  }
  if (hours > 0) {
    return `${hours}ч ${minutes}м ${seconds}с`;
  }
  return `${minutes}м ${seconds}с`;
}

type TopIconActionButtonProps = {
  label: string;
  onClick?: () => void;
  icon: LucideIcon;
  variant?: "default" | "admin";
};

function TopIconActionButton({ label, onClick, icon: Icon, variant = "default" }: TopIconActionButtonProps) {
  const variantClass =
    variant === "admin"
      ? "border-[var(--arc-color-danger-border)] bg-gradient-to-b from-[var(--arc-color-danger-top)] to-[var(--arc-color-danger-bottom)] text-[var(--arc-color-danger-text)] hover:brightness-110"
      : "arc-hud-button";

  return (
    <button
      onClick={onClick}
      className={`group inline-flex h-10 w-10 items-center justify-start overflow-hidden rounded-lg px-3 transition-[width,color,background-color,border-color,filter] duration-150 hover:w-[170px] ${variantClass}`}
      aria-label={label}
      type="button"
    >
      <Icon size={16} className="shrink-0" />
      <span className="ml-2 inline-flex max-w-0 items-center gap-2 overflow-hidden whitespace-nowrap text-xs font-medium opacity-0 transition-all duration-150 group-hover:max-w-[150px] group-hover:opacity-100">
        <span>{label}</span>
      </span>
    </button>
  );
}

export function TopBar({
  countryName,
  flagUrl,
  crestUrl,
  turnId,
  resources,
  populationTotal = 0,
  populationBirths = 0,
  populationDeaths = 0,
  populationNetGrowth = 0,
  populationIconUrl,
  onOpenTurnStatus,
  onNextTurn,
  onLogout,
  isAdmin = false,
  onAdminForceResolve,
  onOpenAdminPanel,
  onOpenContentPanel,
  onOpenGameSettings,
  onOpenCountryCustomization,
  onOpenClientSettings,
  onOpenCivilopedia,
  resourceIconUrls,
  resourceGrowthByTurn,
  resourceExpenseByTurn,
  colonizationLimit,
  countryDetails,
  turnTimer,
}: Props) {
  const hoverOpenTimerRef = useRef<number | null>(null);
  const countryHoverTimerRef = useRef<number | null>(null);
  const populationHoverTimerRef = useRef<number | null>(null);
  const [hoveredResource, setHoveredResource] = useState<(typeof cards)[number]["key"] | null>(null);
  const [countryHovered, setCountryHovered] = useState(false);
  const [populationHovered, setPopulationHovered] = useState(false);
  const [timerNowMs, setTimerNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (!turnTimer?.enabled || !turnTimer.startedAtMs) return;
    const id = window.setInterval(() => setTimerNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [turnTimer?.enabled, turnTimer?.startedAtMs]);

  useEffect(() => {
    return () => {
      if (hoverOpenTimerRef.current !== null) {
        window.clearTimeout(hoverOpenTimerRef.current);
      }
      if (countryHoverTimerRef.current !== null) {
        window.clearTimeout(countryHoverTimerRef.current);
      }
      if (populationHoverTimerRef.current !== null) {
        window.clearTimeout(populationHoverTimerRef.current);
      }
    };
  }, []);

  const clearHoverTimer = () => {
    if (hoverOpenTimerRef.current !== null) {
      window.clearTimeout(hoverOpenTimerRef.current);
      hoverOpenTimerRef.current = null;
    }
  };

  const scheduleHoverOpen = (key: (typeof cards)[number]["key"]) => {
    clearHoverTimer();
    hoverOpenTimerRef.current = window.setTimeout(() => {
      setHoveredResource(key);
      hoverOpenTimerRef.current = null;
    }, 120);
  };

  const closeHover = (key: (typeof cards)[number]["key"]) => {
    clearHoverTimer();
    setHoveredResource((prev) => (prev === key ? null : prev));
  };

  const scheduleCountryHoverOpen = () => {
    if (countryHoverTimerRef.current !== null) {
      window.clearTimeout(countryHoverTimerRef.current);
    }
    countryHoverTimerRef.current = window.setTimeout(() => {
      setCountryHovered(true);
      countryHoverTimerRef.current = null;
    }, 120);
  };

  const closeCountryHover = () => {
    if (countryHoverTimerRef.current !== null) {
      window.clearTimeout(countryHoverTimerRef.current);
      countryHoverTimerRef.current = null;
    }
    setCountryHovered(false);
  };

  const schedulePopulationHoverOpen = () => {
    if (populationHoverTimerRef.current !== null) {
      window.clearTimeout(populationHoverTimerRef.current);
    }
    populationHoverTimerRef.current = window.setTimeout(() => {
      setPopulationHovered(true);
      populationHoverTimerRef.current = null;
    }, 120);
  };

  const closePopulationHover = () => {
    if (populationHoverTimerRef.current !== null) {
      window.clearTimeout(populationHoverTimerRef.current);
      populationHoverTimerRef.current = null;
    }
    setPopulationHovered(false);
  };

  const turnTimerRemainingSec =
    turnTimer?.enabled && turnTimer.startedAtMs
      ? Math.max(0, turnTimer.secondsPerTurn - Math.floor((timerNowMs - turnTimer.startedAtMs) / 1000))
      : null;
  const turnTimerColorClass =
    turnTimerRemainingSec === null
      ? "text-[var(--arc-color-text-soft)]"
      : turnTimerRemainingSec <= 15
        ? "text-[var(--arc-color-danger-text)]"
        : turnTimerRemainingSec <= 60
          ? "text-[var(--arc-color-warning)]"
          : "text-[var(--arc-color-success)]";
  const populationNetColorClass =
    populationNetGrowth > 0
      ? "text-[var(--arc-color-success)]"
      : populationNetGrowth < 0
        ? "text-[var(--arc-color-danger-text)]"
        : "text-[var(--arc-color-text-soft)]";
  const populationBirthRatePct = populationTotal > 0 ? (populationBirths / populationTotal) * 100 : 0;
  const populationDeathRatePct = populationTotal > 0 ? (populationDeaths / populationTotal) * 100 : 0;

  return (
    <header className="arc-hud-panel arc-hud-panel--overflow-visible pointer-events-auto absolute left-4 right-4 top-3 z-[112] rounded-xl px-4 py-3">
      <div className="arc-hud-content grid items-center gap-3 md:grid-cols-[1fr_auto_1fr]">
        <div className="relative z-30 w-fit" onMouseEnter={scheduleCountryHoverOpen} onMouseLeave={closeCountryHover}>
          <button
            type="button"
            onClick={onOpenCountryCustomization}
            className="flex items-center gap-3 rounded-lg px-1 py-1 text-left text-[var(--arc-color-text)] transition hover:bg-[var(--arc-overlay-30)]"
            aria-expanded={countryHovered}
            aria-label="Открыть детали страны"
          >
            <img src={flagUrl || "/placeholder-flag.svg"} alt="flag" className="h-8 w-12 rounded object-cover" />
            <img src={crestUrl || "/placeholder-crest.svg"} alt="crest" className="h-8 w-[1.333rem] rounded object-cover" />
            <div className="font-display text-xl tracking-wide">{countryName}</div>
          </button>
          <AnimatePresence>
            {countryHovered && (
              <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.98 }}
                animate={{ opacity: 1, y: 6, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.98 }}
                transition={{ duration: 0.16, ease: "easeOut" }}
                className="absolute left-0 top-full z-50 mt-1 min-w-[240px] rounded-xl"
              >
                <div className="arc-hud-panel rounded-xl p-3 text-xs">
                  <div className="arc-hud-content mb-2 flex items-center gap-2 text-[var(--arc-color-text)]">
                    <img src={flagUrl || "/placeholder-flag.svg"} alt="" className="h-4 w-6 rounded object-cover" />
                    <span className="font-semibold">{countryName}</span>
                  </div>
                  <div className="arc-hud-content mb-2 text-[11px] text-[var(--arc-color-text-soft)]">Детали страны и её владений</div>
                  <div className="arc-hud-content space-y-1 text-[var(--arc-color-text-soft)]">
                    <div className="flex items-center justify-between gap-3">
                      <span>Провинций под контролем</span>
                      <span className="text-[var(--arc-color-text)]">{countryDetails?.provinceCount ?? 0}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span>Общая площадь</span>
                      <span className="text-[var(--arc-color-text)]">{formatAreaKm2(countryDetails?.totalAreaKm2 ?? 0)}</span>
                    </div>
                    <div className="mt-1 flex items-center justify-between gap-3 border-t border-[var(--arc-color-brown)] pt-1">
                      <span>Текущий ход</span>
                      <span className="text-[var(--arc-color-gold)]">#{turnId}</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2">
          <div className="relative" onMouseEnter={schedulePopulationHoverOpen} onMouseLeave={closePopulationHover}>
            <button
              type="button"
              className="arc-hud-chip flex items-center gap-1 rounded-lg px-2 py-1 text-xs transition hover:border-[var(--arc-color-gold)]"
              aria-expanded={populationHovered}
              aria-label={`Население: ${formatCompact(populationTotal)}, прирост ${formatSignedCompact(populationNetGrowth)}`}
            >
              {populationIconUrl ? (
                <img src={populationIconUrl} alt="" className="h-[18px] w-[18px] rounded-sm object-contain" />
              ) : (
                <Users size={17} className="text-[var(--arc-color-gold)]" />
              )}
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.strong
                  key={`population-total-${populationTotal}`}
                  initial={{ opacity: 0, y: 4, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.97 }}
                  transition={{ duration: 0.16, ease: "easeOut" }}
                >
                  {formatCompact(populationTotal)}
                </motion.strong>
              </AnimatePresence>
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.span
                  key={`population-net-${populationNetGrowth}`}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.16, ease: "easeOut" }}
                  className={populationNetColorClass}
                >
                  {formatSignedCompact(populationNetGrowth)}
                </motion.span>
              </AnimatePresence>
            </button>
            <AnimatePresence>
              {populationHovered && (
                <motion.div
                  initial={{ opacity: 0, y: -8, scale: 0.98 }}
                  animate={{ opacity: 1, y: 6, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.98 }}
                  transition={{ duration: 0.16, ease: "easeOut" }}
                  className="absolute left-0 top-full z-20 mt-1 min-w-[220px] rounded-xl"
                >
                  <div className="arc-hud-panel rounded-xl p-3 text-xs">
                    <div className="arc-hud-content mb-2 flex items-center gap-2 text-[var(--arc-color-text)]">
                      {populationIconUrl ? (
                        <img src={populationIconUrl} alt="" className="h-4 w-4 rounded-sm object-contain" />
                      ) : (
                        <Users size={14} className="text-[var(--arc-color-gold)]" />
                      )}
                      <span className="font-semibold">Население</span>
                    </div>
                    <div className="arc-hud-content mb-2 text-[11px] text-[var(--arc-color-text-soft)]">
                      Общее население, рождаемость и смертность за последний ход
                    </div>
                    <div className="arc-hud-content space-y-1 text-[var(--arc-color-text-soft)]">
                      <div className="flex items-center justify-between gap-3">
                        <span>Всего жителей</span>
                        <span className="text-[var(--arc-color-text)]">{formatCompact(populationTotal)}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span>Рождаемость</span>
                        <span className="text-[var(--arc-color-success)]">
                          +{formatCompact(populationBirths)} · {formatPercent(populationBirthRatePct)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span>Смертность</span>
                        <span className="text-[var(--arc-color-danger-text)]">
                          -{formatCompact(populationDeaths)} · {formatPercent(populationDeathRatePct)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span>Чистый прирост</span>
                        <span className={populationNetColorClass}>{formatSignedCompact(populationNetGrowth)}</span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          {cards.map((card) => {
            const Icon = card.icon;
            const customIconUrl = resourceIconUrls?.[card.key] ?? null;
            const growth = Math.max(0, Math.floor(resourceGrowthByTurn?.[card.key] ?? 0));
            const expense = Math.max(0, Math.floor(resourceExpenseByTurn?.[card.key] ?? 0));
            const net = growth - expense;
            const netColorClass =
              net > 0 ? "text-[var(--arc-color-success)]" : net < 0 ? "text-[var(--arc-color-danger-text)]" : "text-[var(--arc-color-text-soft)]";
            const netDetailColorClass = net > 0 ? "text-[var(--arc-color-success)]" : net < 0 ? "text-[var(--arc-color-danger-text)]" : "text-[var(--arc-color-text)]";
            return (
              <div
                key={card.key}
                className="relative"
                onMouseEnter={() => scheduleHoverOpen(card.key)}
                onMouseLeave={() => closeHover(card.key)}
              >
                  <button
                    type="button"
                    className="arc-hud-chip flex items-center gap-1 rounded-lg px-2 py-1 text-xs transition hover:border-[var(--arc-color-gold)]"
                    aria-expanded={hoveredResource === card.key}
                    aria-label={`${card.label}: открыть детали`}
                  >
                    {customIconUrl ? (
                      <img src={customIconUrl} alt="" className="h-[18px] w-[18px] rounded-sm object-contain" />
                    ) : (
                      <Icon size={17} className="text-[var(--arc-color-gold)]" />
                    )}
                    <AnimatePresence mode="popLayout" initial={false}>
                      <motion.strong
                        key={`${card.key}-value-${resources[card.key]}`}
                        initial={{ opacity: 0, y: 4, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -4, scale: 0.97 }}
                        transition={{ duration: 0.16, ease: "easeOut" }}
                      >
                        {formatCompact(resources[card.key])}
                      </motion.strong>
                    </AnimatePresence>
                    <AnimatePresence mode="popLayout" initial={false}>
                      <motion.span
                        key={`${card.key}-deltas-${growth}-${expense}`}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.16, ease: "easeOut" }}
                        className="inline-flex items-center"
                      >
                        <span className={netColorClass}>
                          {net >= 0 ? `+${formatCompact(net)}` : formatCompact(net)}
                        </span>
                      </motion.span>
                    </AnimatePresence>
                  </button>
                  <AnimatePresence>
                    {hoveredResource === card.key && (
                      <motion.div
                        initial={{ opacity: 0, y: -8, scale: 0.98 }}
                        animate={{ opacity: 1, y: 6, scale: 1 }}
                        exit={{ opacity: 0, y: -6, scale: 0.98 }}
                        transition={{ duration: 0.16, ease: "easeOut" }}
                        className="absolute left-0 top-full z-20 mt-1 min-w-[220px] rounded-xl"
                      >
                        <div className="arc-hud-panel rounded-xl p-3 text-xs">
                          <div className="arc-hud-content mb-2 flex items-center gap-2 text-[var(--arc-color-text)]">
                            {customIconUrl ? (
                              <img src={customIconUrl} alt="" className="h-4 w-4 rounded-sm object-contain" />
                            ) : (
                              <Icon size={14} className="text-[var(--arc-color-gold)]" />
                            )}
                            <span className="font-semibold">{card.label}</span>
                          </div>
                          <div className="arc-hud-content mb-2 text-[11px] text-[var(--arc-color-text-soft)]">{card.tip}</div>
                          <div className="arc-hud-content space-y-1 text-[var(--arc-color-text-soft)]">
                            <div className="flex items-center justify-between gap-3">
                              <span>Текущее значение</span>
                              <span className="text-[var(--arc-color-text)]">{formatCompact(resources[card.key])}</span>
                            </div>
                            <div className="flex items-center justify-between gap-3">
                              <span>Прирост за ход</span>
                              <span className="text-[var(--arc-color-success)]">+{formatCompact(growth)}</span>
                            </div>
                            <div className="flex items-center justify-between gap-3">
                              <span>Расход за ход</span>
                              <span className="text-[var(--arc-color-danger-text)]">-{formatCompact(expense)}</span>
                            </div>
                            <div className="mt-1 flex items-center justify-between gap-3 border-t border-[var(--arc-color-brown)] pt-1">
                              <span>Итог за ход</span>
                              <span className={netDetailColorClass}>
                                {net >= 0 ? `+${formatCompact(net)}` : formatCompact(net)}
                              </span>
                            </div>
                            {card.key === "colonization" && colonizationLimit && (
                              <div className="mt-1 flex items-center justify-between gap-3 border-t border-[var(--arc-color-brown)] pt-1">
                                <span>Лимит колонизаций</span>
                                <span
                                  className={
                                    colonizationLimit.active >= colonizationLimit.max
                                      ? "text-[var(--arc-color-danger-text)]"
                                      : colonizationLimit.active > 0
                                        ? "text-[var(--arc-color-warning)]"
                                        : "text-[var(--arc-color-success)]"
                                  }
                                >
                                  {colonizationLimit.active} / {colonizationLimit.max}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
              </div>
            );
          })}
        </div>

        <div className="flex justify-end gap-2">
          <TopIconActionButton label="Хранилище знаний" onClick={onOpenCivilopedia} icon={BookOpen} />
          <TopIconActionButton label="Настройки клиента" onClick={onOpenClientSettings} icon={Sliders} />

          {isAdmin && <TopIconActionButton label="Панель администратора" onClick={onOpenAdminPanel} icon={SlidersHorizontal} variant="admin" />}
          {isAdmin && <TopIconActionButton label="Панель контента" onClick={onOpenContentPanel} icon={Palette} variant="admin" />}
          {isAdmin && <TopIconActionButton label="Настройки игры" onClick={onOpenGameSettings} icon={Cog} variant="admin" />}
          {isAdmin && <TopIconActionButton label="Админ: форс-резолв" onClick={onAdminForceResolve} icon={ShieldAlert} variant="admin" />}

          <TopIconActionButton label="Выход" onClick={onLogout} icon={LogOut} />
          <TopIconActionButton label="Статусы стран" onClick={onOpenTurnStatus} icon={ListChecks} />

          <button
            onClick={onNextTurn}
            className={`group inline-flex h-10 items-center justify-start overflow-hidden rounded-lg border border-[var(--arc-color-primary-border)] bg-gradient-to-b from-[var(--arc-color-primary-top)] to-[var(--arc-color-primary-bottom)] text-[var(--arc-color-text)] shadow-[var(--arc-shadow-inset-button)] transition-[width,filter] hover:brightness-110 ${
              turnTimer?.enabled && turnTimerRemainingSec !== null ? "gap-2 px-3" : "w-10 px-3 hover:w-[190px]"
            }`}
            aria-label={`Следующий ход #${turnId}`}
            type="button"
          >
            <SkipForward size={16} className="shrink-0" />
            {turnTimer?.enabled && turnTimerRemainingSec !== null ? (
              <span className="inline-flex items-center gap-1 text-xs font-semibold tabular-nums">
                <Clock3 size={13} className="text-[var(--arc-color-text-soft)]" />
                <span className={turnTimerColorClass}>{formatCountdown(turnTimerRemainingSec)}</span>
              </span>
            ) : (
              <span className="ml-2 max-w-0 overflow-hidden whitespace-nowrap text-xs font-semibold opacity-0 transition-all duration-150 group-hover:max-w-[140px] group-hover:opacity-100">
                Следующий ход #{turnId}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
