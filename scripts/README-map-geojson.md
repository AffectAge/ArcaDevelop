# GeoJSON -> готовый сценарий с картой

Скрипт собирает карту как отдельный сценарий сервера. Активная карта не заменяется напрямую: сценарий появится в админке в разделе "Сценарии", и его можно будет запустить отдельным действием.

## Куда положить GeoJSON

```text
scripts/geojson/my_map.geojson
```

Если папки нет, создай ее вручную или запусти скрипт один раз, он подскажет путь.

## Одна команда

Если в `scripts/geojson` лежит один `.geojson`:

```bash
node scripts/prepare-map-from-geojson.mjs
```

Скрипт сам:

- найдет GeoJSON;
- найдет raster рядом с тем же именем, например `my_map.tif`;
- выберет подходящие bounds для игровой карты;
- определит направление Y для полигонов;
- пересоберет MVT/WebP тайлы;
- создаст сценарий в `apps/server/data/scenarios/<map-name>/`.

Если файлов несколько:

```bash
node scripts/prepare-map-from-geojson.mjs my_map.geojson
```

Можно указать путь явно:

```bash
node scripts/prepare-map-from-geojson.mjs scripts/geojson/my_map.geojson
```

Можно поменять диапазон zoom для MVT:

```bash
node scripts/prepare-map-from-geojson.mjs my_map.geojson --minzoom 0 --maxzoom 5
```

По умолчанию скрипт использует авто-режим. Если GeoJSON явно помечен как `CRS84`, `WGS84` или `EPSG:4326`, он считается настоящими координатами Земли. Остальные карты считаются плоскими игровыми картами:

```bash
node scripts/prepare-map-from-geojson.mjs my_map.geojson --coordinate-mode auto
```

Плоский режим можно включить вручную:

```bash
node scripts/prepare-map-from-geojson.mjs my_map.geojson --coordinate-mode local
```

В этом режиме скрипт берет любые координаты из GeoJSON, например пиксели или условные координаты редактора, и укладывает их в тайловое пространство MapLibre. Если GeoJSON похож на карту `X=-180..180`, `Y=-90..90`, скрипт использует эти канонические границы вместо внешнего bbox полигонов. Для гексов, которые чуть выходят за край карты, это удерживает raster и полигоны на одном месте.

Направление Y определяется автоматически. Если карта похожа на lon/lat `-180..180/-90..90`, если в GeoJSON есть `top > bottom`, или если `row_index` растет при уменьшении `Центр Y`, скрипт считает, что Y растет вверх, и сам применяет нужный переворот полигонов.

Ручной override все еще доступен:

```bash
node scripts/prepare-map-from-geojson.mjs my_map.geojson --y-up
```

Если карта получилась вверх ногами, пересобери ее с `--flip-y`:

```bash
node scripts/prepare-map-from-geojson.mjs my_map.geojson --flip-y --force
```

То же самое можно написать короче:

```bash
node scripts/prepare-map-from-geojson.mjs my_map.geojson --flip --force
```

## Фоновая текстура карты

Можно добавить растровую текстуру под полигоны. Положи TIFF/PNG/JPG/WebP рядом с GeoJSON с таким же именем:

```text
scripts/geojson/my_map.geojson
scripts/geojson/my_map.tif
```

После этого обычный запуск сам найдет текстуру:

```bash
node scripts/prepare-map-from-geojson.mjs my_map.geojson --force
```

Можно указать raster-файл явно:

```bash
node scripts/prepare-map-from-geojson.mjs my_map.geojson --raster scripts/geojson/my_texture.tif --force
```

Если нужно перевернуть и полигоны:

```bash
node scripts/prepare-map-from-geojson.mjs my_map.geojson --raster scripts/geojson/my_texture.tif --flip --force
```

`--flip` переворачивает только полигоны. Если нужно перевернуть raster-текстуру отдельно, добавь:

```bash
node scripts/prepare-map-from-geojson.mjs my_map.geojson --raster scripts/geojson/my_texture.tif --flip-raster --force
```

Скрипт нарежет текстуру в WebP-тайлы:

```text
apps/server/data/scenarios/my_map/map/tiles/raster/{z}/{x}/{y}.webp
```

Если GeoJSON все-таки настоящий земной lon/lat:

```bash
node scripts/prepare-map-from-geojson.mjs earth_map.geojson --coordinate-mode geo
```

Если такая папка сценария уже есть и ее нужно пересобрать:

```bash
node scripts/prepare-map-from-geojson.mjs my_map.geojson --force
```

## Что получится

```text
apps/server/data/scenarios/my_map/
  scenario.json
  map/
    adm1.geojson
    provinces.json
    map-meta.json
    tiles/adm1/{z}/{x}/{y}.mvt
    tiles/raster/{z}/{x}/{y}.webp
```

`scenario.json` подключает папку `map/` как карту сценария:

```json
{
  "id": "my_map",
  "name": "my_map",
  "description": "Generated from my_map.geojson.",
  "startTurn": 1,
  "mapRoot": "map"
}
```

`adm1.geojson` содержит нормализованные полигоны и `properties.id`/`properties.name`. Он нужен как build artifact и резервная полная геометрия карты, но серверу в runtime больше не обязателен.

`provinces.json` содержит список провинций:

```json
[
  {
    "id": "province_000001",
    "name": "Province #000001",
    "areaKm2": 1234,
    "province_type": "Суша",
    "area_km2": 1234,
    "center_x": 50.4,
    "center_y": 41.9,
    "sourceCenterX": 50.4,
    "sourceCenterY": 41.9,
    "neighbors": ["province_000002", "province_000003"],
    "climate": "Умеренный",
    "pollution": 0,
    "radiation": 0,
    "landscape": "Равнины",
    "continent": "Европа",
    "strategicRegion": "Земля",
    "fertileLandKm2": 1234,
    "fertility": 100
  }
]
```

Если в исходном GeoJSON есть поля `province_type`, `area_km2`, `center_x`, `center_y`, `neighbors`, они сохраняются в `provinces.json`. Также поддерживаются новые русские названия: `Тип провинции`, `Площадь км2`, `Центр X`, `Центр Y`, `Соседи`, `Климат`, `Загрязнение`, `Радиация`, `Ландшафт`, `Континент`, `Стратегический регион`, `Плодородные земли`, `Плодородность`.

`province_id` теперь имеет приоритет над техническим `id`, потому что `Соседи` обычно ссылаются именно на `province_id`. `Тип провинции` записывается как есть, например `Суша`, `Море`, `Океан`. Поле `neighbors` превращается в массив строк. Если `area_km2` / `Площадь км2` пустое, скрипт рассчитает площадь сам.

В `--coordinate-mode local` поля `center_x` / `center_y` записываются уже в координатах готовой карты, чтобы маркеры и коридоры попадали в нужное место. Исходные координаты центра сохраняются отдельно в `sourceCenterX` / `sourceCenterY`.

`tiles/adm1` содержит MVT-тайлы со слоем `adm1`, который ожидает текущий `MapView`.

`tiles/raster` появляется только если была найдена или указана растровая текстура.

`map-meta.json` хранит режим координат, исходные границы карты, выбранные границы трансформации, результат авто-определения Y и границы тайловой версии.

## Важно

Скрипт не трогает:

```text
apps/server/data/provinces.json
apps/server/data/tiles/adm1
apps/server/data/tiles/raster
```

Чтобы сделать карту активной в игре, открой админку, раздел "Сценарии", и запусти созданный сценарий.
