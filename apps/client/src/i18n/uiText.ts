export type UiLocale = "en" | "ru";

export type UiTextKey =
  | "common.cancel"
  | "common.close"
  | "common.confirm"
  | "common.pending"
  | "clientSettings.description"
  | "clientSettings.descriptionTitle"
  | "clientSettings.interface"
  | "clientSettings.language"
  | "clientSettings.languageDescription"
  | "clientSettings.localNote"
  | "clientSettings.mapControls"
  | "clientSettings.mapControlsDescription"
  | "clientSettings.save"
  | "clientSettings.sortNotifications"
  | "clientSettings.sortNotificationsDescription"
  | "clientSettings.title"
  | "clientSettings.uiLanguage"
  | "locale.english"
  | "locale.russian"
  | "map.controls.zoomIn"
  | "map.controls.zoomOut"
  | "map.controls.resetView"
  | "map.controls.lockInteraction"
  | "map.controls.unlockInteraction"
  | "map.mode.regions.label"
  | "map.mode.regions.shortLabel"
  | "map.mode.regions.legendLabel"
  | "map.mode.regions.legendDescription"
  | "map.mode.provinceColors.label"
  | "map.mode.provinceColors.shortLabel"
  | "map.mode.provinceColors.legendLabel"
  | "map.mode.provinceColors.legendDescription"
  | "provincePanel.collapse"
  | "provincePanel.pin"
  | "provincePanel.unpin"
  | "corridorBuild.title"
  | "corridorBuild.summary"
  | "corridorBuild.undoPoint"
  | "colonization.title"
  | "colonization.fallbackRegion"
  | "colonization.area"
  | "colonization.showOwnColonies"
  | "colonization.selectRegion"
  | "colonization.cost"
  | "colonization.ducatsByArea"
  | "colonization.status"
  | "colonization.statusOccupied"
  | "colonization.statusDisabled"
  | "colonization.statusAvailable"
  | "colonization.regionArea"
  | "colonization.yourProgress"
  | "colonization.limitTooltip"
  | "colonization.limit"
  | "colonization.raceLeader"
  | "colonization.noParticipants"
  | "colonization.disabledByAdmin"
  | "colonization.participants"
  | "colonization.noColonizers"
  | "colonization.openAdminEditor"
  | "colonization.openAdminEditorAria"
  | "colonization.cancelTooltipCan"
  | "colonization.cancelTooltipCannot"
  | "colonization.cancel"
  | "colonization.startTooltipCan"
  | "colonization.startTooltipCannot"
  | "colonization.start"
  | "colonization.toastStarted"
  | "colonization.eventStartTitle"
  | "colonization.eventStartMessage"
  | "colonization.limitReached"
  | "colonization.eventLimitTitle"
  | "colonization.startFailed"
  | "colonization.toastCanceled"
  | "colonization.eventCancelTitle"
  | "colonization.eventCancelMessage"
  | "colonization.cancelFailed"
  | "diplomacy.transferRegion"
  | "diplomacy.transferRegionSummary"
  | "diplomacy.regionNotOwned"
  | "diplomacy.selectRegion"
  | "population.countryTitle"
  | "population.worldTitle"
  | "population.countryRegionSubtitle"
  | "population.worldRegionSubtitle"
  | "population.groupsByRegion"
  | "population.regionColumn"
  | "population.regionsInScope"
  | "population.noNegativeRegionBalance"
  | "population.negativeRegionBalanceAlert"
  | "population.noLowRegionCapital"
  | "population.lowRegionCapitalAlert"
  | "buildings.regionRequired"
  | "buildings.regionDependency"
  | "buildings.ownRegionOnlyDemolish"
  | "buildings.ownRegionOnlyUpgrade"
  | "buildings.ownRegionOnlyToggle"
  | "buildings.ownRegionOnlyRename"
  | "buildings.duplicateNameInRegion"
  | "buildings.modalDescription"
  | "buildings.sortRegion"
  | "buildings.filterRegionAll"
  | "buildings.regionLabel"
  | "buildings.extractedResourceTooltip"
  | "buildings.buildCountryTooltip"
  | "buildings.selectedRegionTooltip"
  | "buildings.selectedRegionLabel"
  | "buildings.selectRegion"
  | "buildings.confirmRegion"
  | "buildings.renamePrompt"
  | "contentPanel.flow.addExtraction"
  | "contentPanel.flow.amount"
  | "contentPanel.flow.extractions"
  | "contentPanel.flow.extractionsTooltip"
  | "contentPanel.flow.fromLevel"
  | "contentPanel.flow.good"
  | "contentPanel.flow.inputsTooltip"
  | "contentPanel.flow.invalidLevelWindow"
  | "contentPanel.flow.noExtractions"
  | "contentPanel.flow.noLimit"
  | "contentPanel.flow.outputsTooltip"
  | "contentPanel.flow.requiresDeposit"
  | "contentPanel.flow.toLevel"
  | "provinceContext.openColonization"
  | "provinceContext.openProvinceKnowledge"
  | "provinceContext.createProvinceKnowledge"
  | "provinceContext.openAdminEditor";

const uiText: Record<UiLocale, Record<UiTextKey, string>> = {
  en: {
    "common.cancel": "Cancel",
    "common.close": "Close",
    "common.confirm": "Confirm",
    "common.pending": "Applying...",
    "clientSettings.description": "These settings do not affect the server game and apply only in your browser.",
    "clientSettings.descriptionTitle": "Description",
    "clientSettings.interface": "Interface",
    "clientSettings.language": "Language",
    "clientSettings.languageDescription": "Controls guarded client UI text. older screens are being migrated gradually.",
    "clientSettings.localNote": "Settings are saved locally for each country.",
    "clientSettings.mapControls": "Map controls panel",
    "clientSettings.mapControlsDescription": "Zoom, reset, and map lock buttons in the lower right corner.",
    "clientSettings.save": "Save",
    "clientSettings.sortNotifications": "Notification sorting",
    "clientSettings.sortNotificationsDescription": "When opened, unread notifications are moved left / to the end of the row.",
    "clientSettings.title": "Client settings",
    "clientSettings.uiLanguage": "UI language",
    "locale.english": "English",
    "locale.russian": "Russian",
    "map.controls.zoomIn": "Zoom in",
    "map.controls.zoomOut": "Zoom out",
    "map.controls.resetView": "Reset center and zoom",
    "map.controls.lockInteraction": "Lock pan/zoom",
    "map.controls.unlockInteraction": "Unlock pan/zoom",
    "map.mode.regions.label": "Regions",
    "map.mode.regions.shortLabel": "Regions",
    "map.mode.regions.legendLabel": "State region",
    "map.mode.regions.legendDescription": "Provinces grouped by their gameplay region",
    "map.mode.provinceColors.label": "Province colors",
    "map.mode.provinceColors.shortLabel": "Provinces",
    "map.mode.provinceColors.legendLabel": "Province",
    "map.mode.provinceColors.legendDescription": "Authored scenario colors for lightweight map provinces",
    "provincePanel.collapse": "Collapse panel",
    "provincePanel.pin": "Pin panel",
    "provincePanel.unpin": "Unpin panel",
    "corridorBuild.title": "Corridor construction",
    "corridorBuild.summary": "Route points: {points}. Provinces: {provinces}. Click your provinces to lay the path.",
    "corridorBuild.undoPoint": "Remove point",
    "colonization.title": "Colonization: {region}",
    "colonization.fallbackRegion": "Region",
    "colonization.area": "Area: {area}",
    "colonization.showOwnColonies": "Show data for our colony",
    "colonization.selectRegion": "Select region",
    "colonization.cost": "Colonization cost",
    "colonization.ducatsByArea": "Ducat price by area:",
    "colonization.status": "Status:",
    "colonization.statusOccupied": "occupied ({country})",
    "colonization.statusDisabled": "disabled",
    "colonization.statusAvailable": "available",
    "colonization.regionArea": "Region area: {area}",
    "colonization.yourProgress": "Your progress: {progress} / {cost}",
    "colonization.limitTooltip": "Your country's active colonization limit: current active colonies / game maximum",
    "colonization.limit": "Colonization limit",
    "colonization.raceLeader": "Race leader",
    "colonization.noParticipants": "No participants",
    "colonization.disabledByAdmin": "Colonization disabled by an administrator",
    "colonization.participants": "Race participants",
    "colonization.noColonizers": "No country is colonizing this region yet",
    "colonization.openAdminEditor": "Open region data editor (admin only)",
    "colonization.openAdminEditorAria": "Edit region (admin)",
    "colonization.cancelTooltipCan": "Stop your country's participation in this region's colonization",
    "colonization.cancelTooltipCannot": "Your country has no active colonization in this region",
    "colonization.cancel": "Cancel colonization",
    "colonization.startTooltipCan": "Start colonization: the region will be added to your country's active colonies",
    "colonization.startTooltipCannot": "Colonization cannot be started now; check status and limits",
    "colonization.start": "Start colonization",
    "colonization.toastStarted": "Colonization started",
    "colonization.eventStartTitle": "Colonization started",
    "colonization.eventStartMessage": "You started colonizing region {region}",
    "colonization.limitReached": "Active colonization limit reached",
    "colonization.eventLimitTitle": "Colonization limit",
    "colonization.startFailed": "Failed to start colonization",
    "colonization.toastCanceled": "Colonization canceled",
    "colonization.eventCancelTitle": "Colonization canceled",
    "colonization.eventCancelMessage": "You canceled colonization of region {region}",
    "colonization.cancelFailed": "Failed to cancel colonization",
    "diplomacy.transferRegion": "Region transfer",
    "diplomacy.transferRegionSummary": "{from} transfers region {region} to {to}",
    "diplomacy.regionNotOwned": "The sender no longer owns this region",
    "diplomacy.selectRegion": "Select region",
    "population.countryTitle": "Population: {country}",
    "population.worldTitle": "World population",
    "population.countryRegionSubtitle": "Statistics for your regions",
    "population.worldRegionSubtitle": "Summary statistics for all regions",
    "population.groupsByRegion": "Pop groups by region",
    "population.regionColumn": "Region",
    "population.regionsInScope": "Regions in calculation",
    "population.noNegativeRegionBalance": "No regions with negative balance for {turns} consecutive turns",
    "population.negativeRegionBalanceAlert": "{region}: negative balance for {turns} consecutive turns ({balance} ducats/turn)",
    "population.noLowRegionCapital": "No regions with critically low capital per capita",
    "population.lowRegionCapitalAlert": "{region}: low capital per capita ({capital} ducats/person)",
    "buildings.regionRequired": "No region selected",
    "buildings.regionDependency": "Requires building in region: {building}",
    "buildings.ownRegionOnlyDemolish": "Demolition is available only in your regions",
    "buildings.ownRegionOnlyUpgrade": "Upgrade is available only in your regions",
    "buildings.ownRegionOnlyToggle": "This toggle is available only in your regions",
    "buildings.ownRegionOnlyRename": "Renaming is available only in your regions",
    "buildings.duplicateNameInRegion": "That name is already used in this region",
    "buildings.modalDescription": "All constructed buildings by region",
    "buildings.sortRegion": "Sort: region",
    "buildings.filterRegionAll": "Region: all",
    "buildings.regionLabel": "Region:",
    "buildings.extractedResourceTooltip": "Resource extracted by the building from region deposits this turn",
    "buildings.buildCountryTooltip": "Country whose regions will receive planned construction. Your country is selected by default.",
    "buildings.selectedRegionTooltip": "The selected region applies to every project added from the list below.",
    "buildings.selectedRegionLabel": "Region",
    "buildings.selectRegion": "Select region",
    "buildings.confirmRegion": "Region:",
    "buildings.renamePrompt": "Building: {building}\nRegion: {region}",
    "contentPanel.flow.addExtraction": "Add extraction",
    "contentPanel.flow.amount": "Amount",
    "contentPanel.flow.extractions": "Resource extraction",
    "contentPanel.flow.extractionsTooltip": "Resources extracted by the building each turn. Empty level bounds mean no level limit.",
    "contentPanel.flow.fromLevel": "From level",
    "contentPanel.flow.good": "Good",
    "contentPanel.flow.inputsTooltip": "Goods consumed by the building each turn. Empty level bounds mean no level limit.",
    "contentPanel.flow.invalidLevelWindow": "Flow level window is invalid: max level must be greater than or equal to min level.",
    "contentPanel.flow.noExtractions": "No resource extraction rows",
    "contentPanel.flow.noLimit": "No limit",
    "contentPanel.flow.outputsTooltip": "Goods produced by the building each turn. Empty level bounds mean no level limit.",
    "contentPanel.flow.requiresDeposit": "Requires deposit",
    "contentPanel.flow.toLevel": "To level",
    "provinceContext.openColonization": "Open colonization",
    "provinceContext.openProvinceKnowledge": "Province article",
    "provinceContext.createProvinceKnowledge": "Create province article",
    "provinceContext.openAdminEditor": "Province management",
  },
  ru: {
    "common.cancel": "Отмена",
    "common.close": "Закрыть",
    "common.confirm": "Подтвердить",
    "common.pending": "Применяем...",
    "clientSettings.description": "Эти параметры не влияют на серверную игру и применяются только в вашем браузере.",
    "clientSettings.descriptionTitle": "Описание",
    "clientSettings.interface": "Интерфейс",
    "clientSettings.language": "Язык",
    "clientSettings.languageDescription": "Управляет переведенным клиентским UI. Старые экраны мигрируются постепенно.",
    "clientSettings.localNote": "Настройки сохраняются локально отдельно для каждой страны.",
    "clientSettings.mapControls": "Панель управления картой",
    "clientSettings.mapControlsDescription": "Кнопки зума, сброса и блокировки карты в правом нижнем углу.",
    "clientSettings.save": "Сохранить",
    "clientSettings.sortNotifications": "Сортировка уведомлений",
    "clientSettings.sortNotificationsDescription": "При открытии непросмотренные уведомления переставляются влево/в конец ряда.",
    "clientSettings.title": "Настройки клиента",
    "clientSettings.uiLanguage": "Язык интерфейса",
    "locale.english": "Английский",
    "locale.russian": "Русский",
    "map.controls.zoomIn": "Приблизить карту",
    "map.controls.zoomOut": "Отдалить карту",
    "map.controls.resetView": "Сбросить центр и масштаб",
    "map.controls.lockInteraction": "Заблокировать pan/zoom",
    "map.controls.unlockInteraction": "Разблокировать pan/zoom",
    "map.mode.regions.label": "Регионы",
    "map.mode.regions.shortLabel": "Регионы",
    "map.mode.regions.legendLabel": "Государственный регион",
    "map.mode.regions.legendDescription": "Провинции, сгруппированные по gameplay-региону",
    "map.mode.provinceColors.label": "Цвета провинций",
    "map.mode.provinceColors.shortLabel": "Провинции",
    "map.mode.provinceColors.legendLabel": "Провинция",
    "map.mode.provinceColors.legendDescription": "Сценарные цвета lightweight map-провинций",
    "provincePanel.collapse": "Свернуть панель",
    "provincePanel.pin": "Закрепить панель",
    "provincePanel.unpin": "Открепить панель",
    "corridorBuild.title": "Строительство коридора",
    "corridorBuild.summary": "Точек маршрута: {points}. Провинций: {provinces}. Кликайте по своим провинциям, чтобы прокладывать путь.",
    "corridorBuild.undoPoint": "Убрать точку",
    "colonization.title": "Колонизация: {region}",
    "colonization.fallbackRegion": "Регион",
    "colonization.area": "Площадь: {area}",
    "colonization.showOwnColonies": "Показать данные по нашей колонии",
    "colonization.selectRegion": "Выберите регион",
    "colonization.cost": "Стоимость колонизации",
    "colonization.ducatsByArea": "Цена в дукатах (по площади):",
    "colonization.status": "Статус:",
    "colonization.statusOccupied": "занят ({country})",
    "colonization.statusDisabled": "запрещено",
    "colonization.statusAvailable": "доступно",
    "colonization.regionArea": "Площадь региона: {area}",
    "colonization.yourProgress": "Ваш прогресс: {progress} / {cost}",
    "colonization.limitTooltip": "Лимит активных колонизаций вашей страны: текущие активные колонии / максимум из настроек игры",
    "colonization.limit": "Лимит колонизаций",
    "colonization.raceLeader": "Лидер гонки",
    "colonization.noParticipants": "Нет участников",
    "colonization.disabledByAdmin": "Колонизация запрещена администратором",
    "colonization.participants": "Участники гонки",
    "colonization.noColonizers": "Пока никто не колонизирует этот регион",
    "colonization.openAdminEditor": "Открыть редактирование данных региона (только для админа)",
    "colonization.openAdminEditorAria": "Изменить регион (админ)",
    "colonization.cancelTooltipCan": "Остановить участие вашей страны в колонизации этого региона",
    "colonization.cancelTooltipCannot": "У вашей страны нет активной колонизации этого региона",
    "colonization.cancel": "Отменить колонизацию",
    "colonization.startTooltipCan": "Начать колонизацию: регион добавится в активные колонии страны",
    "colonization.startTooltipCannot": "Начать колонизацию сейчас нельзя (проверьте статус/лимит)",
    "colonization.start": "Начать колонизацию",
    "colonization.toastStarted": "Колонизация начата",
    "colonization.eventStartTitle": "Начало колонизации",
    "colonization.eventStartMessage": "Вы начали колонизацию региона {region}",
    "colonization.limitReached": "Достигнут лимит активных колонизаций",
    "colonization.eventLimitTitle": "Лимит колонизаций",
    "colonization.startFailed": "Не удалось начать колонизацию",
    "colonization.toastCanceled": "Колонизация отменена",
    "colonization.eventCancelTitle": "Отмена колонизации",
    "colonization.eventCancelMessage": "Вы отменили колонизацию региона {region}",
    "colonization.cancelFailed": "Не удалось отменить колонизацию",
    "diplomacy.transferRegion": "Передача региона",
    "diplomacy.transferRegionSummary": "{from} передаёт {to} регион {region}",
    "diplomacy.regionNotOwned": "Регион больше не принадлежит отправителю",
    "diplomacy.selectRegion": "Выберите регион",
    "population.countryTitle": "Население: {country}",
    "population.worldTitle": "Население мира",
    "population.countryRegionSubtitle": "Статистика по вашим регионам",
    "population.worldRegionSubtitle": "Сводная статистика по всем регионам",
    "population.groupsByRegion": "Pop-группы по регионам",
    "population.regionColumn": "Регион",
    "population.regionsInScope": "Регионов в расчете",
    "population.noNegativeRegionBalance": "Нет регионов с отрицательным балансом {turns} ход. подряд",
    "population.negativeRegionBalanceAlert": "{region}: отрицательный баланс {turns} ход. подряд ({balance} дукат/ход)",
    "population.noLowRegionCapital": "Нет регионов с критично низким капиталом на душу",
    "population.lowRegionCapitalAlert": "{region}: низкий капитал на душу ({capital} дукат/чел.)",
    "buildings.regionRequired": "Не выбран регион",
    "buildings.regionDependency": "Нужно здание в регионе: {building}",
    "buildings.ownRegionOnlyDemolish": "Снос доступен только в ваших регионах",
    "buildings.ownRegionOnlyUpgrade": "Апгрейд доступен только в ваших регионах",
    "buildings.ownRegionOnlyToggle": "Переключение доступно только в ваших регионах",
    "buildings.ownRegionOnlyRename": "Переименование доступно только в ваших регионах",
    "buildings.duplicateNameInRegion": "Такое название уже используется в этом регионе",
    "buildings.modalDescription": "Все построенные здания по регионам",
    "buildings.sortRegion": "Сорт: регион",
    "buildings.filterRegionAll": "Регион: все",
    "buildings.regionLabel": "Регион:",
    "buildings.extractedResourceTooltip": "Ресурс, добытый зданием из залежей региона за ход",
    "buildings.buildCountryTooltip": "Страна, в регионах которой планируется строительство. По умолчанию выбрана ваша страна.",
    "buildings.selectedRegionTooltip": "Выбранный регион применяется ко всем добавляемым проектам из списка ниже.",
    "buildings.selectedRegionLabel": "Регион",
    "buildings.selectRegion": "Выберите регион",
    "buildings.confirmRegion": "Регион:",
    "buildings.renamePrompt": "Постройка: {building}\nРегион: {region}",
    "contentPanel.flow.addExtraction": "Добавить добычу",
    "contentPanel.flow.amount": "Количество",
    "contentPanel.flow.extractions": "Добыча ресурсов",
    "contentPanel.flow.extractionsTooltip": "Ресурсы, которые здание добывает каждый ход. Пустые границы уровня означают отсутствие ограничения.",
    "contentPanel.flow.fromLevel": "С уровня",
    "contentPanel.flow.good": "Товар",
    "contentPanel.flow.inputsTooltip": "Товары, которые здание потребляет каждый ход. Пустые границы уровня означают отсутствие ограничения.",
    "contentPanel.flow.invalidLevelWindow": "Некорректное окно уровней flow: максимальный уровень должен быть больше или равен минимальному.",
    "contentPanel.flow.noExtractions": "Строк добычи ресурсов нет",
    "contentPanel.flow.noLimit": "Без лимита",
    "contentPanel.flow.outputsTooltip": "Товары, которые здание производит каждый ход. Пустые границы уровня означают отсутствие ограничения.",
    "contentPanel.flow.requiresDeposit": "Требует залежь",
    "contentPanel.flow.toLevel": "До уровня",
    "provinceContext.openColonization": "Открыть колонизацию",
    "provinceContext.openProvinceKnowledge": "Статья о провинции",
    "provinceContext.createProvinceKnowledge": "Создать статью о провинции",
    "provinceContext.openAdminEditor": "Управление провинцией",
  },
};

const UI_LOCALE_STORAGE_KEY = "arcanorum.uiLocale";
const listeners = new Set<() => void>();
let currentLocale: UiLocale = readInitialUiLocale();

export function getUiLocale(): UiLocale {
  return currentLocale;
}

export function setUiLocale(locale: UiLocale): void {
  if (currentLocale === locale) return;
  currentLocale = locale;
  writeStoredUiLocale(locale);
  for (const listener of listeners) listener();
}

export function subscribeUiLocale(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function tUi(key: UiTextKey, params: Record<string, string | number> = {}, locale: UiLocale = getUiLocale()): string {
  const template = uiText[locale][key];
  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (match, paramKey: string) => {
    const value = params[paramKey];
    return value == null ? match : String(value);
  });
}

export function getUiTextCatalog(): Record<UiLocale, Record<UiTextKey, string>> {
  return uiText;
}

function readInitialUiLocale(): UiLocale {
  const stored = readStoredUiLocale();
  if (stored) return stored;
  if (typeof navigator === "undefined") return "ru";
  return navigator.language.toLowerCase().startsWith("en") ? "en" : "ru";
}

function readStoredUiLocale(): UiLocale | null {
  if (typeof window === "undefined") return null;
  const stored = window.localStorage.getItem(UI_LOCALE_STORAGE_KEY);
  return stored === "en" || stored === "ru" ? stored : null;
}

function writeStoredUiLocale(locale: UiLocale): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(UI_LOCALE_STORAGE_KEY, locale);
}
