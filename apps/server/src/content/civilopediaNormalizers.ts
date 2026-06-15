import type { GameSettings } from "../runtime/gameSettingsTypes";

export function defaultCivilopediaEntries(): GameSettings["civilopedia"]["entries"] {
  return [
    {
      id: "basics-getting-started",
      category: "basics",
      title: "Как начать игру",
      summary: "Авторизация, обзор карты, приказы и завершение хода.",
      keywords: ["старт", "вход", "приказы", "ход"],
      imageUrl: null,
      relatedEntryIds: ["turn-timer", "map-modes", "economy-resources"],
      sections: [
        {
          title: "Первые шаги",
          paragraphs: [
            "После входа дождитесь загрузки данных и войдите в игру через экран подтверждения.",
            "Осмотрите карту, выберите слой и изучите текущие ресурсы в верхней панели.",
            "Отправьте приказы и завершите ход кнопкой следующего хода либо дождитесь авто-перехода по таймеру.",
          ],
        },
      ],
    },
    {
      id: "colonization-race",
      category: "colonization",
      title: "Колонизация провинций",
      summary: "Гонка стран за свободные провинции с прогрессом, стоимостью и поддержкой.",
      keywords: ["колонизация", "провинции", "прогресс", "гонка"],
      imageUrl: null,
      relatedEntryIds: ["map-modes", "economy-resources"],
      sections: [
        {
          title: "Механика",
          paragraphs: [
            "Несколько стран могут одновременно колонизировать одну провинцию. Прогресс хранится отдельно по каждой стране.",
            "Стоимость колонизации зависит от площади провинции и глобальных ставок за 1000 км², если не задана ручная цена.",
            "На поддержку колоний тратятся очки колонизации и дукаты; списывается только реально применяемое количество.",
          ],
        },
      ],
    },
    {
      id: "map-modes",
      category: "map",
      title: "Слои карты и легенды",
      summary: "Политическая карта, слой колонизации, легенды и фильтры отображения.",
      keywords: ["карта", "слои", "легенда", "границы"],
      imageUrl: null,
      relatedEntryIds: ["colonization-race"],
      sections: [
        {
          title: "Слои и легенды",
          paragraphs: [
            "Слои карты переключаются кнопками снизу. Для некоторых слоёв доступна легенда с компактным режимом.",
            "Отдельная кнопка включает/отключает границы провинций.",
          ],
        },
      ],
    },
    {
      id: "turn-timer",
      category: "turns",
      title: "Ходы и таймер",
      summary: "Ручной и автоматический переход хода, готовность стран и обработка хода.",
      keywords: ["таймер", "ход", "готовность", "автоход"],
      imageUrl: null,
      relatedEntryIds: ["basics-getting-started", "event-log"],
      sections: [
        {
          title: "Резолв хода",
          paragraphs: [
            "Ход может завершаться после готовности всех активных стран или автоматически по таймеру.",
            "Во время обработки показывается блокирующий экран с индикатором загрузки и временем обработки после завершения.",
          ],
        },
      ],
    },
    {
      id: "event-log",
      category: "journal",
      title: "Журнал событий",
      summary: "Официальные новости, системные сообщения и фильтры событий.",
      keywords: ["журнал", "события", "новости", "фильтры"],
      imageUrl: null,
      relatedEntryIds: ["turn-timer"],
      sections: [
        {
          title: "Использование",
          paragraphs: [
            "Журнал справа показывает публичные и приватные события, поддерживает категории, сортировку и фильтр по стране.",
            "Официальные новости приходят с сервера и помогают отслеживать ключевые изменения в партии.",
          ],
        },
      ],
    },
    {
      id: "economy-resources",
      category: "economy",
      title: "Ресурсы и экономика",
      summary: "Плашки ресурсов, прирост, расходы и чистый итог за ход.",
      keywords: ["ресурсы", "дукаты", "золото", "расходы", "экономика"],
      imageUrl: null,
      relatedEntryIds: ["colonization-race"],
      sections: [
        {
          title: "Верхняя панель",
          paragraphs: [
            "В TopBar отображается текущее значение ресурса и чистый итог за ход. Подробности открываются при наведении.",
            "Расходы включают приказы, поддержку колоний и другие действия, например кастомизацию страны за дукаты.",
          ],
        },
      ],
    },
  ];
}

export function defaultCivilopediaCategories(): string[] {
  return ["basics", "colonization", "map", "turns", "journal", "economy"];
}

export function normalizeCivilopediaEntries(input: unknown): GameSettings["civilopedia"]["entries"] {
  const fallback = defaultCivilopediaEntries();
  if (!Array.isArray(input)) return fallback;
  const next: GameSettings["civilopedia"]["entries"] = [];
  for (const raw of input) {
    if (!raw || typeof raw !== "object") continue;
    const item = raw as Record<string, unknown>;
    const id = typeof item.id === "string" && item.id.trim() ? item.id.trim() : "";
    const title = typeof item.title === "string" && item.title.trim() ? item.title.trim() : "";
    if (!id || !title) continue;
    const sectionsRaw = Array.isArray(item.sections) ? item.sections : [];
    const sections = sectionsRaw
      .map((s) => {
        if (!s || typeof s !== "object") return null;
        const section = s as Record<string, unknown>;
        const sectionTitle = typeof section.title === "string" && section.title.trim() ? section.title.trim() : "Раздел";
        const paragraphs = Array.isArray(section.paragraphs)
          ? section.paragraphs.filter((p): p is string => typeof p === "string").map((p) => p.trim()).filter(Boolean)
          : [];
        return { title: sectionTitle, paragraphs };
      })
      .filter((v): v is { title: string; paragraphs: string[] } => Boolean(v))
      .filter((v) => v.paragraphs.length > 0);
    next.push({
      id,
      category: typeof item.category === "string" && item.category.trim() ? item.category.trim() : "basics",
      title,
      summary: typeof item.summary === "string" ? item.summary.trim() : "",
      keywords: Array.isArray(item.keywords)
        ? item.keywords.filter((k): k is string => typeof k === "string").map((k) => k.trim()).filter(Boolean).slice(0, 30)
        : [],
      imageUrl:
        typeof item.imageUrl === "string"
          ? item.imageUrl
          : item.imageUrl === null
            ? null
            : null,
      relatedEntryIds: Array.isArray(item.relatedEntryIds)
        ? item.relatedEntryIds.filter((k): k is string => typeof k === "string").map((k) => k.trim()).filter(Boolean).slice(0, 20)
        : [],
      sections: sections.length > 0 ? sections : [{ title: "Содержание", paragraphs: ["Описание отсутствует."] }],
    });
  }
  return next.length > 0 ? next : fallback;
}

export function normalizeCivilopediaCategories(input: unknown, entries: GameSettings["civilopedia"]["entries"]): string[] {
  const base = new Set<string>(defaultCivilopediaCategories());
  if (Array.isArray(input)) {
    for (const raw of input) {
      if (typeof raw !== "string") continue;
      const value = raw.trim();
      if (!value) continue;
      base.add(value);
    }
  }
  for (const entry of entries) {
    if (entry.category.trim()) base.add(entry.category.trim());
  }
  return [...base];
}
