# Event System Refactor Plan

## Цель

Приблизить систему событий Arcanorum к модели Victoria 3: события должны быть не просто уведомлениями с кнопками, а data-driven scripting layer поверх механик страны, регионов, населения, экономики, политики, дипломатии, журналов и модификаторов.

Итоговая система должна позволять сценариям создавать сложные цепочки событий без правок core simulation code.

## Текущее состояние

Сейчас в проекте уже есть базовая система:

- `GameEventDefinition` в `packages/shared/src/contracts/content.ts`.
- Pending events хранятся в `WorldBase.countryEventsByCountryId`.
- Сервер генерирует события каждый ход через `maybeGenerateCountryEvents`.
- Игрок выбирает option через `POST /events/:countryId/:pendingId/choose`.
- История событий хранится в `CountryEventRecord.history`.
- UI отображает события через `CountryEventsModal` и `EventStoryModal`.
- События scenario-authored и лежат в `scenarios/<scenario_id>/common/events/*.json`.

Главные ограничения текущей модели:

- событие почти всегда country-scoped;
- условия очень простые;
- эффекты почти только `resource_delta`;
- нет event chains;
- нет journal entries;
- нет scoped targets вроде региона, здания, рынка, interest group, pop;
- нет нормального explanation trail для игрока;
- авто-выбор option основан на `autoChancePct`, а не на AI utility;
- часть player-facing текстов в event data сейчас может быть raw text, а не localization key.

## Принципы Рефакторинга

### 1. No Legacy

Не оставлять параллельную старую систему событий.

Если вводится новый формат события, старый формат должен быть:

- мигрирован,
- удален,
- покрыт валидатором,
- отражен в docs,
- отражен в scenario authoring rules.

Запрещено добавлять hidden fallback, который молча превращает старые события в новые.

### 2. Scenario-Owned Content

Все конкретные события должны жить в сценарии:

```text
apps/server/data/scenarios/<scenario_id>/common/events/*.json
```

Core code предоставляет:

- trigger evaluator,
- effect applier,
- scope resolver,
- journal runtime,
- modifier runtime,
- explanation runtime.

Core code не должен знать конкретные события вроде:

```ts
if (eventId === "industrial_strike") {
  ...
}
```

### 3. Tooltip-First

Каждое событие должно объяснять игроку:

- почему оно произошло,
- какие условия его запустили,
- какие объекты затронуты,
- что делает каждый вариант,
- какие модификаторы будут добавлены/убраны,
- какие ресурсы/параметры изменятся,
- что произойдет при игнорировании,
- когда сработает авто-выбор.

Если событие меняет видимое значение, UI должен показать причину.

### 4. Localization Required

Все видимые тексты событий должны использовать localization keys с English и Russian значениями.

Запрещено:

```json
{
  "label": "Понятно"
}
```

Нужно:

```json
{
  "labelKey": "events.climate_summit.option.accept"
}
```

## Target Architecture

## 1. Shared Contracts

Расширить `packages/shared/src/contracts/content.ts`.

### Event Definition

Предлагаемый формат:

```ts
export type GameEventDefinition = {
  id: string;
  namespace: string;
  category: EventCategory;
  priority: EventPriority;
  visibility: EventVisibility;

  titleKey: string;
  descriptionKey: string;
  imageUrl?: string | null;
  iconId?: string | null;

  scope: EventScopeDefinition;
  trigger: EventTriggerDefinition;
  meanTimeToHappen?: EventMtthDefinition | null;

  options: GameEventOption[];

  chain?: EventChainDefinition | null;
  cooldownTurns?: number;
  repeatable?: boolean;
  timeoutTurns?: number | null;
  defaultOptionId?: string | null;
  blocking?: boolean;
};
```

### Event Scopes

Добавить scopes:

```ts
export type EventScopeKind =
  | "country"
  | "region"
  | "building"
  | "pop"
  | "interest_group"
  | "law"
  | "market"
  | "diplomatic_relation"
  | "war"
  | "journal_entry";
```

Событие должно хранить resolved scopes в pending state:

```ts
export type PendingCountryEvent = {
  id: string;
  eventId: string;
  countryId: string;
  createdTurnId: number;
  expiresTurnId?: number | null;
  scopes: Record<string, EventResolvedScope>;
  triggerExplanation: EventTriggerExplanation[];
};
```

### Event Options

Расширить option:

```ts
export type GameEventOption = {
  id: string;
  labelKey: string;
  descriptionKey?: string | null;
  tooltipKey?: string | null;
  effects: GameEffect[];
  aiWeight?: AiWeightRule[] | null;
  playerDefault?: boolean | null;
  buttonTone?: "default" | "primary" | "danger" | "warning" | null;
};
```

`buttonColor` лучше убрать как raw styling. Цвет должен быть tone/theme-driven.

## 2. Trigger System

Сейчас условия ограничены:

- `always`
- `law_active`
- `technology_researched`
- `country_is`
- `has_building`

Нужно ввести общий trigger DSL.

### Базовые Country Triggers

- `country_has_law`
- `country_lacks_law`
- `country_has_technology`
- `country_resource_above`
- `country_resource_below`
- `country_has_modifier`
- `country_legitimacy_above`
- `country_legitimacy_below`
- `country_is_ai`
- `country_is_player`
- `country_controls_region_count_above`
- `country_controls_region_count_below`

### Region Triggers

- `region_owner_is`
- `region_controller_is`
- `region_is_colonizable`
- `region_has_population_above`
- `region_has_population_below`
- `region_has_building`
- `region_has_resource_deposit`
- `region_market_access_below`
- `region_radicals_above`
- `region_loyalists_above`
- `region_standard_of_living_below`
- `region_colonization_progress_above`

### Economy Triggers

- `market_good_shortage`
- `market_good_surplus`
- `building_profit_below`
- `building_employment_below`
- `building_output_above`
- `resource_flow_negative`
- `treasury_below`

### Diplomacy/Military Triggers

- `relation_below`
- `relation_above`
- `has_active_treaty`
- `has_diplomatic_proposal`
- `at_war`
- `war_support_below`
- `controls_foreign_region`

### Trigger Composition

Поддержать:

```json
{
  "all": [...]
}
```

```json
{
  "any": [...]
}
```

```json
{
  "not": {...}
}
```

Каждый trigger должен возвращать structured explanation:

```ts
export type EventTriggerExplanation = {
  triggerId: string;
  passed: boolean;
  value?: number | string | boolean | null;
  threshold?: number | string | boolean | null;
  affectedObject?: EventResolvedScope | null;
  labelKey: string;
};
```

## 3. Scope Resolver

Добавить серверный модуль:

```text
apps/server/src/mechanics/eventScopeMechanics.ts
```

Ответственность:

- найти валидные target scopes,
- выбрать конкретный объект события,
- сохранить resolved scope в pending event,
- не делать full-world scan без индексов.

Пример authored event:

```json
{
  "scope": {
    "root": { "kind": "country" },
    "region": {
      "kind": "region",
      "from": "root.controlled_regions",
      "where": {
        "all": [
          { "type": "region_radicals_above", "value": 1000 },
          { "type": "region_market_access_below", "value": 80 }
        ]
      },
      "pick": {
        "orderBy": "radicals",
        "direction": "desc"
      }
    }
  }
}
```

UI сможет показать:

- событие произошло в регионе X,
- перейти к региону,
- tooltip объяснит почему выбран именно этот регион.

## 4. Effect System

Сейчас `DecisionEffect` поддерживает почти только:

```ts
{ type: "resource_delta" }
```

Нужно заменить/расширить это на общий `GameEffect`.

### Resource Effects

- `add_resource`
- `spend_resource`
- `add_resource_flow`

Все resource effects должны идти через `ResourceLedgerService`.

### Modifier Effects

- `add_modifier`
- `remove_modifier`
- `extend_modifier`

Модификаторы должны использовать unified modifier system.

### Population Effects

- `add_radicals`
- `add_loyalists`
- `change_standard_of_living`
- `change_population_size`
- `change_profession`
- `start_migration_pressure`

Region-level only. Не добавлять province-level population.

### Region Effects

- `change_region_owner`
- `change_region_controller`
- `add_region_claim`
- `add_region_modifier`
- `start_colonization`
- `change_colonization_progress`
- `damage_region_building`

Territorial effects должны быть серверно валидированы и не обходить существующие правила.

### Politics Effects

- `add_law_support`
- `start_law_enactment`
- `change_legitimacy`
- `add_interest_group_approval`
- `add_interest_group_clout`

### Diplomacy Effects

- `change_relation`
- `create_diplomatic_proposal`
- `add_truce`
- `add_treaty`
- `start_diplomatic_play`

### Journal Effects

- `start_journal_entry`
- `advance_journal_entry`
- `complete_journal_entry`
- `fail_journal_entry`
- `set_journal_variable`

### Event Effects

- `trigger_event`
- `schedule_event`
- `cancel_event`
- `set_event_flag`
- `clear_event_flag`

## 5. Event Chains

Добавить цепочки событий.

```ts
export type EventChainDefinition = {
  chainId: string;
  stepId: string;
  startsChain?: boolean;
  endsChain?: boolean;
  followups?: Array<{
    eventId: string;
    delayTurns?: number;
    chancePct?: number;
    conditions?: EventTriggerDefinition;
  }>;
};
```

Pending/future scheduled events хранить отдельно:

```ts
export type ScheduledCountryEvent = {
  id: string;
  eventId: string;
  countryId: string;
  scheduledTurnId: number;
  scopes: Record<string, EventResolvedScope>;
  chainId?: string | null;
};
```

Нужно добавить в `WorldBase`:

```ts
countryScheduledEventsByCountryId
countryEventFlagsByCountryId
```

Это изменение требует:

- shared contract update,
- world delta mask,
- server diff/apply,
- persistence restore,
- tests.

## 6. Journal Entries

Victoria 3 сильно опирается на Journal Entries. Для Arcanorum нужен отдельный слой.

### Contracts

```ts
export type JournalEntryDefinition = {
  id: string;
  category: string;
  titleKey: string;
  descriptionKey: string;
  visibility: "public" | "private";
  startTrigger?: EventTriggerDefinition;
  completeTrigger?: EventTriggerDefinition;
  failTrigger?: EventTriggerDefinition;
  timeoutTurns?: number | null;
  progress?: JournalProgressDefinition | null;
  onStartEffects?: GameEffect[];
  onCompleteEffects?: GameEffect[];
  onFailEffects?: GameEffect[];
  events?: {
    onStart?: string[];
    onComplete?: string[];
    onFail?: string[];
    periodic?: string[];
  };
};
```

### World State

```ts
journalEntriesByCountryId: Record<string, CountryJournalState>
```

### UI

Добавить player-facing journal UI:

- активные задачи,
- прогресс,
- условия завершения,
- последствия успеха/провала,
- связанные события,
- таймер.

## 7. AI Event Choices

Заменить `autoChancePct` как главный способ выбора на AI utility.

### Option AI Weight

```json
{
  "aiWeight": [
    { "base": 10 },
    {
      "if": { "type": "country_resource_below", "resource": "ducats", "value": 0 },
      "add": 50
    },
    {
      "if": { "type": "law_active", "targetId": "law:traditionalism" },
      "multiply": 1.5
    }
  ]
}
```

AI должна:

- выбирать только валидные options,
- использовать same effect validation,
- не получать hidden info,
- писать admin-debug explanation,
- не мутировать мир напрямую.

## 8. UI Refactor

### Event Modal

Текущий `EventStoryModal` оставить как визуальную основу, но расширить:

- title/description через localization keys,
- affected scopes,
- reason panel,
- effect preview,
- modifiers preview,
- timeout/auto-choice,
- related journal entry,
- related region/country quick links,
- option disabled reasons,
- explicit blocking badge.

### Notification Tray

События должны различаться:

- обычное уведомление,
- важное событие,
- blocking event,
- journal update,
- event chain continuation.

### Event History

История должна хранить не только label/optionLabel, а:

- event id,
- option id,
- turn,
- resolved scopes,
- applied effects summary,
- explanation record ids.

## 9. Explanation Records

Каждый important effect должен создавать structured explanation.

```ts
export type ExplanationRecord = {
  id: string;
  turnId: number;
  sourceSystem: "event";
  sourceId: string;
  affectedObject: EventResolvedScope;
  valueKey: string;
  previousValue?: number | string | null;
  newValue?: number | string | null;
  causes: ExplanationCause[];
  modifierIds?: string[];
};
```

Примеры вопросов, которые UI должен отвечать:

- почему появились радикалы?
- почему упала казна?
- почему регион получил модификатор?
- почему событие произошло сейчас?
- почему этот option недоступен?

## 10. Scenario Validation

Валидатор должен проверять:

- все localization keys существуют на EN/RU;
- event id стабилен;
- options имеют `labelKey`;
- scopes валидны;
- triggers валидны;
- effects валидны;
- referenced modifiers/events/journals/laws/buildings/regions существуют;
- no raw player-facing text;
- no unknown effect/trigger types;
- no legacy event shape;
- no hardcoded color outside allowed `buttonTone`/theme token.

## 11. Migration Plan

### Phase 1: Contracts And Validation

- Ввести `GameEffect`, `EventTriggerDefinition`, `EventScopeDefinition`.
- Добавить строгую validation.
- Запретить новые raw `label`/`description` в event options.
- Сохранить временный migration script для существующих событий.

### Phase 2: Runtime Compatibility Removal

- Перевести существующие события на новый формат.
- Удалить legacy normalization fallback:
  - default raw `"Понятно"`,
  - raw option labels,
  - raw descriptions.
- Обновить content panel/admin authoring.

### Phase 3: Scoped Events

- Добавить scope resolver.
- Добавить region/country/market/building scopes.
- Добавить UI отображение affected scopes.

### Phase 4: Effects

- Добавить unified event effect applier.
- Подключить resource ledger.
- Подключить modifier system.
- Подключить region/population/politics/diplomacy effects постепенно.

### Phase 5: Event Chains

- Добавить scheduled events.
- Добавить event flags.
- Добавить chain history.

### Phase 6: Journal Entries

- Добавить contracts.
- Добавить runtime.
- Добавить UI.
- Подключить события к journal lifecycle.

### Phase 7: AI Choices

- Добавить AI option scoring.
- Добавить tests и admin explanations.

## 12. Files Likely To Change

### Shared

- `packages/shared/src/contracts/content.ts`
- `packages/shared/src/contracts/world.ts`
- `packages/shared/src/contracts/ws.ts`
- `packages/shared/src/index.ts`

### Server Mechanics

- `apps/server/src/mechanics/decisionEventMechanics.ts`
- `apps/server/src/mechanics/contentDefinitionNormalizers.ts`
- `apps/server/src/mechanics/eventScopeMechanics.ts`
- `apps/server/src/mechanics/eventTriggerMechanics.ts`
- `apps/server/src/mechanics/eventEffectMechanics.ts`
- `apps/server/src/mechanics/journalMechanics.ts`

### Server Runtime

- `apps/server/src/runtime/countryProgressionRuntime.ts`
- `apps/server/src/runtime/turnRuntime.ts`
- `apps/server/src/runtime/worldDeltaDiff.ts`
- `apps/server/src/runtime/worldStateNormalizers.ts`
- `apps/server/src/runtime/persistedWorldBaseRestore.ts`

### Server Routes

- `apps/server/src/routes/countryProgressionRoutes.ts`
- content/admin routes that edit event definitions.

### Client

- `apps/client/src/components/CountryEventsModal.tsx`
- `apps/client/src/components/ui/EventStoryModal.tsx`
- `apps/client/src/components/NotificationHistoryModal.tsx`
- `apps/client/src/components/InAppNotificationTray.tsx`
- new journal UI component.

### Scenario Data

- `apps/server/data/scenarios/<scenario_id>/common/events/*.json`
- `apps/server/data/scenarios/<scenario_id>/common/journal_entries/*.json`
- scenario localization files.

### Docs

- `docs/modding-authoring.md`
- `docs/api-ws-versioning.md`
- `docs/error-codes.md`
- `docs/world-model.md`
- `docs/glossary.md`
- Arcawiki/player-facing docs.

## 13. Test Plan

### Unit Tests

- trigger evaluator:
  - all/any/not,
  - country triggers,
  - region triggers,
  - market triggers.
- scope resolver:
  - picks deterministic valid region,
  - skips invalid targets,
  - preserves resolved scope in pending event.
- effect applier:
  - resource ledger entries,
  - modifiers,
  - region effects,
  - event flags,
  - scheduled followups.
- event chain:
  - option schedules next event,
  - option cancels chain,
  - timeout triggers default option.

### Runtime Tests

- generated event appears in `countryEventsByCountryId`;
- world delta includes event changes;
- choosing option updates world state;
- auto-resolve uses default/AI option;
- stale notifications are removed;
- private event only sent to target country.

### Scenario Validation Tests

- valid scoped event passes;
- missing localization fails;
- unknown effect type fails;
- invalid referenced region/law/modifier fails;
- legacy raw label fails.

### UI Tests

- event modal shows affected target;
- event modal shows trigger reason;
- event modal shows option effects;
- blocking event is visibly marked;
- timeout is visible;
- journal event links open journal entry.

## 14. Main Risks

### Scope Explosion

Если сразу добавить все scopes, система станет слишком большой.

Mitigation:

- начать с `country` и `region`,
- потом добавить `market`, `building`, `interest_group`, `pop`.

### Hidden Full-World Scans

События могут стать дорогими на 100-200 AI стран и тысячи регионов.

Mitigation:

- использовать indexes,
- budget per turn,
- checkIntervalTurns,
- event categories,
- candidate prefilters.

### Data Migration Debt

Если оставить старые event fields, появится legacy.

Mitigation:

- один migration script,
- strict validation,
- удалить fallback после миграции.

### UI Overload

Victoria-like event UI может стать перегруженным.

Mitigation:

- основной текст + варианты,
- collapsed sections для reasons/effects,
- tooltips для чисел,
- quick links к affected objects.

## 15. Definition Of Done

Система считается готовой для первого Victoria-like slice, когда:

- событие может выбрать конкретный регион как scope;
- событие объясняет, почему оно произошло;
- option показывает последствия до выбора;
- option применяет effects через shared effect/modifier/resource-ledger systems;
- событие может запланировать follow-up event;
- pending/history сохраняют resolved scopes;
- UI показывает affected object и effect preview;
- все тексты локализованы EN/RU;
- scenario validator запрещает legacy raw event labels;
- world delta/persistence покрыты тестами.

# Decision System Refactor Plan

## Цель

Приблизить решения Arcanorum к модели Victoria 3: решения должны быть активными, data-driven действиями страны, которые используют те же triggers, scopes, effects, modifiers, journal entries и explanation records, что и события.

Решение должно быть не просто кнопкой, которая меняет ресурс, а сценарно-описанным игровым действием:

- появляется при выполнении условий;
- объясняет, почему доступно или недоступно;
- может иметь цель: регион, страна, рынок, журнал, закон, дипломатическая связь;
- может запускать события, journal entries, модификаторы, дипломатические действия, региональные эффекты;
- может быть принято игроком или AI без обхода серверной валидации;
- полностью локализовано и объяснимо игроку.

## Текущее Состояние

Сейчас решения уже существуют:

- `DecisionDefinition` в `packages/shared/src/contracts/content.ts`;
- `CountryDecisionRecord` хранится в `WorldBase.countryDecisionsByCountryId`;
- список решений отдается через `GET /decisions/:countryId`;
- принятие решения идет через `POST /decisions/:countryId/:decisionId/take`;
- UI находится в `CountryDecisionsModal`;
- scenario decisions лежат в `scenarios/<scenario_id>/common/decisions/*.json`.

Текущий формат:

```ts
export type DecisionDefinition = {
  category: DecisionCategory;
  visibilityConditions?: ModifierCondition[];
  availabilityConditions?: ModifierCondition[];
  costs?: DecisionCost;
  effects?: DecisionEffect[];
  cooldownTurns?: number;
  repeatable?: boolean;
};
```

Главные ограничения:

- нет полноценного `potential` / `allow` / `visible_when_unavailable`;
- нет targeted decisions;
- нет scopes;
- нет decision-specific variables/flags;
- effects почти только `resource_delta`;
- нет запуска event chains и journal entries как основной модели;
- история хранит только `decisionId`, `takenTurnId`, `label`;
- недоступность объясняется raw string reason;
- UI показывает cost/effects, но не показывает structured explanation;
- AI не имеет полноценного decision scoring layer;
- сценарные тексты все еще могут быть raw player-facing strings.

## Design Principles

### 1. Decisions Use The Same Scripting Core As Events

Решения, события и journal entries должны использовать общие:

- `Trigger DSL`;
- `Scope Resolver`;
- `GameEffect`;
- `Modifier System`;
- `Explanation Records`;
- localization rules;
- validation rules.

Не создавать отдельные `DecisionOnlyCondition`, `DecisionOnlyEffect`, `DecisionOnlyScope`, если уже есть общий scripting layer.

### 2. Decisions Are Player/AI Actions, Not Passive Events

Отличие решения от события:

- событие генерируется системой;
- решение инициируется игроком или AI;
- решение может быть instant или start/complete timed process;
- решение должно проходить серверную валидацию на момент принятия;
- AI не должен применять решение прямой мутацией мира.

### 3. No Hidden Fallback

Если decision data invalid:

- сервер/валидатор должен ругаться;
- UI не должен молча скрывать проблему;
- нельзя подставлять raw default вроде `"Решение принято"` как gameplay fallback.

### 4. Region-First Heavy Mechanics

Targeted decisions, влияющие на population/buildings/resources/colonization/economy, должны работать на уровне region/state region.

Запрещено добавлять province-level heavy decision effects без отдельного утверждения архитектуры.

## Target Decision Model

## 1. Shared Contracts

Заменить текущий `DecisionDefinition` на расширенный формат.

```ts
export type DecisionDefinition = {
  id: string;
  namespace: string;
  category: DecisionCategory;

  titleKey: string;
  descriptionKey: string;
  iconId?: string | null;
  imageUrl?: string | null;

  scope: DecisionScopeDefinition;

  potential?: TriggerExpression | null;
  allow?: TriggerExpression | null;
  visibleWhenUnavailable?: boolean;

  cost?: GameCostDefinition | null;
  effects: GameEffect[];

  cooldown?: DecisionCooldownDefinition | null;
  repeatable?: boolean;
  maxUses?: number | null;

  confirmation?: DecisionConfirmationDefinition | null;
  ai?: DecisionAiDefinition | null;
  journal?: DecisionJournalLink | null;
};
```

### Required Localization

Каждое решение должно иметь:

```json
{
  "titleKey": "decisions.expand_colonial_office.title",
  "descriptionKey": "decisions.expand_colonial_office.description"
}
```

Опционально:

```json
{
  "confirmation": {
    "titleKey": "decisions.expand_colonial_office.confirm.title",
    "bodyKey": "decisions.expand_colonial_office.confirm.body"
  }
}
```

## 2. Potential, Allow, Visibility

Victoria-like decisions должны различать:

### `potential`

Определяет, существует ли решение для этой страны/цели вообще.

Примеры:

- страна имеет технологию;
- страна является колониальной державой;
- регион контролируется страной;
- journal entry активен;
- закон принадлежит нужной группе.

Если `potential = false`, решение обычно не показывается.

### `allow`

Определяет, можно ли нажать решение сейчас.

Примеры:

- хватает ресурсов;
- cooldown прошел;
- нет активного конфликта;
- регион не занят;
- есть нужный уровень института;
- нет уже активного такого же timed decision.

Если `allow = false`, решение может показываться как locked, если `visibleWhenUnavailable = true`.

### Structured Reasons

Нельзя возвращать raw строку:

```ts
reason = "Не выполнены условия";
```

Нужно:

```ts
export type DecisionAvailabilityReason = {
  code: string;
  labelKey: string;
  passed: boolean;
  currentValue?: number | string | boolean | null;
  requiredValue?: number | string | boolean | null;
  scope?: ResolvedScope | null;
};
```

UI должен показывать список условий с passed/failed состоянием.

## 3. Targeted Decisions

Добавить решения с целью.

### Scope Kinds

Использовать общий scripting scope:

```ts
export type DecisionTargetKind =
  | "country"
  | "region"
  | "foreign_country"
  | "market"
  | "building"
  | "journal_entry"
  | "law"
  | "interest_group";
```

### Country Decision

```json
{
  "scope": {
    "root": { "kind": "country" }
  }
}
```

### Region Decision

```json
{
  "scope": {
    "root": { "kind": "country" },
    "target": {
      "kind": "region",
      "from": "root.controlled_regions",
      "where": {
        "all": [
          { "type": "region_has_population_above", "value": 10000 },
          { "type": "region_has_building", "buildingId": "building:port" }
        ]
      }
    }
  }
}
```

### Foreign Country Decision

```json
{
  "scope": {
    "root": { "kind": "country" },
    "target": {
      "kind": "foreign_country",
      "where": {
        "all": [
          { "type": "relation_above", "value": 25 },
          { "type": "has_active_treaty", "treatyType": "trade" }
        ]
      }
    }
  }
}
```

## 4. Costs

Текущий `DecisionCost = Partial<ResourceTotals>` оставить как compatibility concept, но перейти на общий `GameCostDefinition`.

```ts
export type GameCostDefinition = {
  resources?: Partial<ResourceTotals>;
  authority?: number;
  legitimacy?: number;
  journalProgress?: number;
  custom?: GameEffectCost[];
};
```

Все resource costs должны проходить через resource ledger:

- category: `decision`;
- sourceType: `decision`;
- sourceId: decision id;
- labelKey: decision localization key или стандартный source key.

## 5. Effects

Decision effects должны использовать общий `GameEffect`.

### Required First Effects

Для первого полного среза добавить:

- `add_resource`
- `spend_resource`
- `add_modifier`
- `remove_modifier`
- `trigger_event`
- `schedule_event`
- `start_journal_entry`
- `advance_journal_entry`
- `complete_journal_entry`
- `add_region_modifier`
- `add_country_modifier`
- `change_relation`
- `add_radicals`
- `add_loyalists`
- `start_colonization`

### Later Effects

- `start_diplomatic_play`
- `create_diplomatic_proposal`
- `start_law_enactment`
- `add_law_support`
- `change_interest_group_approval`
- `change_market_access`
- `damage_building`
- `change_building_subsidy`
- `start_construction`
- `change_tax_rate`

### Effect Preview

Каждый effect должен уметь дать preview:

```ts
export type GameEffectPreview = {
  effectType: string;
  labelKey: string;
  value?: number | string | null;
  scope?: ResolvedScope | null;
  severity?: "positive" | "negative" | "neutral";
};
```

UI decisions должен показывать эти previews до принятия решения.

## 6. Timed Decisions

В Victoria 3 часть решений запускает процесс, а не мгновенное изменение.

Добавить:

```ts
export type ActiveTimedDecision = {
  id: string;
  decisionId: string;
  countryId: string;
  startedTurnId: number;
  completesTurnId: number;
  scopes: Record<string, ResolvedScope>;
  state: "active" | "completed" | "cancelled" | "failed";
};
```

World state:

```ts
activeDecisionsByCountryId: Record<string, ActiveTimedDecision[]>
```

Decision definition:

```ts
export type DecisionDurationDefinition = {
  turns: number;
  canCancel?: boolean;
  onStartEffects?: GameEffect[];
  onCompleteEffects?: GameEffect[];
  onCancelEffects?: GameEffect[];
  onFailEffects?: GameEffect[];
  failIf?: TriggerExpression | null;
};
```

Примеры:

- подготовить экспедицию;
- провести перепись;
- создать колониальную администрацию;
- организовать реформу;
- восстановить регион после кризиса.

## 7. Decision Charges And Uses

Добавить поддержку:

- `maxUses`;
- `maxUsesPerCountry`;
- `maxUsesPerTarget`;
- `charges`;
- `rechargeTurns`;
- `cooldownByTarget`.

Пример:

```json
{
  "cooldown": {
    "turns": 10,
    "scope": "target"
  },
  "maxUsesPerTarget": 1
}
```

## 8. Decision Flags And Variables

Добавить:

```ts
countryDecisionFlagsByCountryId
regionDecisionFlagsByRegionId
decisionVariablesByCountryId
```

Использовать для:

- “страна уже выбрала путь индустриализации”;
- “регион уже получил специальную программу”;
- “эта цепочка решений закрыта”;
- “следующее событие зависит от предыдущего выбора”.

Флаги должны быть scenario-visible через trigger DSL.

## 9. Journal Entry Integration

Решения должны быть тесно связаны с journal entries.

### Decision Starts Journal

```json
{
  "effects": [
    {
      "type": "start_journal_entry",
      "journalEntryId": "journal:modernize_army"
    }
  ]
}
```

### Decision Available Only During Journal

```json
{
  "potential": {
    "type": "journal_entry_active",
    "journalEntryId": "journal:modernize_army"
  }
}
```

### Decision Advances Journal

```json
{
  "effects": [
    {
      "type": "advance_journal_entry",
      "journalEntryId": "journal:modernize_army",
      "amount": 10
    }
  ]
}
```

## 10. Event Integration

Решения должны уметь:

- запускать событие сразу;
- планировать событие;
- открывать event chain;
- закрывать event chain;
- задавать event flags.

Пример:

```json
{
  "effects": [
    {
      "type": "trigger_event",
      "eventId": "event:colonial_charter_signed",
      "inheritScopes": true
    }
  ]
}
```

## 11. AI Decision System

Добавить AI scoring.

```ts
export type DecisionAiDefinition = {
  enabled?: boolean;
  baseWeight: number;
  weightRules?: AiWeightRule[];
  maxFrequencyTurns?: number | null;
  budgetCategory?: string | null;
};
```

Пример data:

```json
{
  "ai": {
    "baseWeight": 10,
    "weightRules": [
      {
        "if": {
          "type": "country_resource_below",
          "resource": "ducats",
          "value": 0
        },
        "multiply": 0.1
      },
      {
        "if": {
          "type": "journal_entry_active",
          "journalEntryId": "journal:colonial_expansion"
        },
        "add": 25
      }
    ]
  }
}
```

AI must:

- use the same validated action path as players;
- not bypass costs;
- not ignore cooldowns;
- respect scopes;
- expose admin-only scoring explanation;
- be budgeted for 100-200 AI countries.

## 12. Server Runtime Changes

### New Modules

```text
apps/server/src/mechanics/decisionScopeMechanics.ts
apps/server/src/mechanics/decisionAvailabilityMechanics.ts
apps/server/src/mechanics/decisionEffectMechanics.ts
apps/server/src/mechanics/decisionAiMechanics.ts
apps/server/src/runtime/decisionRuntime.ts
```

Where possible, these should reuse common modules:

```text
eventTriggerMechanics.ts
eventScopeMechanics.ts
eventEffectMechanics.ts
```

Better final naming may be:

```text
scriptTriggerMechanics.ts
scriptScopeMechanics.ts
scriptEffectMechanics.ts
```

This avoids naming reusable code after the first mechanic that uses it.

### Validated Action Path

Current route directly applies decision.

Target:

- route validates auth;
- server creates a `TAKE_DECISION` action/order-like command;
- runtime validates:
  - country ownership/auth,
  - potential,
  - allow,
  - costs,
  - target scope,
  - cooldown,
  - max uses;
- runtime applies effects;
- runtime emits world delta;
- runtime emits explanation records;
- runtime emits audit if admin-triggered.

Whether decisions become formal `ORDER_DELTA` or remain immediate validated actions needs ADR if protocol changes.

## 13. Client UI Changes

### Country Decisions Modal

Replace current simple cards with Victoria-like decision list:

- left: category list / filters;
- center: available decisions;
- right/detail: selected decision;
- bottom/detail: requirements/effects/cooldown/history.

### Decision Card

Each card should show:

- icon/image;
- title;
- category;
- availability state;
- cooldown;
- primary affected scope;
- short effect summary.

### Decision Detail

Detail panel should show:

- description;
- requirements:
  - passed;
  - failed;
  - current value;
  - required value;
- cost;
- effects preview;
- affected target;
- journal/event links;
- cooldown and repeatability;
- confirmation button.

### Target Picker

For targeted decisions:

- region picker;
- foreign country picker;
- market picker;
- journal picker.

Picker must show only valid candidates where `potential` passes, and explain why invalid candidates are locked if shown.

### Tooltip Requirements

Tooltips must explain:

- what each cost means;
- why decision is unavailable;
- why target is valid/invalid;
- exact effects;
- modifiers created/removed;
- event/journal followups.

## 14. Scenario Authoring Format

Example:

```json
{
  "id": "decision:expand_colonial_office",
  "titleKey": "decisions.expand_colonial_office.title",
  "descriptionKey": "decisions.expand_colonial_office.description",
  "category": "colonization",
  "scope": {
    "root": { "kind": "country" }
  },
  "potential": {
    "all": [
      { "type": "country_has_technology", "technologyId": "technology:colonial_administration" }
    ]
  },
  "allow": {
    "all": [
      { "type": "country_resource_above", "resource": "ducats", "value": 100 },
      { "type": "country_resource_above", "resource": "colonization", "value": 50 }
    ]
  },
  "cost": {
    "resources": {
      "ducats": 100,
      "colonization": 50
    }
  },
  "effects": [
    {
      "type": "add_modifier",
      "modifierId": "modifier:expanded_colonial_office",
      "scope": "root",
      "durationTurns": 24
    },
    {
      "type": "trigger_event",
      "eventId": "event:colonial_office_expanded",
      "inheritScopes": true
    }
  ],
  "cooldown": {
    "turns": 24,
    "scope": "country"
  },
  "repeatable": true,
  "confirmation": {
    "titleKey": "decisions.expand_colonial_office.confirm.title",
    "bodyKey": "decisions.expand_colonial_office.confirm.body"
  },
  "ai": {
    "baseWeight": 10,
    "weightRules": [
      {
        "if": {
          "type": "journal_entry_active",
          "journalEntryId": "journal:colonial_expansion"
        },
        "add": 20
      }
    ]
  }
}
```

## 15. Scenario Validation

Validator must reject:

- missing `titleKey`;
- missing `descriptionKey`;
- localization key missing EN/RU;
- unknown trigger type;
- unknown effect type;
- unknown scope reference;
- costs with negative values;
- effects that target unsupported scope;
- raw player-facing `name`, `description`, `label`;
- decision references to missing events/journals/modifiers/laws/technologies/buildings/regions;
- old legacy `visibilityConditions`/`availabilityConditions` after migration deadline.

## 16. Migration Plan

### Phase 1: Add New Contracts

- Add `TriggerExpression`.
- Add `ResolvedScope`.
- Add `GameEffect`.
- Add new `DecisionDefinition`.
- Keep old fields only behind migration tooling, not as runtime fallback.

### Phase 2: Migration Script

Write script:

```text
scripts/migrate-decisions-to-scripted-format.ts
```

It should:

- convert `visibilityConditions` to `potential`;
- convert `availabilityConditions` to `allow`;
- convert `costs` to `cost.resources`;
- convert `resource_delta` effects to `GameEffect`;
- create `titleKey` and `descriptionKey` from existing keys;
- report raw text that must be localized manually.

### Phase 3: Runtime Switch

- Update decision route/runtime to use new evaluator.
- Update `CountryDecisionView`.
- Add structured availability reasons.
- Add effect previews.

### Phase 4: UI Switch

- Update `CountryDecisionsModal`.
- Add target picker.
- Add requirement/effect tooltips.
- Add confirmation modal.

### Phase 5: Remove Legacy

- Remove old `DecisionEffect`.
- Remove old `visibilityConditions`.
- Remove old `availabilityConditions`.
- Update validator to reject old shape.
- Update docs.

### Phase 6: AI

- Add candidate provider for decisions.
- Add AI scoring.
- Submit through validated runtime path.
- Add tests.

## 17. Files Likely To Change

### Shared

- `packages/shared/src/contracts/content.ts`
- `packages/shared/src/contracts/world.ts`
- `packages/shared/src/contracts/ws.ts`
- `packages/shared/src/index.ts`

### Server

- `apps/server/src/mechanics/decisionEventMechanics.ts`
- `apps/server/src/mechanics/contentDefinitionNormalizers.ts`
- `apps/server/src/mechanics/scriptTriggerMechanics.ts`
- `apps/server/src/mechanics/scriptScopeMechanics.ts`
- `apps/server/src/mechanics/scriptEffectMechanics.ts`
- `apps/server/src/runtime/countryProgressionRuntime.ts`
- `apps/server/src/routes/countryProgressionRoutes.ts`
- `apps/server/src/runtime/worldDeltaDiff.ts`
- `apps/server/src/runtime/worldStateNormalizers.ts`
- `apps/server/src/scenarios/scenarioValidation.ts`

### Client

- `apps/client/src/components/CountryDecisionsModal.tsx`
- `apps/client/src/components/ui/EventStoryModal.tsx`
- `apps/client/src/lib/api.ts`
- `apps/client/src/i18n/uiText.ts`
- content admin editing sections in `ContentPanel`.

### Scenario Data

- `apps/server/data/scenarios/<scenario_id>/common/decisions/*.json`
- scenario localization files.

### Docs

- `docs/modding-authoring.md`
- `docs/api-ws-versioning.md`
- `docs/error-codes.md`
- `docs/glossary.md`
- `docs/ai-testing.md`
- Arcawiki decision guide.

## 18. Test Plan

### Unit Tests

- decision potential evaluator;
- decision allow evaluator;
- structured failure reasons;
- resource costs through ledger;
- effect previews;
- target scope resolution;
- cooldown by country;
- cooldown by target;
- max uses;
- timed decision completion;
- journal integration;
- event trigger from decision;
- AI decision scoring.

### Runtime Tests

- available decision can be taken;
- unavailable decision is rejected before mutation;
- targeted region decision applies only to selected region;
- decision emits world delta;
- decision writes explanation records;
- decision history stores scopes/effects;
- timed decision completes on later turn;
- cooldown prevents repeat;
- admin/self auth is enforced.

### Scenario Validation Tests

- valid new decision passes;
- missing localization fails;
- raw text fails;
- invalid effect fails;
- invalid target scope fails;
- missing referenced event/journal/modifier fails;
- old legacy decision shape fails after migration.

### UI Tests

- available/locked/history tabs render;
- failed requirements are visible;
- effects preview is visible;
- target picker shows valid targets;
- confirmation explains consequences;
- cooldown is visible;
- journal/event links work.

## 19. Decision Refactor Risks

### Too Much In One System

Decisions can become a second scripting language.

Mitigation:

- reuse shared script trigger/scope/effect modules;
- avoid decision-only mechanics;
- keep first supported scopes to `country` and `region`.

### AI Overuse

AI could spam repeatable decisions.

Mitigation:

- cooldowns;
- max frequency;
- AI budget category;
- per-turn candidate cap;
- validated costs.

### UI Complexity

Targeted decisions can overload the modal.

Mitigation:

- list first;
- detail panel second;
- target picker only when needed;
- collapsed advanced requirements.

### Migration Debt

Old decision format may linger.

Mitigation:

- migration script;
- strict validator;
- no runtime fallback;
- docs updated immediately.

## 20. Decision Definition Of Done

Decision refactor is complete when:

- all decisions use localization keys;
- old `visibilityConditions`/`availabilityConditions` runtime shape is removed;
- decisions use shared `TriggerExpression`;
- decisions use shared `GameEffect`;
- decisions can target at least country and region scopes;
- UI explains requirements, costs, effects, cooldowns and target;
- decision history stores applied scopes/effects;
- decisions can trigger events and journal entries;
- AI can evaluate and take decisions through validated runtime path;
- scenario validator rejects legacy decision data;
- resource changes go through resource ledger;
- important state changes create explanation records;
- docs and Arcawiki explain how decisions work.

# Journal Entry System Refactor Plan

## Цель

Добавить в Arcanorum полноценную систему Journal Entries в духе Victoria 3.

Journal Entry должен быть не логом событий, а активной государственной задачей/сюжетной линией, которая:

- появляется при выполнении условий;
- имеет цель;
- имеет прогресс;
- может иметь таймер;
- может завершиться успехом или провалом;
- может запускать события;
- может открывать решения;
- может применять модификаторы;
- объясняет игроку, что происходит и что нужно делать дальше.

Journal Entries должны стать связующим слоем между:

- событиями,
- решениями,
- реформами,
- колонизацией,
- индустриализацией,
- региональными кризисами,
- дипломатией,
- военными и политическими задачами.

## Текущее Состояние

В коде сейчас нет отдельной системы Journal Entries.

Есть только:

- `civilopedia.category.journal` как категория Аркавики/журнала событий;
- resource ledger иногда называется journal в документации;
- в этом плане уже есть упоминания journal entries;
- `WorldBase` не содержит `journalEntriesByCountryId`;
- shared contracts не содержат `JournalEntryDefinition`;
- нет `journalMechanics.ts`;
- нет runtime update;
- нет route;
- нет UI панели Journal.

Это значит, что Journal нужно добавлять как новый полноценный слой world state и сценарного контента.

## Design Principles

### 1. Journal Is A Long-Term Gameplay Objective

Journal Entry не должен быть:

- просто notification;
- просто event history;
- просто checklist в UI;
- hidden server state.

Он должен быть активным объектом мира, видимым игроку, с объяснимыми условиями, прогрессом и последствиями.

### 2. Journal Uses Shared Scripting Core

Journal Entries должны использовать те же:

- `TriggerExpression`;
- `ResolvedScope`;
- `GameEffect`;
- `Modifier System`;
- `ExplanationRecord`;
- localization rules;
- validation rules.

Не создавать отдельные `JournalOnlyTrigger` или `JournalOnlyEffect`, если это может быть общим scripting layer.

### 3. Scenario-Owned

Все конкретные journal entries должны жить в сценарии:

```text
apps/server/data/scenarios/<scenario_id>/common/journal_entries/*.json
```

Core code предоставляет runtime, валидатор, UI contract и effect/trigger processing.

### 4. Tooltip-First

Каждый journal entry должен объяснять:

- почему он появился;
- что является целью;
- как считается прогресс;
- что ускоряет прогресс;
- что замедляет или блокирует прогресс;
- какие условия успеха;
- какие условия провала;
- какие последствия успеха;
- какие последствия провала;
- какие решения/события с ним связаны.

### 5. No Legacy

Нельзя использовать Arcawiki journal category или event log как substitute для Journal Entries.

Если вводится новая система, она должна иметь:

- shared contract;
- world state;
- runtime;
- scenario validation;
- UI;
- docs.

## Target Architecture

## 1. Shared Contracts

Добавить в `packages/shared/src/contracts/content.ts`.

```ts
export type JournalEntryDefinition = {
  id: string;
  namespace: string;
  category: JournalCategory;

  titleKey: string;
  descriptionKey: string;
  shortDescriptionKey?: string | null;
  iconId?: string | null;
  imageUrl?: string | null;

  visibility: JournalVisibility;
  priority: JournalPriority;

  scope: JournalScopeDefinition;

  startTrigger?: TriggerExpression | null;
  completeTrigger?: TriggerExpression | null;
  failTrigger?: TriggerExpression | null;
  cancelTrigger?: TriggerExpression | null;

  progress?: JournalProgressDefinition | null;
  timeoutTurns?: number | null;

  onStartEffects?: GameEffect[];
  onCompleteEffects?: GameEffect[];
  onFailEffects?: GameEffect[];
  onCancelEffects?: GameEffect[];

  events?: JournalEventHooks | null;
  decisions?: JournalDecisionHooks | null;
  modifiers?: JournalModifierHooks | null;

  repeatable?: boolean;
  cooldownTurns?: number;
};
```

### Supporting Types

```ts
export type JournalVisibility = "public" | "private";
export type JournalPriority = "low" | "medium" | "high" | "critical";

export type JournalCategory =
  | "politics"
  | "economy"
  | "military"
  | "diplomacy"
  | "colonization"
  | "technology"
  | "society"
  | "regional"
  | "crisis";
```

## 2. World State

Добавить в `packages/shared/src/contracts/world.ts`:

```ts
export type CountryJournalState = {
  active: ActiveJournalEntry[];
  completedJournalEntryIds: string[];
  failedJournalEntryIds: string[];
  cooldownUntilTurnByJournalEntryId: Record<string, number>;
  history: JournalEntryHistoryRecord[];
};

export type ActiveJournalEntry = {
  id: string;
  journalEntryId: string;
  countryId: string;
  startedTurnId: number;
  expiresTurnId?: number | null;
  state: "active";
  progress: JournalProgressState;
  scopes: Record<string, ResolvedScope>;
  variables: Record<string, number | string | boolean>;
  lastUpdatedTurnId: number;
  explanationIds: string[];
};

export type JournalProgressState = {
  current: number;
  target: number;
  percent: number;
  labelKey: string;
  lastDelta?: number | null;
};

export type JournalEntryHistoryRecord = {
  journalEntryId: string;
  instanceId: string;
  state: "completed" | "failed" | "cancelled";
  startedTurnId: number;
  resolvedTurnId: number;
  scopes: Record<string, ResolvedScope>;
  outcomeLabelKey: string;
  explanationIds: string[];
};
```

Добавить в `WorldBase`:

```ts
journalEntriesByCountryId: Record<string, CountryJournalState>;
```

Добавить `WORLD_DELTA_MASK.journalEntriesByCountryId`.

Добавить компактное поле в `WorldDelta`, например:

```ts
jo?: Record<string, CountryJournalState | null>;
```

## 3. Journal Scopes

Journal Entry должен иметь resolved scopes.

Примеры:

### Country Scope

```json
{
  "scope": {
    "root": { "kind": "country" }
  }
}
```

### Region Scope

```json
{
  "scope": {
    "root": { "kind": "country" },
    "targetRegion": {
      "kind": "region",
      "from": "root.controlled_regions",
      "where": {
        "all": [
          { "type": "region_standard_of_living_below", "value": 8 },
          { "type": "region_radicals_above", "value": 1000 }
        ]
      },
      "pick": {
        "orderBy": "radicals",
        "direction": "desc"
      }
    }
  }
}
```

### Foreign Country Scope

```json
{
  "scope": {
    "root": { "kind": "country" },
    "targetCountry": {
      "kind": "foreign_country",
      "where": {
        "all": [
          { "type": "relation_below", "value": -25 }
        ]
      }
    }
  }
}
```

First implementation should support:

- `country`;
- `region`.

Later:

- `foreign_country`;
- `market`;
- `building`;
- `interest_group`;
- `law`;
- `war`.

## 4. Journal Lifecycle

Journal runtime runs during turn resolve.

Order:

1. Normalize journal state.
2. Start new journal entries where `startTrigger` passes.
3. Apply `onStartEffects`.
4. Update active progress.
5. Check `completeTrigger`.
6. Check `failTrigger`.
7. Check `cancelTrigger`.
8. Check timeout.
9. Resolve completed/failed/cancelled entries.
10. Apply outcome effects.
11. Trigger related events.
12. Unlock/hide linked decisions.
13. Emit explanation records.
14. Emit world delta.
15. Emit UI notifications.

Important:

- Journal start should not duplicate active non-repeatable entries.
- Completed non-repeatable entries should not restart.
- Cooldown should prevent immediate repeat.
- Timeout should be deterministic.
- Runtime must avoid full-world scans.

## 5. Journal Progress

Support multiple progress types.

### Manual Progress

Progress changes only through effects:

```json
{
  "progress": {
    "type": "manual",
    "target": 100,
    "labelKey": "journal.progress.reform_support"
  }
}
```

Effect:

```json
{
  "type": "advance_journal_entry",
  "journalEntryId": "journal:modernize_army",
  "amount": 10
}
```

### Value Ratio

Progress is calculated from world state.

```json
{
  "progress": {
    "type": "value_ratio",
    "current": {
      "type": "count_regions_with_building",
      "buildingId": "building:university"
    },
    "target": 5,
    "labelKey": "journal.progress.universities_built"
  }
}
```

### Accumulate Per Turn

Progress accumulates from a per-turn source.

```json
{
  "progress": {
    "type": "accumulate_per_turn",
    "source": {
      "type": "country_resource_generation",
      "resource": "science"
    },
    "target": 1000,
    "labelKey": "journal.progress.science_accumulated"
  }
}
```

### Region Count

```json
{
  "progress": {
    "type": "count_scoped_regions",
    "where": {
      "all": [
        { "type": "region_has_building", "buildingId": "building:factory" }
      ]
    },
    "target": 3,
    "labelKey": "journal.progress.industrial_regions"
  }
}
```

## 6. Journal Effects

Add these `GameEffect` types:

- `start_journal_entry`;
- `advance_journal_entry`;
- `set_journal_progress`;
- `complete_journal_entry`;
- `fail_journal_entry`;
- `cancel_journal_entry`;
- `set_journal_variable`;
- `clear_journal_variable`;

Example:

```json
{
  "type": "start_journal_entry",
  "journalEntryId": "journal:colonial_expansion",
  "inheritScopes": true
}
```

Example variable:

```json
{
  "type": "set_journal_variable",
  "journalEntryId": "journal:colonial_expansion",
  "key": "expeditionFunded",
  "value": true
}
```

## 7. Event Integration

Journal entries can trigger events:

```ts
export type JournalEventHooks = {
  onStart?: string[];
  onComplete?: string[];
  onFail?: string[];
  onCancel?: string[];
  periodic?: Array<{
    eventId: string;
    everyTurns: number;
    chancePct?: number;
    trigger?: TriggerExpression | null;
  }>;
};
```

Example:

```json
{
  "events": {
    "onStart": ["event:colonial_ambitions_begin"],
    "periodic": [
      {
        "eventId": "event:colonial_funding_debate",
        "everyTurns": 5,
        "chancePct": 30
      }
    ],
    "onComplete": ["event:colonial_charter_success"],
    "onFail": ["event:colonial_charter_failure"]
  }
}
```

Triggered events should inherit journal scopes when configured.

## 8. Decision Integration

Journal entries can unlock or contextualize decisions.

```ts
export type JournalDecisionHooks = {
  unlockDecisionIds?: string[];
  hideDecisionIds?: string[];
  recommendedDecisionIds?: string[];
};
```

Decision `potential` may check:

```json
{
  "type": "journal_entry_active",
  "journalEntryId": "journal:modernize_army"
}
```

Decision effects may advance or complete journal entries.

## 9. Modifier Integration

Journal entries can apply modifiers while active.

```ts
export type JournalModifierHooks = {
  whileActive?: Array<{
    modifierId: string;
    scope: string;
  }>;
};
```

Examples:

- active crisis lowers legitimacy;
- active industrialization increases construction cost but improves throughput;
- active colonial push increases colonization gain.

Modifiers must use the shared modifier system.

## 10. AI Integration

AI should use journal entries as long-term strategic goals.

Add:

```ts
export type JournalAiDefinition = {
  priority: number;
  strategyTags?: string[];
  recommendedDecisionWeights?: Record<string, number>;
  desiredProgressPerTurn?: number | null;
};
```

AI behavior:

- active journal entries influence decision scoring;
- active journal entries influence colonization/building/research priorities;
- AI should prefer actions that advance active journals;
- AI should avoid starting journals it cannot realistically progress;
- AI debug explanation should show which journal influenced a decision.

## 11. Server Modules

Add:

```text
apps/server/src/mechanics/journalMechanics.ts
apps/server/src/mechanics/journalProgressMechanics.ts
apps/server/src/runtime/journalRuntime.ts
```

Prefer reusable names if shared with events/decisions:

```text
apps/server/src/mechanics/scriptTriggerMechanics.ts
apps/server/src/mechanics/scriptScopeMechanics.ts
apps/server/src/mechanics/scriptEffectMechanics.ts
```

Journal runtime responsibilities:

- ensure country journal state;
- start journals;
- update progress;
- resolve completion/failure;
- apply effects;
- produce UI notifications;
- produce explanation records;
- produce world delta-compatible state changes.

## 12. Routes/API

Add routes:

```text
GET /journal/:countryId
POST /journal/:countryId/:instanceId/track
POST /journal/:countryId/:instanceId/untrack
```

Optional admin/debug:

```text
POST /admin/journal/:countryId/:journalEntryId/start
POST /admin/journal/:countryId/:instanceId/complete
POST /admin/journal/:countryId/:instanceId/fail
```

Admin routes require:

- server-side permission;
- audit log;
- stable error codes;
- localized confirmation in UI.

## 13. Client UI

Add `CountryJournalModal`.

### Main Tabs

- Active;
- Completed;
- Failed;
- Available/Upcoming if design needs it later.

### Active Journal Card

Show:

- icon/image;
- title;
- category;
- priority;
- progress bar;
- current/target values;
- turns remaining;
- primary affected scope;
- latest progress delta;
- linked decisions;
- linked events.

### Journal Detail

Show:

- description;
- why it started;
- success conditions;
- failure conditions;
- progress explanation;
- active modifiers;
- completion rewards;
- failure consequences;
- linked map target;
- history/explanation records.

### Workspace Integration

Add a Journal tab/action in strategy shell:

- count active journals;
- count critical journals;
- show nearest deadline;
- quick-open journal modal.

### Notifications

Add notification types:

- journal started;
- journal progressed;
- journal completed;
- journal failed;
- journal deadline near.

## 14. Scenario Authoring

Example journal:

```json
{
  "id": "journal:colonial_expansion",
  "namespace": "balanced_economy",
  "category": "colonization",
  "titleKey": "journal.colonial_expansion.title",
  "descriptionKey": "journal.colonial_expansion.description",
  "visibility": "private",
  "priority": "high",
  "scope": {
    "root": { "kind": "country" }
  },
  "startTrigger": {
    "all": [
      { "type": "country_has_technology", "technologyId": "technology:colonial_administration" },
      { "type": "country_resource_above", "resource": "colonization", "value": 100 }
    ]
  },
  "progress": {
    "type": "value_ratio",
    "current": {
      "type": "count_owned_colonies"
    },
    "target": 3,
    "labelKey": "journal.colonial_expansion.progress"
  },
  "completeTrigger": {
    "type": "country_owned_colonies_above",
    "value": 2
  },
  "timeoutTurns": 60,
  "onCompleteEffects": [
    {
      "type": "add_modifier",
      "modifierId": "modifier:colonial_prestige",
      "scope": "root",
      "durationTurns": 120
    },
    {
      "type": "trigger_event",
      "eventId": "event:colonial_charter_success",
      "inheritScopes": true
    }
  ],
  "onFailEffects": [
    {
      "type": "trigger_event",
      "eventId": "event:colonial_charter_failure",
      "inheritScopes": true
    }
  ],
  "events": {
    "periodic": [
      {
        "eventId": "event:colonial_funding_debate",
        "everyTurns": 8,
        "chancePct": 30
      }
    ]
  },
  "decisions": {
    "recommendedDecisionIds": [
      "decision:expand_colonial_office"
    ]
  },
  "repeatable": false,
  "cooldownTurns": 0
}
```

## 15. Scenario Validation

Validator must check:

- journal id stable and unique;
- `titleKey` exists EN/RU;
- `descriptionKey` exists EN/RU;
- category valid;
- priority valid;
- scope valid;
- triggers valid;
- progress definition valid;
- referenced events exist;
- referenced decisions exist;
- referenced modifiers exist;
- referenced technologies/laws/buildings/regions exist;
- no raw player-facing text;
- no unsupported province-level heavy mechanics;
- no unknown effect types;
- no missing localization for progress labels.

## 16. Persistence And Delta

Add journal state to:

- default world base;
- world state normalizer;
- persisted world base restore;
- world delta diff;
- client store delta apply;
- deletion cleanup when country is deleted.

Delta must be compact:

- send only changed country journal state;
- do not send full world unless snapshot/resync;
- preserve ACK/replay behavior.

## 17. Migration Plan

### Phase 1: Contracts

- Add `JournalEntryDefinition`.
- Add `CountryJournalState`.
- Add `journalEntriesByCountryId` to `WorldBase`.
- Add world delta mask.

### Phase 2: Loader And Validation

- Add `common/journal_entries/*.json`.
- Add scenario loader support.
- Add strict validation.
- Add docs.

### Phase 3: Runtime

- Add journal runtime.
- Start journals by trigger.
- Update progress.
- Complete/fail by trigger.
- Emit notifications/news.

### Phase 4: Effects

- Add journal `GameEffect` types.
- Let decisions start/advance journals.
- Let events start/advance journals.

### Phase 5: UI

- Add `CountryJournalModal`.
- Add strategy shell journal entry point.
- Add notification handling.
- Add progress/explanation tooltips.

### Phase 6: AI

- Add journal priorities to AI.
- Journal influences decisions/building/research/colonization.
- Add admin-only AI journal explanation.

## 18. Files Likely To Change

### Shared

- `packages/shared/src/contracts/content.ts`
- `packages/shared/src/contracts/world.ts`
- `packages/shared/src/contracts/ws.ts`
- `packages/shared/src/index.ts`

### Server

- `apps/server/src/mechanics/journalMechanics.ts`
- `apps/server/src/mechanics/journalProgressMechanics.ts`
- `apps/server/src/mechanics/scriptTriggerMechanics.ts`
- `apps/server/src/mechanics/scriptScopeMechanics.ts`
- `apps/server/src/mechanics/scriptEffectMechanics.ts`
- `apps/server/src/runtime/journalRuntime.ts`
- `apps/server/src/runtime/turnRuntime.ts`
- `apps/server/src/runtime/worldDeltaDiff.ts`
- `apps/server/src/runtime/worldStateNormalizers.ts`
- `apps/server/src/runtime/persistedWorldBaseRestore.ts`
- `apps/server/src/scenarios/scenarioRuntimeLoader.ts`
- `apps/server/src/scenarios/scenarioValidation.ts`
- `apps/server/src/lifecycle/countryDeletionCleanup.ts`

### Client

- `apps/client/src/components/CountryJournalModal.tsx`
- `apps/client/src/components/strategy-shell/StrategyShell.tsx`
- `apps/client/src/components/InAppNotificationTray.tsx`
- `apps/client/src/components/NotificationHistoryModal.tsx`
- `apps/client/src/store/gameStore.ts`
- `apps/client/src/lib/api.ts`
- `apps/client/src/i18n/uiText.ts`

### Scenario Data

- `apps/server/data/scenarios/<scenario_id>/common/journal_entries/*.json`
- scenario localization files.

### Docs

- `docs/modding-authoring.md`
- `docs/api-ws-versioning.md`
- `docs/error-codes.md`
- `docs/glossary.md`
- `docs/world-model.md`
- Arcawiki journal guide.

## 19. Test Plan

### Unit Tests

- journal start trigger passes/fails;
- journal does not duplicate active entry;
- non-repeatable completed journal does not restart;
- cooldown prevents restart;
- progress updates correctly;
- timeout fails journal;
- complete trigger resolves journal;
- fail trigger resolves journal;
- onStart/onComplete/onFail effects apply;
- periodic event hook schedules/triggers events;
- decision effect advances journal;
- event effect advances journal.

### Runtime Tests

- turn resolve starts journal;
- turn resolve updates progress;
- turn resolve completes journal;
- world delta includes journal state;
- persistence restore keeps active journals;
- country deletion removes journal state;
- UI notification is sent only to target country.

### Scenario Validation Tests

- valid journal passes;
- missing localization fails;
- invalid progress definition fails;
- missing event reference fails;
- missing decision reference fails;
- missing modifier reference fails;
- unsupported trigger fails;
- raw player-facing text fails.

### UI Tests

- journal modal lists active entries;
- progress bar renders correct percent;
- completed/failed history renders;
- linked decision opens decision modal;
- linked event opens event modal/history;
- tooltip explains progress;
- critical journal is visually distinct.

## 20. Journal Risks

### Runtime Cost

Journal checks can become expensive if every journal scans every region every turn.

Mitigation:

- check intervals;
- indexed candidate lists;
- country-first filtering;
- limited active journals;
- deterministic scope resolver;
- metrics for journal runtime duration.

### Too Much UI Noise

Too many journals can overwhelm the player.

Mitigation:

- priorities;
- tracked/untracked journals;
- critical only in notifications;
- journal categories;
- compact strategy shell summary.

### Scripting Complexity

Journal, event, and decision scripting can fragment.

Mitigation:

- one shared scripting core;
- no duplicated condition/effect systems;
- strong docs;
- strict validation.

### Save Compatibility

Adding journal world state affects persistence and deltas.

Mitigation:

- normalizers default missing journal state to empty;
- migration notes;
- delta tests;
- replay tests.

## 21. Journal Definition Of Done

Journal system is complete for first Victoria-like slice when:

- scenario can define journal entries in `common/journal_entries`;
- shared contract includes `JournalEntryDefinition`;
- `WorldBase` includes `journalEntriesByCountryId`;
- world delta supports journal state;
- turn runtime starts, updates, completes and fails journals;
- journal progress is visible and explained;
- decisions can start/advance journal entries;
- events can start/advance journal entries;
- journal can trigger events on start/complete/fail;
- journal UI exists;
- strategy shell shows active/critical journal summary;
- all journal text uses EN/RU localization keys;
- validator rejects invalid/legacy/raw journal data;
- tests cover start/progress/complete/fail/delta/persistence;
- docs and Arcawiki explain journal entries to authors and players.

# Politics System Refactor Plan

Status: Planned.

This plan covers Victoria-like government, elections, political parties, political movements, revolutions, interest groups, ideologies, and characters.

The goal is not to clone Victoria 3 mechanically one-to-one. The goal is to move Arcanorum from a simple parliament/law panel toward a political simulation where population, interest groups, parties, leaders, laws, legitimacy, political pressure, and revolutionary risk all explain each other through visible state, tooltips, scenario-authored data, shared modifiers, and structured explanation records.

## 1. Politics Design Goals

Politics must become a first-class country system.

The target model:

- population and buildings create political power;
- political power flows into interest groups;
- interest groups have approval, clout, ideologies, leaders, traits, demands, and party alignment;
- political parties are coalitions of interest groups, not only static seat containers;
- elections convert eligible political support into party votes and seats;
- government formation chooses ruling groups/parties and produces legitimacy;
- legitimacy affects law enactment, unrest, radicalism, and government stability;
- laws alter political rules, voting rights, institutions, authority, and state capacity;
- political movements organize pressure for or against laws;
- radicalized movements can become revolutionary crises;
- characters personalize politics through rulers, leaders, agitators, generals, and traits;
- every visible value has tooltips and explanation records.

The system must stay compatible with Arcanorum's project direction:

- heavy politics is country and region-level, not province-level;
- all concrete political content belongs to scenarios;
- no root legacy content library;
- no hidden hardcoded political content in core simulation;
- server remains authoritative;
- AI uses validated orders and normal runtime paths;
- no visible text without localization keys in English and Russian;
- no important visible calculation without tooltip/explanation support.

## 2. Current Baseline

Arcanorum already has an initial political skeleton:

- `CountryParliament`;
- `CountryParliamentParty`;
- `CountryParliamentBill`;
- `CountryInterestGroup`;
- parliament powers;
- party seats and vote share;
- government party ids;
- law enactment bills;
- interest group clout/raw power;
- politics UI with parliament, parties, laws, and interest group information.

This is a useful base, but it is still too narrow:

- government is mostly a list of party ids;
- legitimacy is not a full central mechanic;
- interest groups do not yet have complete approval/traits/leader behavior;
- parties are not dynamic political coalitions;
- elections do not yet have campaign phases, momentum, or rich voter sources;
- political movements are not first-class state;
- revolutions are not first-class state;
- characters are not central to political simulation;
- ideologies are not yet a reusable preference bundle across groups, leaders, parties, and movements;
- tooltips/explanations must be expanded before politics becomes more complex.

## 3. Target Shared State

Politics should be represented with explicit shared contracts.

Proposed high-level world state additions:

```ts
type WorldPoliticsState = {
  governmentByCountry: Record<string, CountryGovernmentState>;
  electionsByCountry: Record<string, CountryElectionState>;
  politicalPartiesByCountry: Record<string, CountryPoliticalPartyState[]>;
  interestGroupsByCountry: Record<string, CountryInterestGroupState[]>;
  politicalMovementsByCountry: Record<string, CountryPoliticalMovementState[]>;
  revolutionsByCountry: Record<string, CountryRevolutionState[]>;
  charactersById: Record<string, CharacterState>;
  characterIdsByCountry: Record<string, string[]>;
};
```

This does not require introducing all maps at once. The migration should be phased, but the final shape should be explicit enough that UI, AI, persistence, and world deltas do not need to infer politics from scattered parliament fields.

Existing `parliamentByCountry` can remain during the migration, but the final architecture should either:

- fold parliament into `governmentByCountry` and `electionsByCountry`, or
- keep parliament as one submodel of country politics with a clear responsibility.

Do not add a parallel legacy politics model. Any transitional compatibility must be documented and removed by a named phase.

## 4. Government

Government should model who rules, how legitimate they are, and what political consequences that has.

### Target State

```ts
type CountryGovernmentState = {
  countryId: string;
  governmentTypeLawId: string;
  distributionOfPowerLawId: string;
  rulingPartyIds: string[];
  rulingInterestGroupIds: string[];
  oppositionInterestGroupIds: string[];
  legitimacy: number;
  legitimacyLevel: "illegitimate" | "contested" | "legitimate" | "strong";
  reformCooldownUntilTurn?: number | null;
  lastReformedTurnId?: number | null;
  explanationIds: string[];
};
```

### Legitimacy

Legitimacy should become a central calculated value.

Inputs:

- ruling party seat share;
- ruling interest group clout;
- ideological coherence between ruling groups;
- active laws;
- ruler popularity;
- government size;
- recent election result;
- turmoil/radicalism;
- scripted modifiers.

Outputs:

- law enactment speed;
- law enactment success chance;
- movement radicalism;
- interest group approval drift;
- revolution risk;
- event trigger weights;
- AI government reform scoring.

Legitimacy must be tooltip-first:

- what legitimacy means;
- current score;
- positive sources;
- negative sources;
- active modifiers;
- gameplay effects at the current level.

### Government Reform

Government reform should be a normal country action/order.

The server validates:

- country control;
- allowed ruling groups/parties;
- active law constraints;
- cooldown;
- minimum/maximum government size;
- no invalid party/group references.

The result:

- updates ruling parties/groups;
- recalculates legitimacy;
- may alter interest group approval;
- may affect political movement radicalism;
- emits explanation records;
- sends world delta.

### Government Effects

Government should affect:

- law enactment;
- authority/bureaucracy style resources if present in scenario;
- political movement pressure;
- revolution progress;
- election messaging;
- AI strategy.

Concrete effects must be emitted through modifiers or resource ledgers where relevant, not hardcoded branches.

## 5. Elections

Elections should become a staged runtime system instead of only a periodic seat refresh.

### Election Phases

```ts
type CountryElectionState = {
  countryId: string;
  status: "inactive" | "campaign" | "voting" | "results" | "government_formation";
  electionId: string;
  startedTurnId?: number | null;
  votingTurnId?: number | null;
  resultsTurnId?: number | null;
  nextElectionTurnId: number;
  campaignMomentumByPartyId: Record<string, number>;
  predictedVoteShareByPartyId: Record<string, number>;
  finalVoteShareByPartyId?: Record<string, number>;
  finalSeatsByPartyId?: Record<string, number>;
  explanationIds: string[];
};
```

### Vote Sources

Votes should be derived from:

- population political strength;
- interest group support;
- party alignment;
- voting law;
- discrimination and enfranchisement rules;
- literacy/education if scenario exposes it;
- radicals/loyalists;
- party campaign momentum;
- leader popularity;
- scripted modifiers.

Voting law should control who votes and how strongly:

- no elections;
- landed voting;
- wealth voting;
- census-style voting;
- universal voting;
- council/communal alternatives if scenario defines them.

The exact laws are scenario content. Core code supplies reusable voting mechanics and validators.

### Campaign Momentum

During campaign phase:

- events can change party momentum;
- movements can boost issue parties;
- popular leaders can shift support;
- scandals can reduce support;
- war/economic crisis can penalize ruling parties.

Momentum must be deterministic and explainable.

### Election Results

Results should:

- update party vote share;
- allocate seats;
- recalculate possible government combinations;
- affect legitimacy expectations;
- create election result explanation records;
- trigger events or journal progress;
- notify players through localized UI.

## 6. Political Parties

Political parties should be dynamic coalitions of interest groups.

### Target State

```ts
type CountryPoliticalPartyState = {
  partyId: string;
  countryId: string;
  memberInterestGroupIds: string[];
  leaderCharacterId?: string | null;
  voteShare: number;
  seats: number;
  platformLawIds: string[];
  campaignMomentum: number;
  ideologyAffinity: Record<string, number>;
  isActive: boolean;
  explanationIds: string[];
};
```

### Party Formation

Parties should form from rules:

- compatible ideologies;
- compatible law preferences;
- leader ideology;
- interest group clout;
- voting laws;
- scenario-authored party templates;
- recent political movements;
- existing historical party identity.

Scenario data can define:

- historical parties;
- party names and localization keys;
- party colors and icons;
- allowed/blocked interest groups;
- ideology affinity;
- starting party memberships;
- dynamic formation rules.

Core runtime should not hardcode parties like "liberals" or "conservatives".

### Party Platforms

Party platform should be a small set of laws or issues the party currently emphasizes.

Platform sources:

- member group demands;
- leader ideology;
- political movements;
- campaign events;
- scenario scripting.

Platform affects:

- campaign support;
- law voting;
- government legitimacy;
- movement support;
- AI law priorities.

## 7. Interest Groups

Interest groups should become the primary bridge between population and politics.

### Target State

```ts
type CountryInterestGroupState = {
  groupId: string;
  countryId: string;
  clout: number;
  rawPower: number;
  approval: number;
  approvalLevel: "angry" | "unhappy" | "neutral" | "happy" | "loyal";
  loyalists: number;
  radicals: number;
  supportedPartyId?: string | null;
  leaderCharacterId?: string | null;
  ideologyIds: string[];
  activeTraitIds: string[];
  inGovernment: boolean;
  isPowerful: boolean;
  isMarginalized: boolean;
  explanationIds: string[];
};
```

### Clout

Clout should come from:

- politically active population;
- wealth/income;
- profession mix;
- buildings;
- laws;
- institutions;
- discrimination;
- modifiers;
- character traits;
- region ownership/control effects where relevant.

Clout calculation must avoid unbounded full-world scans in hot paths. Region and population indexes should be used when possible.

### Approval

Approval should come from:

- active laws;
- recent law changes;
- government inclusion/exclusion;
- ruler/leader ideology;
- events;
- decisions;
- movements;
- war/economy outcomes;
- modifiers.

Approval effects:

- high approval grants positive modifiers;
- low approval grants penalties;
- angry powerful groups can support movements/revolutions;
- approval influences party loyalty and election behavior.

All approval changes must create explanation records.

### Traits

Interest group traits should be scenario-authored content:

```json
{
  "id": "trait:industrialists_investment_drive",
  "nameLocKey": "interest_group_trait.industrialists_investment_drive.name",
  "descriptionLocKey": "interest_group_trait.industrialists_investment_drive.description",
  "activation": {
    "approvalAtLeast": 10,
    "cloutAtLeast": 5
  },
  "modifiers": [
    {
      "target": "country.construction_efficiency",
      "operation": "multiply",
      "value": 1.05,
      "source": "interest_group_trait:industrialists_investment_drive"
    }
  ]
}
```

Traits must use the shared modifier system.

## 8. Ideology

Ideology should be a reusable preference bundle used by interest groups, characters, parties, movements, and events.

### Definition

```json
{
  "id": "ideology:liberal",
  "nameLocKey": "ideology.liberal.name",
  "descriptionLocKey": "ideology.liberal.description",
  "lawStances": [
    {
      "lawGroupId": "law_group:distribution_of_power",
      "preferredLawIds": ["law:census_suffrage", "law:universal_suffrage"],
      "opposedLawIds": ["law:autocracy"]
    }
  ],
  "movementBehavior": {
    "supportMultiplier": 1.0,
    "radicalismMultiplier": 1.0
  },
  "modifiers": []
}
```

### Uses

Ideologies should influence:

- law support/opposition;
- party formation;
- movement creation;
- movement radicalism;
- election support;
- character behavior;
- interest group approval;
- AI political priorities.

Ideology data belongs under scenario content, for example:

- `scenarios/<scenario_id>/common/ideologies/*.json`.

Core code validates shape and resolves references. It does not define concrete ideological doctrine in TypeScript.

## 9. Characters

Characters should personalize politics and provide persistent political actors.

### Target State

```ts
type CharacterState = {
  characterId: string;
  countryId: string;
  nameLocKey: string;
  roleIds: CharacterRoleId[];
  ideologyIds: string[];
  traitIds: string[];
  popularity: number;
  age?: number | null;
  cultureId?: string | null;
  religionId?: string | null;
  interestGroupId?: string | null;
  partyId?: string | null;
  isAlive: boolean;
  enteredTurnId: number;
  retiredTurnId?: number | null;
};
```

Potential roles:

- ruler;
- heir;
- head of government;
- interest group leader;
- party leader;
- agitator;
- general;
- admiral;
- revolutionary leader.

### Character Effects

Characters can affect:

- interest group approval;
- party momentum;
- legitimacy;
- law preferences;
- movement support;
- revolution escalation;
- military loyalty;
- event weights.

Character traits must be scenario data and must use modifiers/effects:

- `common/character_traits/*.json`;
- no hardcoded trait-specific simulation branches.

### Lifecycle

Character lifecycle should include:

- scenario-start characters;
- generated replacement leaders when needed;
- retirement;
- death;
- role reassignment;
- event-driven appearance;
- validation for missing required roles.

Generation must be deterministic from world seed/turn/country where possible.

## 10. Political Movements

Political movements should represent organized pressure around laws or political demands.

### Target State

```ts
type CountryPoliticalMovementState = {
  movementId: string;
  countryId: string;
  type: "enact_law" | "preserve_law" | "restore_law";
  targetLawId: string;
  supportingInterestGroupIds: string[];
  supportingCharacterIds: string[];
  support: number;
  radicalism: number;
  momentum: number;
  status: "active" | "declining" | "radicalizing" | "revolutionary";
  startedTurnId: number;
  explanationIds: string[];
};
```

### Creation

Movements can be created by:

- powerful unhappy interest groups;
- large radical populations;
- failed law enactment;
- hated active law;
- event effects;
- journal entries;
- decisions;
- agitators;
- external diplomatic influence later.

### Effects

Movements should:

- increase pressure to enact or preserve laws;
- affect law enactment success/failure chances;
- create events;
- appear in country problems/notifications;
- increase radicalism if ignored;
- decay if their support collapses;
- escalate into revolution when radicalism and support pass thresholds.

### UI Requirements

Movement UI must show:

- demand;
- supporting groups;
- supporting characters;
- support;
- radicalism;
- trend;
- likely consequences;
- what will reduce or increase it.

No hidden movement math is acceptable.

## 11. Revolutions

Revolutions should be a political crisis state before they become military conflict.

### Target State

```ts
type CountryRevolutionState = {
  revolutionId: string;
  countryId: string;
  sourceMovementId?: string | null;
  targetLawId?: string | null;
  supportingInterestGroupIds: string[];
  supportingCharacterIds: string[];
  radicalism: number;
  progress: number;
  loyalistStrength: number;
  revolutionaryStrength: number;
  possibleRegionIds: string[];
  status: "brewing" | "escalating" | "active" | "resolved";
  startedTurnId: number;
  explanationIds: string[];
};
```

### Escalation

Revolution progress should increase from:

- radical political movement support;
- low legitimacy;
- powerful angry interest groups;
- high radicals;
- event outcomes;
- failed repression;
- economic crisis;
- discriminatory laws;
- military loyalty shifts.

It should decrease from:

- passing demanded law;
- reforming government;
- improving legitimacy;
- concessions/events;
- reducing radicals;
- loyal powerful groups;
- modifiers.

### First Implementation Slice

The first slice does not need full civil war.

Minimum viable revolution:

- movement can become revolutionary;
- revolution has progress and strength;
- player sees warning and causes;
- events can fire;
- government can concede or resist through validated orders;
- if progress completes, the revolution can force a law/government change through server-authoritative resolver;
- later slice can convert active revolution into civil war/diplomatic play/region control conflict.

Do not directly mutate region ownership/control for revolution without a separate approved warfare/civil-war design.

## 12. Law Enactment Integration

Existing law bills should be connected to the new politics model.

Law enactment should depend on:

- legitimacy;
- government interest groups;
- party seats;
- interest group clout;
- interest group approval;
- leader ideology;
- political movements;
- revolution pressure;
- law difficulty;
- active institutions/modifiers;
- events.

The law flow should support:

- start enactment;
- debate phase;
- success;
- stall;
- setback;
- failure;
- event pulse;
- movement pressure;
- radicalism effects.

Each active law attempt needs a tooltip showing:

- base chance;
- legitimacy contribution;
- party/parliament contribution;
- interest group support;
- movement pressure;
- modifiers;
- possible outcomes.

## 13. Scenario Data Model

Politics content must be scenario-owned.

Recommended folders:

- `scenarios/<scenario_id>/common/interest_groups/*.json`;
- `scenarios/<scenario_id>/common/interest_group_traits/*.json`;
- `scenarios/<scenario_id>/common/ideologies/*.json`;
- `scenarios/<scenario_id>/common/political_parties/*.json`;
- `scenarios/<scenario_id>/common/party_formation_rules/*.json`;
- `scenarios/<scenario_id>/common/character_traits/*.json`;
- `scenarios/<scenario_id>/history/characters/*.json`;
- `scenarios/<scenario_id>/history/politics/*.json`;
- `scenarios/<scenario_id>/common/political_movements/*.json` only for reusable scripted movement templates, not active world state.

All files must:

- be strict JSON;
- have authoritative `id`;
- use localization keys;
- reference stable ids;
- validate all references;
- avoid root content-library fallback;
- avoid hidden defaults for gameplay content.

## 14. Runtime Architecture

The politics runtime should be split by responsibility.

Candidate modules:

- `interestGroupMechanics.ts`;
- `governmentMechanics.ts`;
- `electionMechanics.ts`;
- `politicalPartyMechanics.ts`;
- `lawEnactmentMechanics.ts`;
- `politicalMovementMechanics.ts`;
- `revolutionMechanics.ts`;
- `characterMechanics.ts`;
- `politicsExplanation.ts`.

Avoid a single giant `politicsMechanics.ts` that owns everything.

Runtime order should be deterministic and documented. Proposed turn order:

1. refresh character lifecycle events;
2. calculate interest group raw power/clout;
3. calculate interest group approval;
4. update party formation/alignment;
5. update election campaign/results if due;
6. recalculate government legitimacy;
7. progress law enactment;
8. update political movements;
9. update revolutions;
10. emit modifiers/resource flows/explanations/world deltas;
11. enqueue notifications/events/journal progress.

Performance requirement:

- no unbounded full-world scans in hot paths;
- use country/region/population indexes;
- measure runtime duration for heavy politics phases;
- cap active movement/revolution counts per country through scenario defines.

## 15. Orders And Validation

Player and AI political actions should be normal validated orders.

Potential order types:

- `REFORM_GOVERNMENT`;
- `START_LAW_ENACTMENT`;
- `CANCEL_LAW_ENACTMENT`;
- `SUPPORT_POLITICAL_MOVEMENT`;
- `SUPPRESS_POLITICAL_MOVEMENT`;
- `CONCEDE_TO_MOVEMENT`;
- `RESIST_REVOLUTION`;
- `CALL_ELECTION` if allowed by law/scenario;
- `APPOINT_CHARACTER_ROLE` where applicable.

Server validation must enforce:

- country control;
- current law constraints;
- cooldowns;
- resource costs;
- valid ids;
- scenario defines;
- political authority limits;
- no action on countries the player does not control.

AI must use the same orders. No direct AI mutation of government, laws, movements, or revolutions.

## 16. UI Plan

Politics UI should become a main country modal/workspace.

Recommended tabs:

- Government;
- Laws;
- Elections;
- Parties;
- Interest Groups;
- Political Movements;
- Revolutions;
- Characters.

### Government Tab

Shows:

- legitimacy;
- ruling parties;
- ruling interest groups;
- opposition groups;
- ruler/head of government;
- active government law;
- reform government action;
- consequences of current legitimacy.

Tooltips:

- legitimacy breakdown;
- why each group is in/out;
- ideological compatibility;
- government effects.

### Elections Tab

Shows:

- current election phase;
- next election date;
- parties;
- vote share;
- seats;
- campaign momentum;
- predicted result;
- previous result.

Tooltips:

- vote source breakdown;
- party momentum sources;
- seat calculation;
- voting law effects.

### Parties Tab

Shows:

- party members;
- leader;
- ideology affinity;
- platform;
- vote share;
- seats;
- campaign status.

Tooltips:

- why a group belongs to a party;
- why party support rose/fell;
- platform sources.

### Interest Groups Tab

Shows:

- clout;
- approval;
- leader;
- ideologies;
- traits;
- party support;
- government/opposition state;
- demands.

Tooltips:

- clout breakdown;
- approval breakdown;
- active trait effects;
- supported/opposed laws.

### Movements Tab

Shows:

- active movements;
- target law;
- support;
- radicalism;
- supporting groups/characters;
- trend;
- expected consequences.

Tooltips:

- support sources;
- radicalism sources;
- what increases/decreases movement strength.

### Revolutions Tab

Shows:

- active or brewing revolutions;
- source movement;
- progress;
- loyalist strength;
- revolutionary strength;
- possible regions;
- demands;
- available responses.

Tooltips:

- progress sources;
- strength calculation;
- possible outcomes.

### Characters Tab

Shows:

- ruler;
- heirs if supported;
- interest group leaders;
- party leaders;
- agitators;
- generals/admirals when relevant.

Tooltips:

- traits;
- ideology;
- popularity;
- political effects.

All visible text must use localization keys with English and Russian values.

## 17. Tooltip And Explanation Requirements

Every visible political number must have a direct explanation path.

Required explanation records:

- legitimacy changes;
- interest group clout changes;
- interest group approval changes;
- party vote share changes;
- election result;
- law enactment progress;
- movement support/radicalism changes;
- revolution progress changes;
- character trait effects.

Explanation records should include:

- turn number;
- affected country/object;
- previous value;
- new value;
- causes;
- source systems;
- related modifiers;
- related events;
- localization label keys.

UI must not display unexplained numbers like "Legitimacy 42" without breakdown.

## 18. Modifier Integration

Politics must use the shared modifier system.

Modifier targets may include:

- `country.legitimacy`;
- `country.law_enactment_speed`;
- `country.law_enactment_success_chance`;
- `country.movement_radicalism`;
- `country.election_party_support`;
- `interest_group.clout`;
- `interest_group.approval`;
- `political_movement.support`;
- `political_movement.radicalism`;
- `revolution.progress`;
- `character.popularity`.

Modifiers can come from:

- laws;
- institutions;
- technologies;
- buildings;
- events;
- decisions;
- journal entries;
- characters;
- character traits;
- interest group traits;
- political movements;
- revolution state.

Do not add hardcoded law/group/trait conditionals in runtime logic when a modifier can express the effect.

## 19. Event, Decision, And Journal Integration

Politics should integrate with the event, decision, and journal refactor plans in this file.

Events can:

- add/remove movement support;
- change interest group approval;
- alter party momentum;
- change character popularity;
- trigger scandals;
- advance/reduce revolution progress;
- create or retire characters.

Decisions can:

- start reform packages;
- launch repression/concession actions;
- start political campaigns;
- interact with movements;
- appoint or dismiss roles where valid.

Journal entries can:

- track reform programs;
- track revolutionary crises;
- track election mandates;
- track legitimacy restoration;
- track ideological transitions.

All three systems should use shared scripting scopes/effects rather than separate politics-only scripting.

## 20. AI Plan

AI politics should be profile-driven and order-based.

AI should evaluate:

- whether to reform government;
- which law to enact;
- whether to concede to a movement;
- whether to suppress/resist;
- how much to care about legitimacy;
- whether to avoid revolution risk;
- how party/IG ideology aligns with profile.

AI profiles can include weights:

- `legitimacy`;
- `lawReform`;
- `stability`;
- `movementConcession`;
- `repression`;
- `interestGroupAppeasement`;
- `revolutionAvoidance`;
- `ideologyAlignment`.

AI candidate generation must:

- use legal filters first;
- respect cooldowns and costs;
- avoid direct world mutation;
- submit normal validated orders.

Tests must prove AI cannot bypass political validation.

## 21. Persistence And World Delta

Politics state must be included in persistence and world deltas only where needed.

Potential world delta masks:

- `governmentByCountry`;
- `electionsByCountry`;
- `politicalPartiesByCountry`;
- `interestGroupsByCountry`;
- `politicalMovementsByCountry`;
- `revolutionsByCountry`;
- `charactersById`;
- `characterIdsByCountry`;
- `politicsExplanations`.

Delta design should consider:

- country-scoped changes;
- bounded explanation history;
- replay/ACK behavior;
- migration from existing parliament state;
- UI loading behavior for large worlds.

Do not send massive full-world politics payloads every turn when country-scoped deltas are sufficient.

## 22. Scenario Defines

Politics pacing belongs in scenario defines.

Candidate defines:

```json
{
  "politics": {
    "electionIntervalTurns": 48,
    "campaignDurationTurns": 6,
    "governmentReformCooldownTurns": 4,
    "maxActiveMovementsPerCountry": 8,
    "maxActiveRevolutionsPerCountry": 2,
    "movementRadicalismThreshold": 60,
    "revolutionProgressThreshold": 100,
    "baseLawEnactmentTurns": 12,
    "legitimacyLowThreshold": 25,
    "legitimacyHighThreshold": 75
  }
}
```

These are examples only. Final numbers must be scenario-owned and validated.

## 23. Validation

Scenario validation must reject:

- missing localization keys;
- duplicate ids;
- invalid law references;
- invalid ideology references;
- invalid interest group references;
- invalid trait references;
- invalid character role references;
- party formation rules that reference missing content;
- movement templates with missing target laws;
- political defines outside allowed ranges;
- raw player-facing text;
- root content-library fallback.

Runtime validation must reject:

- invalid government reforms;
- invalid law enactment targets;
- duplicate active law enactment;
- invalid movement actions;
- invalid revolution actions;
- actions by uncontrolled countries;
- impossible character role assignments.

## 24. Testing Plan

### Unit Tests

- legitimacy calculation with positive and negative sources;
- government reform validation;
- interest group clout calculation;
- interest group approval calculation;
- party formation from compatible/incompatible groups;
- election campaign momentum;
- election vote-to-seat allocation;
- law enactment chance with legitimacy and movement pressure;
- movement creation and decay;
- movement radicalization;
- revolution escalation and de-escalation;
- character trait modifier application;
- scenario validator rejects invalid politics data.

### Runtime Tests

- turn runtime updates interest groups before elections;
- election result updates parties and government options;
- government reform emits world delta and explanations;
- law enactment updates movement pressure;
- movement escalates into revolution deterministically;
- revolution completion applies only approved first-slice effects;
- politics state persists and reloads.

### UI Tests

- government tab renders legitimacy and ruling groups;
- legitimacy tooltip has source breakdown;
- elections tab renders campaign/results;
- parties tab renders members/platform;
- interest group tab renders clout/approval/leader/traits;
- movements tab renders support/radicalism;
- revolutions tab renders progress/strength;
- characters tab renders leaders and traits;
- all visible strings resolve in English and Russian.

### AI Tests

- AI chooses reform when legitimacy weight is high;
- AI starts legal law enactment through order delta;
- AI concedes to movement when revolution avoidance is high;
- AI cannot mutate politics directly;
- AI respects cooldowns, costs, and validation errors.

## 25. Migration Plan

Phase 1: Legitimacy and richer government.

- Add `CountryGovernmentState`;
- calculate legitimacy from existing party/interest group state;
- show legitimacy in UI with tooltip;
- add government reform action/order;
- keep existing parliament bills working.

Phase 2: Interest group approval and traits.

- Expand interest group state;
- add approval calculation;
- add trait definitions and modifier effects;
- update UI explanations.

Phase 3: Elections and parties.

- Add election phases;
- add campaign momentum;
- make parties coalitions of interest groups;
- update seat/vote calculation;
- update election UI.

Phase 4: Characters.

- Add character contracts and scenario data;
- add rulers and interest group leaders;
- add character traits;
- connect leaders to legitimacy, approval, and party behavior.

Phase 5: Political movements.

- Add movement state;
- create movements from law preferences/radicals/groups;
- connect movement pressure to law enactment;
- add movement UI and explanations.

Phase 6: Revolutions.

- Add revolution state;
- escalate from radical movements;
- add crisis UI and response actions;
- implement first-slice non-war resolution.

Phase 7: Full integration.

- connect events/decisions/journals;
- add AI scoring;
- tune scenario defines;
- add Arcawiki pages;
- add scenario authoring docs.

## 26. Risks

### Performance

Politics can become expensive if every calculation scans all pops, buildings, regions, parties, and laws every turn.

Mitigation:

- indexes;
- country-scoped updates;
- bounded active movements;
- cached political power inputs;
- deterministic recalculation only when dependencies changed;
- runtime metrics.

### UI Complexity

Politics can overwhelm players.

Mitigation:

- clear tab structure;
- summary cards;
- tooltips;
- warning badges;
- compact country overview;
- Arcawiki player-facing explanation.

### Scenario Authoring Complexity

Politics content can become hard to write.

Mitigation:

- strict schemas;
- examples;
- validator errors with clear paths;
- reusable templates;
- docs for authoring ideologies/groups/traits/parties.

### Hidden Math

Political calculations can become opaque.

Mitigation:

- explanation records;
- tooltip-first implementation;
- no visible value without breakdown;
- tests for explanation presence.

### Legacy Drift

Existing parliament model can become a permanent legacy layer.

Mitigation:

- migration phases must name which old fields are replaced;
- final phase removes duplicate state;
- validators reject obsolete scenario fields;
- docs mark temporary compatibility explicitly.

## 27. Definition Of Done

The Victoria-like politics refactor is complete when:

- country government has explicit state;
- legitimacy is calculated, visible, and explained;
- interest groups have clout, approval, traits, leaders, and law stances;
- ideologies are scenario-authored reusable preference bundles;
- parties are coalitions of interest groups with platforms, seats, votes, and leaders;
- elections have campaign/results phases and explained vote sources;
- characters exist as reusable political actors;
- political movements exist and pressure laws/government;
- revolutions can escalate from radicalized movements;
- first-slice revolution resolution is server-authoritative and validated;
- law enactment uses legitimacy, parties, groups, movements, and modifiers;
- all political content is scenario-owned;
- all visible UI text has EN/RU localization keys;
- all visible political values have tooltips;
- important political changes create structured explanation records;
- AI uses normal validated orders for politics;
- persistence and world deltas cover politics state;
- tests cover calculations, validation, runtime, UI, AI, and migration;
- docs and Arcawiki explain politics to authors and players.

# Diplomacy, Treaties, Diplomatic Plays, Wargoals And Subjects Refactor Plan

Status: Planned.

This plan covers diplomacy, diplomatic actions, treaties, diplomatic plays, wargoals, and subjects.

Power blocs are intentionally excluded from this plan. They should be handled in a separate future design if the project decides they are needed. This plan must not add power bloc contracts, runtime state, UI, scenario folders, validation, orders, or tests.

The target is a Victoria-like international system where countries do not only exchange free-form proposals. Countries have relations, attitudes, interests, infamy, treaties, subject relationships, diplomatic actions, and diplomatic plays that can escalate into war or resolve through backdown. All visible diplomatic values must have localization, tooltips, and explanation records.

## 1. Diplomacy Design Goals

Diplomacy should become a country-to-country strategic system.

The target model:

- relations describe the numeric diplomatic relationship between two countries;
- attitudes describe how one country currently intends to treat another;
- infamy limits aggressive expansion and changes how other countries react;
- interests define where a country can meaningfully participate in diplomacy;
- diplomatic actions are validated actions with availability and acceptance logic;
- treaties are active binding agreements, not only pending proposals;
- subjects model overlord-subject hierarchy, autonomy, payments, obligations, and liberty desire;
- diplomatic plays create pre-war crises with phases, sides, maneuvers, demands, and backdown/war outcomes;
- wargoals define what each side wants and what happens on victory/backdown;
- AI uses the same validated order path as players;
- player-facing UI explains every allowed, blocked, accepted, rejected, or risky diplomatic action.

The system must follow Arcanorum rules:

- diplomacy territory transfer is region-level, not province-level;
- scenario-authored diplomacy data uses strict JSON and stable ids;
- no root legacy content library;
- no raw player-facing treaty/action text in protocol payloads;
- no hidden diplomatic fallbacks;
- no direct AI mutation;
- no unbounded full-world scans in hot diplomacy, AI, or WS paths.

## 2. Current Baseline

Arcanorum already has a useful first treaty/proposal base:

- `DiplomacyProposal`;
- proposal status lifecycle;
- revisions;
- pending responder;
- transfer money clause;
- transfer region clause;
- infrastructure transit clause;
- infrastructure construction rights clause;
- text note clause;
- world delta replacement for `diplomacyProposals`.

This is not yet a full international system.

Missing first-class systems:

- relations;
- attitudes;
- infamy;
- interests;
- active treaties separate from proposals;
- diplomatic action definitions;
- treaty articles/upkeep/cancellation;
- subject relations;
- diplomatic plays;
- maneuvers;
- wargoals;
- backdown resolution;
- diplomatic AI beyond simple contact candidates;
- tooltip/explanation layer for diplomacy values.

## 3. Target Shared State

Diplomacy should be represented with explicit state maps.

Proposed high-level shared state:

```ts
type WorldDiplomacyState = {
  diplomacyRelationsByPair: Record<string, CountryDiplomacyRelationState>;
  countryInfamyByCountry: Record<string, CountryInfamyState>;
  countryInterestsByCountry: Record<string, CountryInterestState>;
  activeTreatiesById: Record<string, DiplomaticTreatyState>;
  activeTreatyIdsByCountry: Record<string, string[]>;
  subjectRelationsBySubject: Record<string, SubjectRelationState>;
  diplomaticPlaysById: Record<string, DiplomaticPlayState>;
  diplomaticPlayIdsByCountry: Record<string, string[]>;
};
```

Existing `diplomacyProposals` can remain as the pending proposal layer, but active long-lived agreements should move into `activeTreatiesById`.

Pair keys must be deterministic, for example:

```ts
buildCountryPairKey(countryAId, countryBId)
```

The pair key must sort ids so `country:a` + `country:b` is always the same relation row regardless of call order.

## 4. Relations

Relations should be the numeric country-to-country diplomatic baseline.

```ts
type CountryDiplomacyRelationState = {
  countryAId: string;
  countryBId: string;
  relations: number;
  attitudeByCountryId: Record<string, DiplomaticAttitude>;
  rivalryByCountryId?: Record<string, boolean>;
  obligationByCountryId?: Record<string, DiplomaticObligationState[]>;
  truceUntilTurnId?: number | null;
  lastIncidentTurnId?: number | null;
  explanationIds: string[];
};
```

Relations range:

- minimum: `-100`;
- maximum: `100`;
- neutral default: `0`.

Suggested display bands:

- hostile;
- cold;
- poor;
- neutral;
- cordial;
- amicable;
- friendly.

Relations should affect:

- action availability;
- action acceptance;
- treaty acceptance;
- willingness to join diplomatic plays;
- willingness to back a side;
- subject loyalty/liberty desire;
- AI attitude.

Relations can change from:

- diplomatic actions;
- treaties;
- broken treaties;
- wargoals;
- backdowns;
- wars;
- events;
- decisions;
- subjects;
- scripted scenario history.

Every relation change must create an explanation record.

## 5. Attitudes

Attitude is how one country currently views another for decision-making.

```ts
type DiplomaticAttitude =
  | "unknown"
  | "friendly"
  | "cooperative"
  | "protective"
  | "loyal"
  | "neutral"
  | "cautious"
  | "suspicious"
  | "rivalrous"
  | "hostile"
  | "fearful"
  | "domineering";
```

Attitude should be directional:

- country A can be friendly toward country B;
- country B can be suspicious toward country A.

Inputs:

- relations;
- infamy;
- shared interests;
- border/contact;
- relative military strength;
- subject/overlord relation;
- claims/cores;
- prior wars;
- treaties;
- active diplomatic plays;
- AI profile;
- ideology/government similarity later if politics is available.

Outputs:

- AI action choice;
- acceptance modifiers;
- play participation;
- subject behavior;
- UI warnings.

Attitude should be recalculated deterministically and explained. UI should show why the attitude is what it is.

## 6. Infamy

Infamy is the reputation cost of aggressive diplomacy.

```ts
type CountryInfamyState = {
  countryId: string;
  value: number;
  level: "reputable" | "questionable" | "infamous" | "notorious" | "pariah";
  lastIncidentIds: string[];
  explanationIds: string[];
};
```

Infamy sources:

- conquest wargoals;
- subjugation wargoals;
- annexing subjects;
- breaking treaties;
- violating truces;
- forcing region transfers;
- aggressive diplomatic actions;
- scripted incidents.

Infamy decay:

- scenario-defined per-turn decay;
- modified by laws, rank, institutions, events, or decisions;
- must use defines/modifiers, not hardcoded numbers.

Infamy effects:

- worse diplomatic acceptance;
- more hostile attitudes;
- containment-style diplomatic plays in future slices;
- subject liberty desire increases;
- higher chance countries oppose plays;
- higher treaty cancellation risk.

Tooltip must explain:

- current value;
- current level;
- recent incidents;
- decay rate;
- diplomatic effects.

## 7. Interests

Interests define where a country can participate in meaningful diplomacy.

```ts
type CountryInterestState = {
  countryId: string;
  naturalStrategicRegionIds: string[];
  declaredStrategicRegionIds: string[];
  maxDeclaredInterests: number;
  explanationIds: string[];
};
```

Strategic regions should be scenario-authored or derived from region groupings.

Natural interests can come from:

- owned regions;
- controlled regions;
- subjects;
- active treaties;
- market/infrastructure presence if the relevant systems exist;
- adjacency where scenario rules allow it.

Declared interests:

- chosen by player/AI through validated order;
- capped by rank/technology/naval reach/defines;
- needed for diplomatic plays and some actions.

Interests must affect:

- whether a country can start a play;
- whether a country can join a play;
- whether some actions are available;
- whether AI considers a target relevant.

## 8. Diplomatic Actions

Diplomatic actions should be data-driven definitions plus validated runtime state.

```ts
type DiplomaticActionDefinition = {
  id: string;
  nameLocKey: string;
  descriptionLocKey: string;
  category: "instant" | "ongoing" | "pact" | "subject";
  requiresAcceptance: boolean;
  requiresSharedInterest?: boolean;
  cooldownTurns?: number;
  conditions?: ScriptCondition[];
  acceptance?: AcceptanceRule[];
  costs?: DiplomaticActionCost[];
  effects?: ScriptEffect[];
  upkeep?: DiplomaticActionUpkeep;
};
```

Examples:

- improve relations;
- damage relations;
- declare rivalry;
- end rivalry;
- offer alliance;
- offer defensive pact;
- guarantee independence;
- bankroll;
- ask for obligation;
- offer obligation;
- request region transfer;
- request treaty revision;
- break treaty;
- offer protectorate;
- reduce subject autonomy;
- increase subject autonomy;
- annex subject.

Concrete actions belong in scenario content, for example:

- `scenarios/<scenario_id>/common/diplomatic_actions/*.json`.

Core code should provide:

- availability validation;
- acceptance scoring;
- cost/upkeep execution;
- effect execution;
- cooldown handling;
- tooltip/explanation output.

## 9. Acceptance Scoring

Actions and treaties need an explainable acceptance score.

```ts
type DiplomaticAcceptanceBreakdown = {
  base: number;
  relations: number;
  attitude: number;
  infamy: number;
  relativePower: number;
  interests: number;
  treatyValue: number;
  subjectStatus: number;
  obligations: number;
  modifiers: Array<{ sourceId: string; value: number; labelLocKey: string }>;
  total: number;
};
```

Acceptance should be deterministic.

UI must show:

- whether the action will be accepted;
- exact acceptance score;
- positive/negative sources;
- why it is blocked if unavailable;
- consequences of success;
- consequences of rejection where relevant.

AI can use the same score, but player UI must not expose raw private AI utility scores. Acceptance reasons are diplomatic rules; AI strategy internals remain hidden/admin-only.

## 10. Treaties

Existing proposal clauses should evolve into active treaty articles.

Separate:

- `DiplomacyProposal`: a pending negotiation object;
- `DiplomaticTreatyState`: active binding agreement;
- `TreatyArticle`: durable treaty effect.

```ts
type DiplomaticTreatyState = {
  id: string;
  nameLocKey: string;
  partyCountryIds: string[];
  startedTurnId: number;
  bindingUntilTurnId?: number | null;
  cancellableAfterTurnId?: number | null;
  status: "active" | "cancelled" | "expired" | "broken";
  articles: TreatyArticle[];
  explanationIds: string[];
};
```

Treaty articles:

- transfer money once;
- transfer money per turn;
- transfer region;
- infrastructure transit;
- infrastructure construction rights;
- alliance;
- defensive pact;
- guarantee;
- military access;
- trade access;
- reparations;
- obligation;
- subject relation;
- recognition.

Existing `TreatyClause` types should be migrated or wrapped into `TreatyArticle` types instead of duplicated permanently.

## 11. Treaty Lifecycle

Treaties should have a clear lifecycle:

1. proposal draft;
2. sent proposal;
3. counterproposal/revision;
4. accepted;
5. active treaty created;
6. treaty upkeep applied each turn;
7. cancellation request or expiry;
8. cancellation, expiry, or treaty break;
9. consequences and explanations.

Treaty cancellation/breaking can affect:

- relations;
- infamy;
- truce;
- obligations;
- subject liberty desire;
- active diplomatic plays.

No treaty should apply hidden effects. Every active article should be inspectable in UI.

## 12. Subjects

Subjects should be first-class relations, not only treaty text.

```ts
type SubjectRelationState = {
  subjectCountryId: string;
  overlordCountryId: string;
  subjectTypeId: string;
  autonomyLevel: number;
  libertyDesire: number;
  attitude: "loyal" | "cooperative" | "resentful" | "defiant" | "rebellious";
  paymentRules: SubjectPaymentRule[];
  diplomaticFreedom: "none" | "limited" | "full";
  militaryObligation: "none" | "defensive" | "offensive" | "all";
  marketAccessRule?: string | null;
  integrationProgress?: number | null;
  explanationIds: string[];
};
```

Subject types should be scenario-authored:

- protectorate;
- puppet;
- dominion;
- vassal;
- tributary;
- colony;
- client state.

Subject type definition:

```json
{
  "id": "subject_type:protectorate",
  "nameLocKey": "subjectType.protectorate.name",
  "descriptionLocKey": "subjectType.protectorate.description",
  "baseAutonomy": 70,
  "diplomaticFreedom": "limited",
  "militaryObligation": "defensive",
  "paymentRules": [],
  "canBeAnnexed": false
}
```

Subject mechanics:

- overlord can call subject according to obligation;
- subject can pay income/resources according to rules;
- subject may have restricted diplomacy;
- subject can gain liberty desire;
- high liberty desire enables independence movement/play;
- overlord can increase/reduce autonomy through actions;
- annexation/integration requires validated action and conditions.

## 13. Liberty Desire

Liberty desire is the subject pressure value.

Inputs:

- relations with overlord;
- overlord infamy;
- subject strength vs overlord;
- autonomy level;
- payments/tribute burden;
- laws/government compatibility later;
- radicals/turmoil later;
- foreign support;
- broken promises;
- events/decisions.

Outputs:

- subject attitude;
- refusal chance;
- independence play availability;
- AI behavior;
- overlord warning UI.

Tooltip must explain:

- current liberty desire;
- why it is rising/falling;
- threshold effects;
- what overlord can do.

## 14. Diplomatic Plays

Diplomatic plays are pre-war crises.

```ts
type DiplomaticPlayState = {
  id: string;
  initiatorCountryId: string;
  targetCountryId: string;
  strategicRegionId: string;
  status: "opening" | "maneuvers" | "countdown" | "war" | "backed_down" | "resolved";
  startedTurnId: number;
  escalation: number;
  maneuversByCountryId: Record<string, number>;
  primaryDemand: WargoalState;
  addedWargoals: WargoalState[];
  sideByCountryId: Record<string, "initiator" | "target" | "neutral">;
  swayOffers: SwayOfferState[];
  lockedCountryIds: string[];
  explanationIds: string[];
};
```

Diplomatic play phases:

1. opening;
2. maneuvers;
3. countdown;
4. backdown or war;
5. resolved.

Play validation:

- initiator controls country;
- target valid;
- target region/subject/wargoal valid;
- required interest exists;
- no active truce blocks it;
- no duplicate incompatible play exists;
- wargoal conditions pass;
- country is not already locked in incompatible play.

## 15. Maneuvers

Maneuvers are the action budget inside a diplomatic play.

Maneuvers can be spent on:

- adding wargoals;
- offering obligations;
- offering treaty articles;
- swaying countries;
- calling allies;
- pressing subjects;
- changing side support where rules allow.

Maneuver sources:

- country rank;
- prestige;
- military power projection;
- naval reach;
- laws;
- technologies;
- leader traits later;
- scenario modifiers.

Maneuver tooltip:

- base amount;
- source modifiers;
- spent maneuvers;
- remaining maneuvers;
- available actions.

## 16. Sway Offers

Sway offers are promises made inside diplomatic plays.

```ts
type SwayOfferState = {
  id: string;
  fromCountryId: string;
  toCountryId: string;
  side: "initiator" | "target";
  offeredArticles: TreatyArticle[];
  offeredObligations: DiplomaticObligationState[];
  status: "pending" | "accepted" | "rejected" | "expired";
};
```

Examples:

- promise obligation;
- promise region;
- promise subject autonomy;
- promise treaty;
- promise money/reparations.

Accepted sway offers must become enforceable if the side wins or if the play resolves by agreed outcome. Broken promises should affect relations/infamy/obligations.

## 17. Wargoals

Wargoals define demands and resolution effects.

```ts
type WargoalDefinition = {
  id: string;
  nameLocKey: string;
  descriptionLocKey: string;
  category: "territory" | "subject" | "recognition" | "reparations" | "market" | "release" | "regime";
  targetScope: "country" | "region" | "subject" | "treaty";
  baseInfamy: number;
  maneuverCost: number;
  requiresInterest: boolean;
  conditions?: ScriptCondition[];
  effectsOnVictory?: ScriptEffect[];
  effectsOnBackdown?: ScriptEffect[];
};
```

Common wargoals:

- conquer region;
- return region;
- transfer subject;
- liberate country;
- force recognition;
- war reparations;
- open market;
- ban/force specific treaty;
- cut down to size;
- make protectorate;
- independence.

Wargoals are scenario content:

- `scenarios/<scenario_id>/common/wargoals/*.json`.

Adding a wargoal to a play must not directly mutate world ownership/control. Effects are applied only by validated resolution runtime after backdown, peace, or war result.

## 18. Backdown And Resolution

Backdown should resolve a play without war.

Rules:

- target can back down during allowed phase;
- initiator can back down if rules allow;
- primary demand usually applies on backdown;
- added wargoals may or may not apply depending on phase/defines;
- backdown creates truce;
- relations/infamy/explanations update;
- notifications are sent.

Resolution paths:

- target backs down;
- initiator backs down;
- negotiated settlement if later supported;
- play escalates into war;
- war result applies wargoals;
- play expires/fails due to invalid state.

No raw ownership/control changes should bypass the region ownership resolver. Territory transfer must go through shared region-level ownership/controller update helpers and emit world deltas.

## 19. Scenario Data Model

Diplomacy content should be scenario-owned.

Recommended folders:

- `scenarios/<scenario_id>/common/diplomatic_actions/*.json`;
- `scenarios/<scenario_id>/common/treaty_articles/*.json`;
- `scenarios/<scenario_id>/common/subject_types/*.json`;
- `scenarios/<scenario_id>/common/wargoals/*.json`;
- `scenarios/<scenario_id>/common/strategic_regions/*.json`;
- `scenarios/<scenario_id>/history/diplomacy/relations/*.json`;
- `scenarios/<scenario_id>/history/diplomacy/treaties/*.json`;
- `scenarios/<scenario_id>/history/diplomacy/subjects/*.json`;
- `scenarios/<scenario_id>/history/diplomacy/interests/*.json`.

All data must:

- use strict JSON;
- include authoritative `id`;
- use localization keys;
- reference stable country/region/content ids;
- validate all referenced ids;
- avoid root content-library fallback;
- avoid raw player-facing text.

## 20. Runtime Architecture

Candidate modules:

- `diplomacyRelationMechanics.ts`;
- `diplomaticAttitudeMechanics.ts`;
- `infamyMechanics.ts`;
- `interestMechanics.ts`;
- `diplomaticActionMechanics.ts`;
- `treatyMechanics.ts`;
- `subjectMechanics.ts`;
- `diplomaticPlayMechanics.ts`;
- `wargoalMechanics.ts`;
- `diplomacyExplanation.ts`.

Turn order:

1. expire proposals;
2. apply active treaty upkeep;
3. update relations drift/decay where defined;
4. decay infamy;
5. refresh interests;
6. refresh attitudes;
7. update subject liberty desire;
8. progress diplomatic actions;
9. progress diplomatic plays;
10. resolve backdowns/expired plays;
11. emit explanations, notifications, and world deltas.

The runtime must stay deterministic.

## 21. Orders And Validation

Potential orders:

- `DECLARE_INTEREST`;
- `REMOVE_INTEREST`;
- `START_DIPLOMATIC_ACTION`;
- `CANCEL_DIPLOMATIC_ACTION`;
- `PROPOSE_TREATY`;
- `RESPOND_TREATY`;
- `REVISE_TREATY_PROPOSAL`;
- `CANCEL_TREATY_PROPOSAL`;
- `BREAK_TREATY`;
- `START_DIPLOMATIC_PLAY`;
- `ADD_WARGOAL`;
- `MAKE_SWAY_OFFER`;
- `RESPOND_SWAY_OFFER`;
- `JOIN_DIPLOMATIC_PLAY`;
- `BACK_DOWN_DIPLOMATIC_PLAY`;
- `CHANGE_SUBJECT_AUTONOMY`;
- `ANNEX_SUBJECT`;
- `START_SUBJECT_INDEPENDENCE_PLAY`.

Validation must enforce:

- player controls acting country;
- AI uses same order path;
- required interests;
- relation/attitude constraints;
- treaty status;
- subject status;
- truce status;
- maneuver budget;
- infamy cost;
- cooldowns;
- no duplicate incompatible actions;
- no invalid region/country ids;
- parliament ratification where relevant.

## 22. UI Plan

Diplomacy should be a dedicated workspace/lens.

Recommended tabs:

- Overview;
- Relations;
- Actions;
- Treaties;
- Subjects;
- Diplomatic Plays;
- Wargoals;
- Interests;
- Infamy.

### Overview

Shows:

- selected country;
- relations to player;
- attitude;
- treaties;
- subjects/overlord;
- active plays;
- available actions.

### Relations

Shows:

- relation values by country;
- attitude;
- truce;
- rivalry;
- obligations.

Tooltips explain relation sources and attitude causes.

### Actions

Shows:

- available actions;
- blocked actions;
- acceptance score;
- cost/upkeep;
- consequences.

Every blocked action needs a localized reason.

### Treaties

Shows:

- pending proposals;
- active treaties;
- treaty articles;
- binding/cancellable dates;
- upkeep;
- cancellation consequences.

### Subjects

Shows:

- subject type;
- overlord;
- autonomy;
- liberty desire;
- payments;
- obligations;
- available autonomy/annexation/independence actions.

### Diplomatic Plays

Shows:

- active plays;
- phase;
- escalation;
- sides;
- maneuvers;
- sway offers;
- wargoals;
- backdown/war risks.

### Interests

Shows:

- natural interests;
- declared interests;
- capacity;
- map region selection;
- why an interest is available/unavailable.

### Infamy

Shows:

- current infamy;
- level;
- recent incidents;
- decay;
- diplomatic effects.

All visible UI text must use English and Russian localization keys.

## 23. Tooltip And Explanation Requirements

Every important diplomacy value must have a tooltip.

Required tooltips:

- relations;
- attitude;
- infamy;
- interest capacity;
- action acceptance;
- treaty article effect;
- treaty upkeep;
- subject liberty desire;
- subject autonomy;
- play escalation;
- maneuver budget;
- sway acceptance;
- wargoal infamy;
- backdown effects.

Required explanation records:

- relation changes;
- attitude changes;
- infamy changes;
- interest changes;
- treaty creation/cancellation/breaking;
- subject autonomy/liberty desire changes;
- diplomatic action acceptance/rejection;
- diplomatic play phase changes;
- wargoal addition;
- backdown/resolution.

## 24. Modifier Integration

Diplomacy should use shared modifiers.

Potential modifier targets:

- `country.infamy_decay`;
- `country.infamy_generation`;
- `country.declared_interest_capacity`;
- `country.diplomatic_maneuvers`;
- `country.diplomatic_action_acceptance`;
- `country.relations_gain`;
- `country.subject_liberty_desire`;
- `country.treaty_upkeep`;
- `country.play_escalation_speed`;

Modifier sources:

- laws;
- technologies;
- events;
- decisions;
- journal entries;
- characters later;
- country rank/prestige later;
- subject type;
- treaty articles.

No action-specific hardcoded special cases when modifiers/effects can express the rule.

## 25. Event, Decision, Journal, Politics And War Integration

Events can:

- create incidents;
- change relations;
- add infamy;
- alter subject liberty desire;
- create treaty proposals;
- affect diplomatic plays.

Decisions can:

- launch diplomatic campaigns;
- normalize relations;
- impose sanctions if supported;
- support subjects;
- prepare claims/wargoals.

Journal entries can track:

- recognition campaigns;
- subject integration;
- treaty obligations;
- diplomatic isolation;
- crisis escalation.

Politics integration:

- parliament powers can require ratification for territory transfer or major treaties;
- government legitimacy can affect acceptance later;
- political movements can oppose treaties/wars later.

War integration:

- diplomatic play can escalate into war;
- war result applies wargoals;
- truce is created after resolution;
- peace treaties reuse treaty/wargoal effect infrastructure.

## 26. AI Plan

AI diplomacy should be profile-driven and order-based.

AI evaluates:

- improve/damage relations;
- offer/accept/reject treaties;
- declare interests;
- start diplomatic plays;
- add wargoals;
- sway countries;
- join or stay neutral;
- back down or escalate;
- manage subjects;
- avoid high infamy or embrace aggression depending on profile.

AI profile weights:

- `relations`;
- `infamyTolerance`;
- `aggression`;
- `treatyPreference`;
- `subjectControl`;
- `subjectAppeasement`;
- `playRiskTolerance`;
- `wargoalPreference`;
- `interestExpansion`;

AI must:

- use legal filters first;
- respect interests/truces/maneuvers;
- submit normal validated orders;
- never mutate relations, treaties, subjects, or plays directly.

## 27. Persistence And World Delta

Potential world delta masks:

- `diplomacyRelationsByPair`;
- `countryInfamyByCountry`;
- `countryInterestsByCountry`;
- `activeTreatiesById`;
- `activeTreatyIdsByCountry`;
- `subjectRelationsBySubject`;
- `diplomaticPlaysById`;
- `diplomaticPlayIdsByCountry`;
- `diplomacyExplanations`.

Delta design should avoid full replacement where country/pair scoped updates are enough.

Consider:

- replay/ACK behavior;
- bounded explanation history;
- active play subscriptions;
- large world performance;
- subject/treaty cleanup on country deletion.

## 28. Scenario Defines

Diplomacy pacing belongs in scenario defines.

Example:

```json
{
  "diplomacy": {
    "relationsMin": -100,
    "relationsMax": 100,
    "infamyDecayPerTurn": 0.05,
    "baseDeclaredInterestCapacity": 1,
    "treatyProposalExpiryTurns": 6,
    "treatyBreakRelationsPenalty": 20,
    "truceTurnsAfterBackdown": 24,
    "diplomaticPlayOpeningTurns": 2,
    "diplomaticPlayManeuverTurns": 6,
    "diplomaticPlayCountdownTurns": 4,
    "baseManeuvers": 10,
    "subjectLibertyDesireRebelliousThreshold": 75
  }
}
```

These are examples only. Final values must be scenario-owned, validated, and documented.

## 29. Validation

Scenario validation must reject:

- duplicate diplomatic action ids;
- duplicate treaty article ids;
- duplicate subject type ids;
- duplicate wargoal ids;
- missing localization keys;
- raw player-facing text;
- invalid country references;
- invalid region references;
- invalid strategic region references;
- invalid treaty article references;
- invalid subject type references;
- invalid wargoal target scopes;
- invalid infamy/maneuver/relations ranges;
- obsolete root diplomacy content libraries;
- power bloc data in this implementation slice.

Runtime validation must reject:

- uncontrolled country actions;
- missing interests;
- truce violations unless explicitly allowed;
- duplicate active plays;
- invalid wargoals;
- insufficient maneuvers;
- invalid treaty revisions;
- invalid treaty breaks;
- invalid subject autonomy changes;
- invalid backdown timing.

## 30. Testing Plan

### Unit Tests

- pair key determinism;
- relation normalization;
- attitude calculation;
- infamy gain/decay;
- interest capacity;
- action availability;
- acceptance breakdown;
- treaty proposal to active treaty conversion;
- treaty cancellation/breaking consequences;
- subject liberty desire;
- diplomatic play phase progression;
- maneuver spending;
- wargoal validation;
- backdown resolution.

### Runtime Tests

- active treaty upkeep applies correctly;
- expired proposal is removed/rejected;
- relation changes emit explanation and delta;
- subject state persists and updates;
- play progresses deterministically across turns;
- backdown applies primary demand and truce;
- wargoal resolution uses region-level transfer helpers;
- invalid play/wargoal orders are rejected.

### UI Tests

- diplomacy overview renders selected country state;
- action list shows blocked reasons;
- acceptance tooltip shows breakdown;
- treaty tab shows active articles/upkeep;
- subject tab shows liberty desire tooltip;
- play tab shows phase/maneuvers/wargoals;
- infamy tooltip shows incidents/decay/effects;
- all visible strings resolve in English and Russian.

### AI Tests

- AI declares relevant interest;
- AI proposes legal treaty through order path;
- AI rejects bad treaty with explainable acceptance;
- AI starts legal play when aggression weight is high;
- AI backs down when risk tolerance is low;
- AI cannot mutate diplomacy state directly.

## 31. Migration Plan

Phase 1: Diplomacy core.

- Add relation pair keys;
- add relations state;
- add infamy state;
- add interests state;
- add tooltips/explanations for values.

Phase 2: Active treaties.

- Separate pending proposals from active treaties;
- convert accepted proposals into active treaty state;
- add treaty articles;
- add treaty upkeep/cancellation/breaking.

Phase 3: Diplomatic actions.

- Add scenario-authored action definitions;
- add availability and acceptance scoring;
- add action orders;
- update UI action list.

Phase 4: Subjects.

- Add subject types;
- add subject relation state;
- add liberty desire;
- add autonomy actions;
- add subject UI.

Phase 5: Diplomatic plays.

- Add play state;
- add phases;
- add sides;
- add maneuvers;
- add play UI.

Phase 6: Wargoals and resolution.

- Add scenario-authored wargoals;
- add wargoal validation;
- add backdown resolution;
- connect war result resolution later.

Phase 7: AI, docs, Arcawiki.

- Add diplomacy AI candidates;
- add tests;
- update docs;
- update Arcawiki.

No phase in this plan introduces power blocs.

## 32. Risks

### Diplomatic State Explosion

Pairwise relations can become large in a world with many countries.

Mitigation:

- sparse relation rows;
- derive neutral defaults;
- store only touched pairs;
- use pair indexes;
- avoid full pair scans every turn.

### Player Confusion

Diplomacy has many blocked states and hidden causes if not explained.

Mitigation:

- action availability reasons;
- acceptance breakdown;
- relation/attitude/infamy tooltips;
- warnings before irreversible actions;
- Arcawiki player guide.

### Treaty Duplication

Proposals and active treaties can become duplicate systems.

Mitigation:

- proposals only negotiate;
- active treaties only apply durable effects;
- clauses migrate into articles;
- no permanent duplicate legacy format.

### Plays Bypassing War Design

Diplomatic plays can force premature war architecture.

Mitigation:

- first slice supports backdown and play state;
- war escalation creates a clearly typed handoff;
- wargoal effects apply only on validated resolution;
- no direct province-level or ad hoc ownership mutation.

### AI Abuse

AI can spam proposals or plays.

Mitigation:

- cooldowns;
- relation/interest filters;
- max active proposals/plays;
- profile weights;
- normal order validation.

## 33. Definition Of Done

This diplomacy refactor is complete for the first Victoria-like slice when:

- relations exist as explainable pair state;
- attitudes exist as directional explainable state;
- infamy exists with decay, incidents, and UI explanation;
- interests exist and gate relevant actions/plays;
- diplomatic actions are scenario-authored and validated;
- action acceptance has visible breakdown;
- pending proposals are separate from active treaties;
- active treaties have inspectable articles and lifecycle;
- subjects have subject type, autonomy, liberty desire, obligations, and UI;
- diplomatic plays have phases, sides, maneuvers, and status;
- wargoals are scenario-authored and validated;
- backdown resolution applies validated effects and truce;
- territory transfer remains region-level;
- all visible UI text uses English and Russian localization keys;
- all visible diplomatic values have tooltips;
- important diplomacy changes create explanation records;
- AI uses normal validated orders;
- persistence and world deltas cover diplomacy state;
- tests cover relations, infamy, interests, treaties, subjects, plays, wargoals, UI, AI, and validation;
- docs and Arcawiki explain diplomacy to authors and players;
- power blocs remain excluded from this slice.

# Companies, Treasury, Private Ownership And Political Integration Refactor Plan

Status: Planned.

This plan covers companies as economic actors, company-owned buildings, company treasury, private investment, subsidies, nationalization, and political integration.

The target is to move companies from content cards and building owner labels into a Victoria-like economic system where companies own or operate buildings, accumulate treasury, calculate profitability and prosperity, invest in construction through validated orders, create modifiers, influence interest groups, and become visible to players through tooltips and explanations.

## 1. Company Design Goals

Companies should become first-class economic actors.

The target model:

- scenario data defines company identity, specialization, ownership rules, icons, localization, and effects;
- runtime state tracks company treasury, owned buildings, profitability, productivity, prosperity, subsidies, and problems;
- company-owned buildings participate in normal regional economy and market systems;
- company revenue and expenses are explainable;
- company prosperity unlocks modifiers through the shared modifier system;
- companies can invest in new buildings through the same validated construction pipeline as players/AI;
- company ownership interacts with diplomacy, war, region transfer, and nationalization;
- companies influence politics through interest groups, laws, events, decisions, and journal entries;
- every visible company value has tooltip and explanation records.

Companies must not become a hidden bypass around economy rules.

Required constraints:

- no province-level company economy;
- companies operate through region-level buildings and country/market systems;
- no direct construction mutation outside validated build/construction order paths;
- no hardcoded company-specific logic in core simulation;
- no company bonuses outside shared modifiers;
- all player-facing text uses localization keys with English and Russian values;
- concrete company content belongs under scenario files.

## 2. Current Baseline

Arcanorum already has partial company support:

- `BuildingOwner` supports `{ type: "company"; companyId: string }`;
- building instances and construction projects can have company ownership;
- scenario content includes `common/companies`;
- company logos can be uploaded under scenario assets;
- building UI can select company owner;
- building UI can filter/sort by company;
- scenario validation recognizes `common/companies`.

Missing systems:

- company runtime state;
- company treasury;
- company income/expense ledger;
- company profitability;
- company productivity aggregation;
- company prosperity;
- company investment logic;
- company subsidies;
- nationalization;
- foreign ownership rules;
- company modifiers;
- company politics integration;
- company events/journals;
- company UI beyond ownership labels.

## 3. Target Shared State

Company runtime state should be explicit and separate from scenario definition.

```ts
type CompanyRuntimeState = {
  companyId: string;
  countryId: string;
  status: "inactive" | "active" | "struggling" | "profitable" | "prosperous";
  treasuryDucats: number;
  creditDucats: number;
  debtDucats: number;
  prosperity: number;
  productivity: number;
  revenueDucats: number;
  expensesDucats: number;
  profitDucats: number;
  lastTurnRevenueDucats: number;
  lastTurnExpensesDucats: number;
  lastTurnProfitDucats: number;
  ownedBuildingInstanceIds: string[];
  activeModifierIds: string[];
  subsidyPolicy?: CompanySubsidyPolicy | null;
  investmentPolicy?: CompanyInvestmentPolicy | null;
  problemIds: string[];
  explanationIds: string[];
};
```

World state additions:

```ts
type WorldCompanyState = {
  companiesById: Record<string, CompanyRuntimeState>;
  companyLedgerByTurn: Record<number, CompanyLedgerEntry[]>;
  companyInvestmentQueueByCompany: Record<string, CompanyInvestmentPlan[]>;
};
```

Existing building owners should remain the source of truth for which buildings are company-owned. Company runtime state should aggregate from buildings and store turn summaries.

## 4. Scenario Company Definition

Scenario-authored companies should define identity, specialization, ownership constraints, and effects.

Recommended file:

- `scenarios/<scenario_id>/common/companies/*.json`.

Target shape:

```json
{
  "id": "company:royal_steel",
  "nameLocKey": "company.royal_steel.name",
  "descriptionLocKey": "company.royal_steel.description",
  "countryId": "country:albion",
  "logoUrl": "/scenario-assets/example/assets/uploads/companies/royal_steel.png",
  "color": "#AABBCC",
  "allowedBuildingIds": ["building:steel_mill", "building:tooling_workshop"],
  "allowedIndustryIds": ["industry:heavy_industry"],
  "preferredRegionIds": ["region:north"],
  "forbiddenRegionIds": [],
  "prosperityThresholds": [
    {
      "minProsperity": 50,
      "modifierIds": ["modifier:royal_steel_throughput"]
    }
  ],
  "foundingConditions": [],
  "investmentRules": {
    "enabled": true,
    "maxActiveProjects": 2
  }
}
```

Required validation:

- company id is stable and unique;
- country id exists;
- localization keys exist in English and Russian;
- logo URL is scenario-owned if present;
- building/industry/region references exist;
- modifier references exist;
- no raw player-facing text;
- no unsupported legacy aggregate company data.

## 5. Company Treasury

Company treasury should track company-owned money separately from country resources.

```ts
type CompanyTreasuryState = {
  companyId: string;
  ducats: number;
  creditDucats: number;
  debtDucats: number;
  lastIncomeDucats: number;
  lastExpenseDucats: number;
  lastNetDucats: number;
};
```

Company treasury receives:

- building profits;
- state subsidies;
- private investment returns if modeled;
- event/decision effects;
- treaty/investment payments later.

Company treasury pays:

- construction contributions;
- building losses if company absorbs them;
- interest on debt if implemented;
- dividends/taxes later;
- nationalization/compensation costs if implemented;
- event/decision costs.

The first implementation should keep treasury simple:

- one `treasuryDucats` number per company;
- bounded per-turn company ledger entries;
- no compound debt/interest until a later slice;
- no stock market or shares.

Company treasury must not mutate country resources directly. If country pays subsidy or receives tax/dividend, it must use the resource ledger with source type `company`.

## 6. Company Ledger

Company treasury needs its own bounded ledger for explanations.

```ts
type CompanyLedgerEntry = {
  id: string;
  turnId: number;
  companyId: string;
  amountDucats: number;
  direction: "income" | "expense";
  sourceKind: "building" | "subsidy" | "construction" | "event" | "decision" | "nationalization" | "treaty";
  sourceId: string;
  categoryId: string;
  labelLocKey: string;
  params?: Record<string, string | number>;
};
```

UI must be able to explain:

- why treasury rose/fell;
- which buildings earned money;
- which buildings lost money;
- how much subsidy was paid;
- how much investment was spent;
- what modifiers affected profit.

Ledger history must be bounded by scenario/client settings and must not grow unbounded in memory.

## 7. Company Profitability

Company profitability should aggregate from company-owned buildings.

Inputs:

- `lastRevenueDucats`;
- `lastInputCostDucats`;
- `lastWagesDucats`;
- `lastStateSubsidyDucats`;
- `lastNetDucats`;
- building inactivity;
- labor coverage;
- infrastructure coverage;
- input coverage;
- finance coverage;
- extraction coverage;
- durability coverage;
- productivity.

Derived values:

- total revenue;
- total expenses;
- total profit;
- profit margin;
- average productivity;
- inactive building count;
- problem list.

```ts
type CompanyPerformanceSummary = {
  revenueDucats: number;
  expensesDucats: number;
  profitDucats: number;
  profitMargin: number;
  averageProductivity: number;
  activeBuildingCount: number;
  inactiveBuildingCount: number;
  problemIds: string[];
};
```

Company performance should be recalculated after building economy resolution.

## 8. Prosperity

Prosperity is the long-term company health score.

Suggested range:

- `0..100`.

Inputs:

- profit margin;
- productivity;
- active building share;
- input availability;
- labor availability;
- market access;
- treasury reserves;
- debt pressure;
- specialization match;
- subsidies;
- events/modifiers.

Outputs:

- company status;
- company modifiers;
- investment confidence;
- political effects;
- event/journal triggers.

Prosperity should move gradually:

```text
newProsperity = oldProsperity + boundedDeltaTowardTarget
```

This avoids unstable prosperity flipping every turn.

Tooltip must show:

- current prosperity;
- target prosperity;
- current turn delta;
- positive sources;
- negative sources;
- active threshold effects;
- gameplay effects.

## 9. Company Status

Company status should be derived from treasury/prosperity/performance.

Suggested statuses:

- inactive: no owned active buildings;
- active: operating normally;
- struggling: low prosperity or negative cash flow;
- profitable: healthy profit and stable prosperity;
- prosperous: high prosperity and active bonuses.

Status effects:

- UI badges;
- event weights;
- AI investment behavior;
- modifier activation;
- political influence.

Status must be computed, not manually authored in runtime state.

## 10. Company Ownership Rules

Company ownership must be explicit.

Rules:

- every company has a home country;
- company-owned building references a company id;
- company must be allowed to own the building type;
- company must be allowed to operate in the region;
- foreign company ownership requires treaty/investment right when diplomacy supports it;
- region ownership changes must define what happens to foreign company buildings.

Region transfer policies:

- keep foreign ownership;
- disable without treaty;
- nationalize to new owner;
- transfer to local company;
- force sale/compensation.

The active policy should come from:

- treaty article;
- law;
- scenario define;
- diplomatic resolution effect.

No hidden fallback should silently change company ownership.

## 11. Company Construction And Investment

Companies should eventually invest in buildings.

```ts
type CompanyInvestmentPlan = {
  id: string;
  companyId: string;
  targetRegionId: string;
  buildingId: string;
  expectedProfitDucats: number;
  expectedPaybackTurns: number;
  priority: number;
  status: "candidate" | "queued" | "funded" | "cancelled" | "completed";
  explanationIds: string[];
};
```

Investment candidate scoring:

- building allowed by company definition;
- region allowed by company definition;
- expected market demand;
- input availability;
- workforce availability;
- infrastructure coverage;
- current company treasury;
- country laws;
- subsidies;
- profitability history;
- strategic region preference;
- AI profile if AI-controlled.

Companies must not spawn buildings directly.

They submit/build through normal validated construction paths:

- same region ownership/control rules;
- same technology unlocks;
- same build restrictions;
- same construction queue limits;
- same world deltas.

## 12. Subsidies

State subsidies should be explicit policy.

```ts
type CompanySubsidyPolicy = {
  enabled: boolean;
  maxDucatsPerTurn?: number | null;
  target: "all_losses" | "strategic_buildings" | "fixed_amount";
  startedTurnId: number;
};
```

Subsidy flow:

- country pays through resource ledger;
- company receives through company ledger;
- building/company losses are covered up to policy limit;
- tooltip shows cost and effect.

Subsidies can affect:

- company treasury;
- company prosperity;
- political interest group approval;
- budget pressure;
- events/journals.

Subsidy action must be validated:

- player controls country;
- company belongs to country or treaty permits subsidy;
- country can afford expected spend or policy accepts deficit rules;
- parliament/politics approval if required later.

## 13. Nationalization And Privatization

Nationalization should be a validated action, not direct owner editing.

```ts
type NationalizationAction = {
  countryId: string;
  companyId: string;
  buildingInstanceIds?: string[];
  compensationDucats?: number;
};
```

Nationalization effects:

- selected company buildings transfer to state ownership;
- company receives compensation if policy requires it;
- country pays compensation via resource ledger;
- company ledger records compensation;
- company prosperity and treasury update;
- interest groups react;
- relations/infamy may change for foreign-owned companies later.

Privatization effects:

- state buildings transfer to company ownership;
- company may pay purchase price;
- country receives money through resource ledger;
- company gets new investment exposure;
- politics reacts.

All ownership changes must emit world delta for `regionBuildingsByRegion`.

## 14. Company Modifiers

Company effects must use shared modifiers.

Potential targets:

- `building.throughput`;
- `building.input`;
- `building.output`;
- `building.wage`;
- `building_construction_cost`;
- `country.construction_gain`;
- `country.science_gain`;
- `country.ducats_gain`;
- `region.migration_attraction`;
- `interest_group.clout`;
- `interest_group.approval`;
- `company.prosperity`;
- `company.investment_capacity`.

Modifier activation sources:

- company prosperity threshold;
- company status;
- company trait;
- law;
- technology;
- event;
- decision;
- journal entry;
- subsidy policy.

Do not add `if companyId === "..."` logic.

## 15. Political Integration

Companies should influence politics through interest groups and law conflict.

Political effects:

- profitable industrial companies increase industrialist clout;
- large worker-heavy companies increase trade union clout;
- subsidized companies can affect government approval;
- nationalization angers owner-aligned groups and pleases collectivist groups;
- privatization can do the opposite;
- company failures can increase radicals among employed pops;
- unsafe/low-wage company events can create political movements;
- monopolies can trigger events, decisions, or laws.

Required integration points:

- `interestGroupWeights` from professions/buildings/companies;
- company prosperity to interest group approval modifiers;
- company employment to political strength;
- law stances around nationalization/privatization/subsidies;
- political movements can demand nationalization, anti-monopoly laws, worker protections, or privatization.

Example modifier:

```json
{
  "id": "modifier:prosperous_industrial_company_clout",
  "target": "interest_group.clout",
  "operation": "multiply",
  "value": 1.05,
  "scope": "country",
  "source": "company:royal_steel"
}
```

Politics integration should not be implemented as hidden direct approval changes without explanation records.

## 16. Company Events, Decisions And Journals

Events can cover:

- company boom;
- company scandal;
- strike;
- bankruptcy threat;
- unsafe working conditions;
- monopoly pressure;
- foreign investor dispute;
- corruption;
- innovation breakthrough.

Decisions can cover:

- grant subsidy;
- revoke subsidy;
- nationalize company;
- privatize state assets;
- support strategic industry;
- investigate company;
- grant concession.

Journal entries can track:

- build a national champion;
- rescue failing company;
- break monopoly;
- industrialize a region;
- nationalize strategic sector;
- foreign investment dispute.

All must use shared scripting/effect systems and localization keys.

## 17. Diplomacy Integration

Foreign company ownership should require diplomacy rules.

Treaty articles can grant:

- foreign investment rights;
- infrastructure construction rights;
- resource extraction concession;
- protection from nationalization;
- compensation requirement;
- profit repatriation;
- company-specific concession.

Region transfer must evaluate company buildings:

- treaty-protected foreign companies may remain active;
- unprotected foreign companies may be disabled or nationalized according to law/treaty;
- diplomatic incidents can be created by uncompensated seizure.

No foreign company mechanic should bypass diplomacy validation.

## 18. Market And Building Integration

Company buildings should continue to use normal building economy.

Building runtime remains responsible for:

- inputs;
- outputs;
- extraction;
- wages;
- revenue;
- costs;
- productivity;
- inactivity reasons.

Company runtime aggregates after building runtime:

- collect owned buildings;
- compute revenue/expenses/profit;
- update treasury;
- update prosperity;
- activate modifiers;
- create explanations.

This avoids duplicating production logic in company mechanics.

## 19. UI Plan

Companies need a dedicated UI surface.

Recommended tabs:

- Overview;
- Treasury;
- Buildings;
- Investment;
- Subsidies;
- Politics;
- Events/Journals.

### Overview

Shows:

- company logo;
- name;
- home country;
- status;
- prosperity;
- profit;
- owned buildings;
- active bonuses;
- current problems.

### Treasury

Shows:

- treasury;
- last income;
- last expenses;
- net profit;
- ledger entries;
- subsidies;
- debt/credit if implemented.

### Buildings

Shows:

- owned buildings by region;
- productivity;
- revenue;
- expenses;
- profit;
- inactive reasons;
- labor/input/infrastructure coverage.

### Investment

Shows:

- active investment plans;
- queued projects;
- candidate projects;
- expected profit;
- blocked reasons.

### Subsidies

Shows:

- subsidy policy;
- state cost;
- covered losses;
- political consequences;
- action buttons.

### Politics

Shows:

- affected interest groups;
- clout effects;
- approval effects;
- nationalization/privatization consequences;
- active political movements related to company.

All visible values must have tooltips and localization.

## 20. Tooltip And Explanation Requirements

Required tooltips:

- treasury;
- last income;
- last expenses;
- profit;
- productivity;
- prosperity;
- active modifiers;
- subsidy cost;
- investment score;
- nationalization cost;
- political effects;
- company building inactivity reasons.

Required explanation records:

- treasury changes;
- profitability changes;
- prosperity changes;
- modifier activation/deactivation;
- investment candidate selection;
- construction funding;
- subsidy payment;
- nationalization/privatization;
- political clout/approval changes caused by companies.

No company UI should display unexplained numbers.

## 21. Runtime Architecture

Candidate modules:

- `companyMechanics.ts`;
- `companyTreasuryMechanics.ts`;
- `companyPerformanceMechanics.ts`;
- `companyProsperityMechanics.ts`;
- `companyInvestmentMechanics.ts`;
- `companyOwnershipMechanics.ts`;
- `companyPoliticalEffects.ts`;
- `companyExplanation.ts`;

Turn order:

1. building economy resolves;
2. company runtime aggregates owned building performance;
3. company treasury ledger entries are emitted/applied;
4. company prosperity updates;
5. company modifiers are activated/deactivated;
6. company investment candidates are generated;
7. validated construction orders/projects are created only through approved runtime path;
8. political effects are emitted through modifiers/explanations;
9. UI deltas and notifications are emitted.

Performance:

- maintain building ids by company index;
- avoid scanning all buildings for every company;
- update changed companies after building delta;
- bound company ledger history.

## 22. Orders And Validation

Potential orders:

- `SET_COMPANY_SUBSIDY`;
- `CANCEL_COMPANY_SUBSIDY`;
- `NATIONALIZE_COMPANY_BUILDINGS`;
- `PRIVATIZE_STATE_BUILDINGS`;
- `SET_COMPANY_INVESTMENT_POLICY`;
- `APPROVE_COMPANY_INVESTMENT`;
- `BLOCK_COMPANY_INVESTMENT`;
- `GRANT_COMPANY_CONCESSION`;
- `REVOKE_COMPANY_CONCESSION`.

Validation must enforce:

- acting player controls country;
- company exists;
- company belongs to country or treaty permits action;
- target buildings exist and are region-level;
- target ownership matches action;
- country can pay costs through resource ledger;
- company can pay costs through company treasury;
- law/politics requirements pass where enabled;
- no duplicate conflicting action is pending.

AI must use the same validated orders.

## 23. Scenario Defines

Company pacing belongs in scenario defines.

Example:

```json
{
  "companies": {
    "enabled": true,
    "baseProsperityDriftPerTurn": 5,
    "prosperityMin": 0,
    "prosperityMax": 100,
    "subsidyMaxDucatsPerCompanyPerTurn": 100,
    "companyLedgerRetentionTurns": 12,
    "maxActiveCompanyInvestments": 3,
    "nationalizationCompensationMultiplier": 1.0
  }
}
```

These values are examples only. Final defines must be validated and documented.

## 24. Persistence And World Delta

Potential world delta masks:

- `companiesById`;
- `companyLedgerByTurn`;
- `companyInvestmentQueueByCompany`;
- `regionBuildingsByRegion` for ownership changes;
- `resourceLedgerByTurn` for country subsidy/compensation flows.

Deltas should be scoped where possible:

- changed companies;
- changed company ledger turn;
- changed investment queues;
- changed regions with ownership updates.

Company ledger retention must be bounded.

## 25. Validation

Scenario validation must reject:

- duplicate company ids;
- missing localization keys;
- invalid company country id;
- invalid building references;
- invalid industry references;
- invalid region references;
- invalid modifier references;
- invalid logo asset paths;
- raw player-facing company text;
- unsupported old aggregate company libraries;
- company prosperity thresholds outside supported range.

Runtime validation must reject:

- invalid company ownership payloads;
- company owning forbidden building type;
- foreign ownership without permission;
- subsidy without country control;
- nationalization of unavailable buildings;
- privatization to invalid company;
- company investment with insufficient treasury;
- investment bypassing construction validation.

## 26. Testing Plan

### Unit Tests

- company definition validation;
- building ownership aggregation;
- company revenue/expense/profit calculation;
- treasury ledger application;
- prosperity target and drift;
- modifier activation by prosperity threshold;
- subsidy calculation;
- nationalization ownership transfer;
- privatization ownership transfer;
- investment candidate scoring;
- political modifier creation.

### Runtime Tests

- building profits update company treasury;
- company losses reduce treasury or create problem state;
- subsidies move money through country resource ledger and company ledger;
- nationalization updates building owner and resource flows;
- investment creates normal construction project/order path;
- company modifiers affect owned buildings only;
- company political effects are emitted through modifiers/explanations.

### UI Tests

- company overview renders status/prosperity;
- treasury tab renders ledger;
- building tab renders owned building performance;
- subsidy tooltip explains cost;
- prosperity tooltip explains sources;
- political tab renders interest group effects;
- all visible strings resolve in English and Russian.

### AI Tests

- AI subsidizes strategic company when profile weight is high;
- AI avoids bankrupting country through subsidy;
- AI invests through validated construction path;
- AI nationalizes only when legal and profile supports it;
- AI cannot mutate company treasury/building ownership directly.

## 27. Migration Plan

Phase 1: Company runtime summary.

- Add `companiesById`;
- aggregate owned buildings;
- calculate revenue, expenses, profit, productivity;
- show company overview.

Phase 2: Company treasury and ledger.

- Add treasury;
- add company ledger;
- apply building profit/loss;
- add treasury UI/tooltips.

Phase 3: Prosperity and modifiers.

- Add prosperity calculation;
- add thresholds;
- activate modifiers through shared modifier system;
- add explanations.

Phase 4: Subsidies.

- Add subsidy policy;
- pay subsidies through country resource ledger;
- receive subsidies through company ledger;
- add UI/actions.

Phase 5: Nationalization and privatization.

- Add validated ownership transfer actions;
- add compensation;
- add political/economic consequences;
- add tests.

Phase 6: Company investment.

- Add investment candidate scoring;
- add investment queues;
- create construction through validated path;
- add UI.

Phase 7: Political integration.

- Connect companies to interest group clout/approval;
- add political movement hooks;
- add laws/events/decisions/journals.

Phase 8: Diplomacy integration.

- Add foreign investment rights;
- add concession/treaty interactions;
- define region transfer company ownership policies.

## 28. Risks

### Economy Duplication

Company runtime could duplicate building economy logic.

Mitigation:

- buildings remain source of production truth;
- companies aggregate building results only;
- no company-specific production loop.

### Hidden Money Mutation

Company treasury could bypass country resource ledger.

Mitigation:

- company ledger for company money;
- country resource ledger for country money;
- explicit transfer entries between them.

### Political Side Effects Become Opaque

Company political effects could confuse players.

Mitigation:

- all effects use modifiers;
- every clout/approval change has explanation records;
- UI shows company political effects.

### Performance

Aggregating all buildings for all companies every turn can be expensive.

Mitigation:

- maintain company-to-building indexes;
- update only changed companies where possible;
- keep summaries bounded.

### Ownership Edge Cases

Region conquest, foreign investment, and nationalization can create unclear ownership.

Mitigation:

- explicit ownership policies;
- diplomacy treaty integration;
- validation;
- no silent fallback.

## 29. Definition Of Done

The company refactor is complete for the first Victoria-like slice when:

- companies have runtime state separate from scenario definitions;
- company-owned buildings aggregate into company performance;
- company treasury exists;
- company ledger explains income and expenses;
- prosperity is calculated, visible, and explained;
- company modifiers activate through the shared modifier system;
- subsidies use country resource ledger and company ledger;
- nationalization and privatization are validated actions;
- company investment uses normal construction validation;
- company ownership rules cover region transfer and foreign ownership hooks;
- company political effects use modifiers and explanation records;
- company UI shows overview, treasury, buildings, investments, subsidies, and politics;
- all visible text uses English and Russian localization keys;
- tests cover treasury, prosperity, modifiers, subsidies, ownership transfer, investment, politics, UI, and AI;
- docs and Arcawiki explain companies to authors and players.
