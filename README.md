# Arcanorum (Vite + React + WEGO)

Монорепо с клиентом и сервером для пошаговой WEGO-стратегии.

## Стек
- Клиент: Vite + React + TypeScript, Tailwind, Zustand (`worldBase + ordersOverlay`), maplibre, framer-motion, lucide-react, Headless UI Tabs, floating-ui (кастомный tooltip), radix-ui, sonner, cmdk, react-hook-form + zod, colord
- Сервер: Node + Express + WS, jsonwebtoken, SQLite + Prisma
- Опционально: Redis (presence/rate-limit/pubsub/planning cache)

## Структура
- `apps/client` — UI и WebSocket-клиент
- `apps/server` — authoritative правила, auth, map tiles (MVT), resolve turn
- `packages/shared` — общие типы и ADM1 sample
- `standarts.md` — единые стандарты UI, механик, производительности и процесса разработки
- `AGENTS.md` — обязательная точка входа для ИИ-агентов и правил разработки
- `docs/` — технический handbook проекта

## ИИ-агенты и документация
Перед разработкой агенты должны читать корневой `AGENTS.md` и релевантные folder-level инструкции:
- `apps/server/AGENTS.md`
- `apps/client/AGENTS.md`
- `packages/shared/AGENTS.md`
- `apps/server/data/AGENTS.md`
- `project_assets/AGENTS.md`

Ключевые handbook-документы:
- `docs/world-model.md` — целевая модель мира
- `docs/regions-and-provinces.md` — разделение provinces и state regions
- `docs/scenario-region-history.md` — формат региональных файлов сценария
- `docs/country-control-ai.md` — стартовые страны, режимы управления и AI takeover
- `docs/game-ai-development.md` — правила разработки игрового ИИ
- `docs/ai-testing.md` — требования к тестированию ИИ

## Целевая архитектура мира
Arcanorum 2 движется к Victoria-inspired модели:
- `Provinces` — легкие единицы карты и перемещения: adjacency graph, terrain/landscape, climate, movement cost, passability.
- `State regions` — основные единицы тяжелых механик: население, здания, строительство, ресурсы, экономика, налоги, колонизация, дипломатическая передача территорий и региональные модификаторы.
- Регион имеет legal owner, current controller, core countries и detailed claims.
- Контролер региона получает экономику региона.
- Колонизация и дипломатическая передача территорий должны работать целыми регионами.
- Страны могут стартовать без территорий; механики и UI должны это выдерживать.

Текущая кодовая база еще содержит legacy province-level механики (`provincePopulationByProvince`, `provinceBuildingsByProvince`, `provinceResourceDepositsByProvince` и т.д.). Новые тяжелые механики не должны добавляться на province-level без явного согласования; существующие province-heavy системы должны мигрировать к region-level во время серверного rewrite.

## Сценарии и игровой ИИ
Сценарии должны владеть стартовыми странами, регионами, дипломатией, AI-профилями и настройками:
```text
apps/server/data/scenarios/<scenario_id>/
  map/regions/
  history/regions/
  history/countries/
  history/diplomacy/
  common/defines.json
  common/ai/
```

Режимы управления страной:
- `player`
- `ai`
- `open`

ИИ использует hybrid model: rule filters + utility scoring + long-term plans, но итоговые действия должны проходить через обычный server-validated order pipeline, как у игроков. По умолчанию ИИ не читерит, не видит скрытую информацию и соблюдает те же costs/cooldowns/limits.

## Подготовка
1. Скопируйте `apps/server/.env.example` в `apps/server/.env`
2. БД по умолчанию: SQLite (`apps/server/prisma/dev.db`)
3. Выполните:

```bash
npm install
npm run prisma:generate -w @arcanorum/server
npm run prisma:push -w @arcanorum/server
```

## Запуск
```bash
npm run dev
```

Сервер: `http://localhost:3001`
Клиент: `http://localhost:5173`

## WEGO-поток
1. Клиенты отправляют `OrderDelta`
2. Сервер валидирует и ретранслирует `ORDER_BROADCAST`
3. В конце фазы `REQUEST_RESOLVE` → `ResolveTurn()`
4. Всем рассылается `WORLD_DELTA` (компактный формат с `mask` и короткими ключами) + `rejectedOrders`

## Синхронизация мира
- При авторизации клиент получает полный snapshot через `AUTH_OK` (`worldBase`, `turnId`, `worldStateVersion`).
- При reconnect клиент передает `lastKnownWorldStateVersion`; если replay-окно доступно, сервер может выполнить bootstrap без полного `worldBase` (через `AUTH_OK` + replay-дельты).
- Далее применяются только `WORLD_DELTA`.
- Клиент отправляет `WORLD_DELTA_ACK` после применения дельт.
- При разрыве последовательности запрашивается `WORLD_DELTA_REPLAY_REQUEST`.
- Если replay недоступен, используется `GET /world/snapshot` для мягкого ресинка.
- Broadcast игровых WS-сообщений отправляется только авторизованным сокетам; `NEWS_EVENT` с `visibility=private` маршрутизируются только целевой стране и администраторам.
- Серверный diff `WORLD_DELTA` для `colonyProgressByProvince` и `provincePopulationByProvince` использует структурное сравнение map-объектов (без `JSON.stringify`) для снижения CPU-нагрузки.
- В turn-resolve используется индекс активных колонизаций (`country -> provinces`), что уменьшает количество полных проходов по `colonyProgressByProvince`.
- В `worldBase` добавлена ветка населения `provincePopulationByProvince`:
  - `populationTotal`,
  - `%`-распределения `culturePct`, `ideologyPct`, `religionPct`, `racePct`, `professionPct` (сумма 100).
- На каждом ходу сервер обновляет население провинций (рождаемость/смертность); процентные распределения не изменяются автоматически.
- `MapView` на клиенте подписан на отдельные ветки `worldBase`, а не на весь объект, чтобы уменьшить лишние ререндеры при нерелевантных дельтах.
- На сервере используются инкрементальные индексы очереди приказов (`COLONIZE`/`BUILD`) и индекс экономического тика стран, чтобы убрать полные обходы в hot-path проверок и начислений.
- Серверный delta-pipeline использует partial snapshot по dirty-sections вместо полного клона `worldBase` перед diff, что уменьшает стоимость CPU/GC при частых локальных мутациях.
- Для населения добавлена отдельная секция `WORLD_DELTA` (`u`) и бит маски `provincePopulationByProvince`.
- Для зданий добавлена серверная добыча из провинциальных залежей:
  - настройки на уровне контент-записи здания (`extractionGoodId`, `extractionAmountPerTurn`, `extractionRequiresDeposit`),
  - добыча выполняется в экономическом тике и может уменьшать `provinceResourceDepositsByProvince`,
  - добытый ресурс попадает в склад инстанса здания (`warehouseByGoodId`) и участвует в текущей рыночной логике.
- В левой панели доступна кнопка `Население`, открывающая модальное окно статистики:
  - режим `Страна` (только свои провинции),
  - режим `Мир` (все провинции),
  - верхние вкладки: `Основная информация`, `Религии`, `Культуры`, `Профессии`, `Идеологии`, `Расы`, `Логотип и стиль`,
  - в категорийных вкладках: слева график `Apache ECharts` (`Pie with Scrollable Legend`), справа selectable-список элементов.

## Админ-диагностика
- `GET /admin/ws-delta-metrics` — метрики размера WS-дельт (compact vs baseline).
- `POST /admin/ws-delta-metrics/reset` — сброс метрик.
- `GET /admin/world-delta-log/status` — состояние персистентного журнала дельт (БД и in-memory replay window).
- Подробный план дальнейшей оптимизации state-sync: `STATE_SYNC_OPTIMIZATION_PLAN.md` (phased rollout без big-bang миграции).
- `GET /admin/provinces?q=...&limit=...&offset=...` — список провинций с поиском и опциональной пагинацией.
- Админ-управление населением:
  - `POST /admin/population/generate` — генерация населения по scope (`province|country|world`) со стратегией `random|custom`,
  - `POST /admin/population/clear` — очистка населения по scope,
  - `PATCH /admin/population/provinces/:provinceId` — ручное редактирование населения провинции.

## Важно для Windows
В текущем окружении запуск Vite может ломаться из пути с пробелом (`...\Ages 3`) из-за `esbuild` (`spawn EFTYPE`).
Решение: перенести проект в путь без пробелов (например `C:\arcanorum`) и запускать оттуда.
