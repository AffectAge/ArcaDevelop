import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, renameSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, parse, relative, resolve } from "node:path";
import geojsonvt from "geojson-vt";
import sharp from "sharp";
import vtpbf from "vt-pbf";

const root = process.cwd();
const inputDir = resolve(root, "scripts/geojson");
const scenariosRoot = resolve(root, "apps/server/data/scenarios");

const args = process.argv.slice(2);

if (args.includes("--help") || args.includes("-h")) {
  console.log(`
Usage:
  node scripts/prepare-map-from-geojson.mjs
  node scripts/prepare-map-from-geojson.mjs my_map.geojson
  node scripts/prepare-map-from-geojson.mjs scripts/geojson/my_map.geojson --minzoom 0 --maxzoom 5
  node scripts/prepare-map-from-geojson.mjs my_map.geojson --force
  node scripts/prepare-map-from-geojson.mjs my_map.geojson --coordinate-mode auto
  node scripts/prepare-map-from-geojson.mjs my_map.geojson --coordinate-mode local
  node scripts/prepare-map-from-geojson.mjs earth_map.geojson --coordinate-mode geo
  node scripts/prepare-map-from-geojson.mjs my_map.geojson --flip-y --force
  node scripts/prepare-map-from-geojson.mjs my_map.geojson --flip --force
  node scripts/prepare-map-from-geojson.mjs my_map.geojson --raster scripts/geojson/my_map.tif --force
  node scripts/prepare-map-from-geojson.mjs my_map.geojson --raster scripts/geojson/my_map.tif --flip-raster --force

Input:
  scripts/geojson/*.geojson

Output:
  apps/server/data/scenarios/<map-name>/scenario.json
  apps/server/data/scenarios/<map-name>/map/adm1.geojson
  apps/server/data/scenarios/<map-name>/map/provinces.json
  apps/server/data/scenarios/<map-name>/map/map-meta.json
  apps/server/data/scenarios/<map-name>/map/tiles/adm1/{z}/{x}/{y}.mvt
  apps/server/data/scenarios/<map-name>/map/tiles/raster/{z}/{x}/{y}.webp
`);
  process.exit(0);
}

function readOption(name, fallback) {
  const index = args.indexOf(name);
  if (index < 0) return fallback;
  const value = args[index + 1];
  return value == null || value.startsWith("--") ? fallback : value;
}

function readFlaglessArgs() {
  const result = [];
  const optionsWithValue = new Set(["--minzoom", "--maxzoom", "--coordinate-mode", "--raster"]);
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg.startsWith("--")) {
      if (optionsWithValue.has(arg)) i += 1;
      continue;
    }
    result.push(arg);
  }
  return result;
}

const minZoom = Number(readOption("--minzoom", "0"));
const maxZoom = Number(readOption("--maxzoom", "5"));
const requestedCoordinateMode = readOption("--coordinate-mode", "auto");
let coordinateMode = requestedCoordinateMode;
const rasterOption = readOption("--raster", "");
const force = args.includes("--force");
const manualYUp = args.includes("--y-up") || args.includes("--flip-y") || args.includes("--flip");
let yUp = manualYUp;
const flipRaster = args.includes("--flip-raster");

if (!Number.isInteger(minZoom) || !Number.isInteger(maxZoom) || minZoom < 0 || maxZoom < minZoom || maxZoom > 12) {
  throw new Error(`Invalid zoom range: min=${minZoom}, max=${maxZoom}. Use integers, 0 <= min <= max <= 12.`);
}
if (coordinateMode !== "auto" && coordinateMode !== "local" && coordinateMode !== "geo") {
  throw new Error(`Invalid coordinate mode: ${coordinateMode}. Use "auto", "local" or "geo".`);
}

function resolveInputPath() {
  const [requested] = readFlaglessArgs();
  if (requested) {
    const direct = isAbsolute(requested) ? requested : resolve(root, requested);
    if (existsSync(direct)) return direct;
    const fromInputDir = resolve(inputDir, requested);
    if (existsSync(fromInputDir)) return fromInputDir;
    throw new Error(`GeoJSON not found: ${requested}`);
  }

  if (!existsSync(inputDir)) {
    mkdirSync(inputDir, { recursive: true });
    throw new Error(`Put a .geojson file into ${inputDir} and run the script again.`);
  }

  const files = readdirSync(inputDir).filter((name) => /\.geojson$/i.test(name)).sort((a, b) => a.localeCompare(b));
  if (files.length === 0) {
    throw new Error(`No .geojson files found in ${inputDir}`);
  }
  if (files.length > 1) {
    throw new Error(`Multiple .geojson files found. Run with a file name: node scripts/prepare-map-from-geojson.mjs ${files[0]}`);
  }
  return resolve(inputDir, files[0]);
}

function resolveRasterPath(geojsonPath) {
  if (rasterOption) {
    const direct = isAbsolute(rasterOption) ? rasterOption : resolve(root, rasterOption);
    if (existsSync(direct)) return direct;
    const fromInputDir = resolve(inputDir, rasterOption);
    if (existsSync(fromInputDir)) return fromInputDir;
    throw new Error(`Raster texture not found: ${rasterOption}`);
  }

  const parsed = parse(geojsonPath);
  for (const extension of [".tif", ".tiff", ".png", ".jpg", ".jpeg", ".webp"]) {
    const candidate = join(parsed.dir, `${parsed.name}${extension}`);
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

function sanitizeMapName(name) {
  return name
    .trim()
    .replace(/\.geojson$/i, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/^\.+|\.+$/g, "")
    .replace(/^_+|_+$/g, "")
    || "map";
}

function sanitizeScenarioId(name) {
  return sanitizeMapName(name)
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80)
    || "map";
}

function normalizeId(raw, fallbackIndex, usedIds) {
  const base = String(raw ?? "")
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9а-яА-ЯёЁ._:-]+/g, "_")
    .replace(/^_+|_+$/g, "");
  let id = base || `province_${String(fallbackIndex + 1).padStart(6, "0")}`;
  let suffix = 2;
  while (usedIds.has(id)) {
    id = `${base || `province_${String(fallbackIndex + 1).padStart(6, "0")}`}_${suffix}`;
    suffix += 1;
  }
  usedIds.add(id);
  return id;
}

function getFirstProperty(props, keys) {
  for (const key of keys) {
    const value = props[key];
    if (value != null && String(value).trim().length > 0) return value;
  }
  return null;
}

function parseOptionalNumber(value) {
  if (value == null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizeNeighbors(value) {
  if (value == null || value === "") return [];
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  return String(value)
    .split(/[,\s;]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function pickMetadata(props) {
  return {
    climate: getFirstProperty(props, ["climate", "Climate", "CLIMATE", "Климат"]),
    pollution: parseOptionalNumber(getFirstProperty(props, ["pollution", "Pollution", "POLLUTION", "Загрязнение"])),
    radiation: parseOptionalNumber(getFirstProperty(props, ["radiation", "Radiation", "RADIATION", "Радиация"])),
    landscape: getFirstProperty(props, ["landscape", "terrain", "Landscape", "Terrain", "LANDSCAPE", "TERRAIN", "Ландшафт"]),
    continent: getFirstProperty(props, ["continent", "Continent", "CONTINENT", "Континент"]),
    strategicRegion: getFirstProperty(props, ["strategic_region", "strategicRegion", "Strategic Region", "STRATEGIC_REGION", "Стратегический регион"]),
    fertileLandKm2: parseOptionalNumber(getFirstProperty(props, ["fertile_land_km2", "fertileLandKm2", "Fertile Land Km2", "Плодородные земли"])),
    fertility: parseOptionalNumber(getFirstProperty(props, ["fertility", "Fertility", "FERTILITY", "Плодородность"])),
  };
}

function isPolygonGeometry(geometry) {
  return geometry?.type === "Polygon" || geometry?.type === "MultiPolygon";
}

function ringAreaPlanar(ring) {
  if (!Array.isArray(ring) || ring.length < 4) return 0;
  let area = 0;
  for (let i = 0; i < ring.length - 1; i += 1) {
    const a = ring[i];
    const b = ring[i + 1];
    if (!Array.isArray(a) || !Array.isArray(b)) continue;
    area += Number(a[0]) * Number(b[1]) - Number(b[0]) * Number(a[1]);
  }
  return area / 2;
}

function geometryAreaUnits(geometry) {
  const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  let area = 0;
  for (const polygon of polygons) {
    if (!Array.isArray(polygon) || polygon.length === 0) continue;
    const outer = Math.abs(ringAreaPlanar(polygon[0]));
    const holes = polygon.slice(1).reduce((sum, ring) => sum + Math.abs(ringAreaPlanar(ring)), 0);
    area += Math.max(0, outer - holes);
  }
  return area;
}

function geometryAreaApproxKm2(geometry, mode) {
  const area = geometryAreaUnits(geometry);
  if (mode === "local") return Math.max(1, Math.round(area));
  // This is intentionally approximate. The game mostly needs a stable scale for costs.
  return Math.max(1, Math.round(area * 12_364));
}

function extendBbox(bbox, coordinate) {
  if (!Array.isArray(coordinate)) return bbox;
  const x = Number(coordinate[0]);
  const y = Number(coordinate[1]);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return bbox;
  bbox.minX = Math.min(bbox.minX, x);
  bbox.minY = Math.min(bbox.minY, y);
  bbox.maxX = Math.max(bbox.maxX, x);
  bbox.maxY = Math.max(bbox.maxY, y);
  return bbox;
}

function visitCoordinates(value, callback) {
  if (!Array.isArray(value)) return;
  if (typeof value[0] === "number" && typeof value[1] === "number") {
    callback(value);
    return;
  }
  for (const child of value) visitCoordinates(child, callback);
}

function getFeatureCollectionBbox(features) {
  const bbox = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  for (const feature of features) {
    visitCoordinates(feature.geometry?.coordinates, (coordinate) => extendBbox(bbox, coordinate));
  }
  if (![bbox.minX, bbox.minY, bbox.maxX, bbox.maxY].every(Number.isFinite) || bbox.minX === bbox.maxX || bbox.minY === bbox.maxY) {
    throw new Error("Cannot calculate source bounds. Check GeoJSON coordinates.");
  }
  return bbox;
}

function shouldUseCanonicalLocalBounds(bbox) {
  const width = bbox.maxX - bbox.minX;
  const height = bbox.maxY - bbox.minY;
  return (
    bbox.minX <= -170
    && bbox.maxX >= 170
    && bbox.minY <= -80
    && bbox.maxY >= 80
    && width <= 400
    && height <= 230
  );
}

function hasGeographicCrs(source) {
  const name = String(source?.crs?.properties?.name ?? source?.crs?.name ?? "").toLowerCase();
  return name.includes("crs84") || name.includes("epsg:4326") || name.includes("wgs84") || name.includes("wgs 84");
}

function resolveCoordinateMode(source) {
  if (requestedCoordinateMode !== "auto") return requestedCoordinateMode;
  return hasGeographicCrs(source) ? "geo" : "local";
}

function readFeatureNumber(feature, keys) {
  const props = feature.properties && typeof feature.properties === "object" ? feature.properties : {};
  return parseOptionalNumber(getFirstProperty(props, keys));
}

function inferLocalYAxis(features) {
  let topBottomVotes = 0;
  for (const feature of features.slice(0, 50)) {
    const top = readFeatureNumber(feature, ["top", "Top", "TOP"]);
    const bottom = readFeatureNumber(feature, ["bottom", "Bottom", "BOTTOM"]);
    if (top != null && bottom != null && top > bottom) topBottomVotes += 1;
  }
  if (topBottomVotes > 0) {
    return { yUp: true, reason: "top/bottom properties" };
  }

  const rows = [];
  for (const feature of features) {
    const row = readFeatureNumber(feature, ["row_index", "rowIndex", "ROW_INDEX"]);
    const centerY = readFeatureNumber(feature, ["center_y", "centerY", "CENTER_Y", "Центр Y"]);
    if (row != null && centerY != null) rows.push({ row, centerY });
  }
  rows.sort((a, b) => a.row - b.row);
  for (let i = 1; i < rows.length; i += 1) {
    if (rows[i].row > rows[i - 1].row && rows[i].centerY < rows[i - 1].centerY) {
      return { yUp: true, reason: "row_index/center_y trend" };
    }
  }

  return { yUp: false, reason: "default local Y down" };
}

function chooseLocalTransform(features) {
  const rawBounds = getFeatureCollectionBbox(features);
  const canonicalBounds = shouldUseCanonicalLocalBounds(rawBounds)
    ? { minX: -180, minY: -90, maxX: 180, maxY: 90 }
    : null;
  const yAxis = manualYUp
    ? { yUp: true, reason: "manual flag" }
    : canonicalBounds
      ? { yUp: true, reason: "canonical lon/lat-like bounds" }
      : inferLocalYAxis(features);
  return {
    rawBounds,
    bounds: canonicalBounds ?? rawBounds,
    boundsMode: canonicalBounds ? "canonical-world" : "source-bbox",
    yUp: yAxis.yUp,
    yAxisReason: yAxis.reason,
  };
}

function transformLocalCoordinate(coordinate, bbox) {
  const x = Number(coordinate[0]);
  const y = Number(coordinate[1]);
  const nx = (x - bbox.minX) / (bbox.maxX - bbox.minX);
  const nyRaw = (y - bbox.minY) / (bbox.maxY - bbox.minY);
  const ny = yUp ? 1 - nyRaw : nyRaw;
  const lon = -180 + nx * 360;
  const lat = 85 - ny * 170;
  return [Number(lon.toFixed(7)), Number(lat.toFixed(7))];
}

function transformGeometryToTileSpace(geometry, bbox) {
  if (coordinateMode === "geo") return geometry;
  return {
    ...geometry,
    coordinates: transformCoordinates(geometry.coordinates, bbox),
  };
}

function transformCoordinates(value, bbox) {
  if (!Array.isArray(value)) return value;
  if (typeof value[0] === "number" && typeof value[1] === "number") {
    return transformLocalCoordinate(value, bbox);
  }
  return value.map((child) => transformCoordinates(child, bbox));
}

function normalizeFeatureCollection(source, localTransform) {
  if (source?.type !== "FeatureCollection" || !Array.isArray(source.features)) {
    throw new Error("Input must be a GeoJSON FeatureCollection.");
  }

  const usedIds = new Set();
  const provinces = [];
  const skipped = [];
  const features = [];
  const validInputFeatures = source.features.filter((feature) => isPolygonGeometry(feature?.geometry));
  const rawSourceBounds = validInputFeatures.length > 0 ? getFeatureCollectionBbox(validInputFeatures) : null;
  const sourceBounds = coordinateMode === "local" ? localTransform.bounds : rawSourceBounds;

  source.features.forEach((feature, index) => {
    const geometry = feature?.geometry;
    if (!isPolygonGeometry(geometry)) {
      skipped.push({ index, reason: "not Polygon/MultiPolygon" });
      return;
    }

    const props = feature.properties && typeof feature.properties === "object" ? feature.properties : {};
    const rawId = getFirstProperty(props, ["province_id", "PROVINCE_ID", "provinceId", "id", "ID", "adm1_code", "ADM1_CODE", "GID_1"]);
    const id = normalizeId(rawId, index, usedIds);
    const rawName = getFirstProperty(props, ["name", "NAME", "NAME_1", "province", "PROVINCE", "admin", "ADMIN", "display_name"]);
    const name = rawName ? String(rawName).trim() : `Province #${id.replace(/^province_/, "")}`;
    const rawProvinceType = getFirstProperty(props, ["province_type", "provinceType", "type", "TYPE", "Тип провинции"]);
    const provinceType = rawProvinceType == null ? null : String(rawProvinceType).trim();
    const sourceAreaKm2 = parseOptionalNumber(getFirstProperty(props, ["area_km2", "areaKm2", "AREA_KM2", "Площадь км2", "Площадь км²"]));
    const areaKm2 = sourceAreaKm2 ?? geometryAreaApproxKm2(geometry, coordinateMode);
    const sourceCenterX = parseOptionalNumber(getFirstProperty(props, ["center_x", "centerX", "CENTER_X", "Центр X"]));
    const sourceCenterY = parseOptionalNumber(getFirstProperty(props, ["center_y", "centerY", "CENTER_Y", "Центр Y"]));
    const transformedCenter =
      sourceCenterX == null || sourceCenterY == null
        ? [sourceCenterX, sourceCenterY]
        : coordinateMode === "local"
          ? transformLocalCoordinate([sourceCenterX, sourceCenterY], sourceBounds)
          : [sourceCenterX, sourceCenterY];
    const centerX = transformedCenter[0];
    const centerY = transformedCenter[1];
    const neighbors = normalizeNeighbors(getFirstProperty(props, ["neighbors", "NEIGHBORS", "neighbor_ids", "neighborIds", "Соседи"]));
    const metadata = pickMetadata(props);
    const tileGeometry = coordinateMode === "local" ? transformGeometryToTileSpace(geometry, sourceBounds) : geometry;

    features.push({
      ...feature,
      geometry: tileGeometry,
      properties: {
        ...props,
        id,
        name,
        province_type: provinceType ?? null,
        area_km2: areaKm2,
        center_x: centerX,
        center_y: centerY,
        source_center_x: sourceCenterX,
        source_center_y: sourceCenterY,
        neighbors,
        climate: metadata.climate,
        pollution: metadata.pollution,
        radiation: metadata.radiation,
        landscape: metadata.landscape,
        continent: metadata.continent,
        strategic_region: metadata.strategicRegion,
        fertile_land_km2: metadata.fertileLandKm2,
        fertility: metadata.fertility,
      },
    });
    provinces.push({
      id,
      name,
      areaKm2,
      province_type: provinceType ?? null,
      area_km2: areaKm2,
      center_x: centerX,
      center_y: centerY,
      sourceCenterX,
      sourceCenterY,
      neighbors,
      climate: metadata.climate,
      pollution: metadata.pollution,
      radiation: metadata.radiation,
      landscape: metadata.landscape,
      continent: metadata.continent,
      strategicRegion: metadata.strategicRegion,
      fertileLandKm2: metadata.fertileLandKm2,
      fertility: metadata.fertility,
    });
  });

  return {
    geojson: { type: "FeatureCollection", features },
    provinces,
    skipped,
    sourceBounds,
    rawSourceBounds,
    localTransform: coordinateMode === "local" ? localTransform : null,
  };
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function buildTiles(geojson, outRoot) {
  const index = geojsonvt(geojson, {
    maxZoom,
    tolerance: 3,
    extent: 4096,
    buffer: 64,
  });

  let written = 0;
  for (let z = minZoom; z <= maxZoom; z += 1) {
    const max = 1 << z;
    const total = max * max;
    let checked = 0;
    let zoomWritten = 0;

    for (let x = 0; x < max; x += 1) {
      for (let y = 0; y < max; y += 1) {
        checked += 1;
        const tile = index.getTile(z, x, y);
        if (tile) {
          const buffer = vtpbf.fromGeojsonVt({ adm1: tile }, { version: 2 });
          const filePath = join(outRoot, String(z), String(x), `${y}.mvt`);
          mkdirSync(dirname(filePath), { recursive: true });
          writeFileSync(filePath, Buffer.from(buffer));
          written += 1;
          zoomWritten += 1;
        }
      }
    }

    console.log(`  z${z}: checked ${checked}/${total}, wrote ${zoomWritten}`);
  }
  return written;
}

async function buildRasterTiles(inputPath, outRoot) {
  const tileSize = 256;
  const source = sharp(inputPath, { limitInputPixels: false }).ensureAlpha();
  const { data: sourceData, info } = await source.raw().toBuffer({ resolveWithObject: true });
  const sourceWidth = info.width;
  const sourceHeight = info.height;
  const sourceChannels = info.channels;
  if (!sourceWidth || !sourceHeight) {
    throw new Error(`Cannot read raster size: ${inputPath}`);
  }

  let written = 0;
  for (let z = minZoom; z <= maxZoom; z += 1) {
    const max = 1 << z;
    const total = max * max;
    let zoomWritten = 0;

    for (let x = 0; x < max; x += 1) {
      for (let y = 0; y < max; y += 1) {
        const filePath = join(outRoot, String(z), String(x), `${y}.webp`);

        mkdirSync(dirname(filePath), { recursive: true });
        if (coordinateMode === "geo") {
          const tileData = Buffer.alloc(tileSize * tileSize * 4);
          const sourceXs = Array.from({ length: tileSize }, (_, px) => {
            const worldX = (x + (px + 0.5) / tileSize) / max;
            return Math.max(0, Math.min(sourceWidth - 1, Math.floor(worldX * sourceWidth)));
          });
          const sourceYs = Array.from({ length: tileSize }, (_, py) => {
            const worldY = (y + (py + 0.5) / tileSize) / max;
            const mercator = Math.PI * (1 - 2 * worldY);
            const lat = Math.atan(Math.sinh(mercator)) * 180 / Math.PI;
            let sy = Math.floor(((90 - lat) / 180) * sourceHeight);
            sy = Math.max(0, Math.min(sourceHeight - 1, sy));
            return flipRaster ? sourceHeight - 1 - sy : sy;
          });

          for (let py = 0; py < tileSize; py += 1) {
            const sy = sourceYs[py];
            for (let px = 0; px < tileSize; px += 1) {
              const sx = sourceXs[px];
              const sourceIndex = (sy * sourceWidth + sx) * sourceChannels;
              const targetIndex = (py * tileSize + px) * 4;
              tileData[targetIndex] = sourceData[sourceIndex] ?? 0;
              tileData[targetIndex + 1] = sourceData[sourceIndex + 1] ?? 0;
              tileData[targetIndex + 2] = sourceData[sourceIndex + 2] ?? 0;
              tileData[targetIndex + 3] = sourceData[sourceIndex + 3] ?? 255;
            }
          }

          await sharp(tileData, { raw: { width: tileSize, height: tileSize, channels: 4 } })
            .webp({ quality: 82, effort: 4 })
            .toFile(filePath);
        } else {
          const sourceY = flipRaster ? max - 1 - y : y;
          const left = Math.floor((x * sourceWidth) / max);
          const top = Math.floor((sourceY * sourceHeight) / max);
          const right = Math.floor(((x + 1) * sourceWidth) / max);
          const bottom = Math.floor(((sourceY + 1) * sourceHeight) / max);
          const width = Math.max(1, right - left);
          const height = Math.max(1, bottom - top);
          let tile = sharp(inputPath, { limitInputPixels: false })
            .extract({ left, top, width, height })
            .resize(tileSize, tileSize, { fit: "fill" });
          if (flipRaster) {
            tile = tile.flip();
          }
          await tile.webp({ quality: 82, effort: 4 }).toFile(filePath);
        }
        written += 1;
        zoomWritten += 1;
      }
    }

    console.log(`  z${z}: wrote ${zoomWritten}/${total} raster tiles`);
  }
  return { tileCount: written, tileSize, width: sourceWidth, height: sourceHeight };
}

const inputPath = resolveInputPath();
const rasterInputPath = resolveRasterPath(inputPath);
const mapName = sanitizeScenarioId(parse(inputPath).name);
const finalDir = resolve(scenariosRoot, mapName);
const tempDir = resolve(scenariosRoot, `${mapName}.tmp-${Date.now()}`);
const finalMapDir = resolve(finalDir, "map");
const tempMapDir = resolve(tempDir, "map");

if (existsSync(finalDir) && !force) {
  throw new Error(`Scenario output already exists: ${finalDir}. Use --force to rebuild it.`);
}

console.log(`Reading GeoJSON: ${inputPath}`);
const source = JSON.parse(readFileSync(inputPath, "utf8"));
if (source?.type !== "FeatureCollection" || !Array.isArray(source.features)) {
  throw new Error("Input must be a GeoJSON FeatureCollection.");
}
const validInputFeatures = source.features.filter((feature) => isPolygonGeometry(feature?.geometry));
if (validInputFeatures.length === 0) {
  throw new Error("No valid Polygon/MultiPolygon provinces found.");
}
coordinateMode = resolveCoordinateMode(source);
const localTransform = coordinateMode === "local" ? chooseLocalTransform(validInputFeatures) : null;
if (localTransform) {
  yUp = localTransform.yUp;
}

console.log("Normalizing provinces...");
const normalized = normalizeFeatureCollection(source, localTransform);
if (normalized.provinces.length === 0) {
  throw new Error("No valid Polygon/MultiPolygon provinces found.");
}

console.log(`  Provinces: ${normalized.provinces.length}`);
console.log(`  Skipped features: ${normalized.skipped.length}`);
console.log(`  Coordinate mode: ${coordinateMode}${coordinateMode === "local" ? ` (${yUp ? "Y up" : "Y down"})` : ""}`);
if (localTransform) {
  console.log(`  Local bounds: ${localTransform.boundsMode}`);
  console.log(`  Y-axis detection: ${localTransform.yAxisReason}`);
}
console.log(`  Raster texture: ${rasterInputPath ?? "none"}`);
if (rasterInputPath) console.log(`  Raster flip: ${flipRaster ? "yes" : "no"}`);

if (existsSync(tempDir)) rmSync(tempDir, { recursive: true, force: true });
mkdirSync(tempDir, { recursive: true });

try {
  console.log("Writing scenario, adm1.geojson and provinces.json...");
  writeJson(join(tempDir, "scenario.json"), {
    id: mapName,
    name: mapName,
    description: `Generated from ${parse(inputPath).base}.`,
    startTurn: 1,
    mapRoot: "map",
  });
  writeJson(join(tempMapDir, "adm1.geojson"), normalized.geojson);
  writeJson(join(tempMapDir, "provinces.json"), normalized.provinces);

  console.log(`Building MVT tiles z${minZoom}-z${maxZoom}...`);
  const tileCount = buildTiles(normalized.geojson, join(tempMapDir, "tiles/adm1"));
  const raster = rasterInputPath
    ? await buildRasterTiles(rasterInputPath, join(tempMapDir, "tiles/raster"))
    : null;

  const meta = {
    id: mapName,
    source: inputPath,
    scenario: {
      id: mapName,
      root: relative(root, finalDir).replace(/\\/g, "/"),
      mapRoot: "map",
    },
    provinceCount: normalized.provinces.length,
    skippedFeatureCount: normalized.skipped.length,
    tileLayer: "adm1",
    tileMinZoom: minZoom,
    tileMaxZoom: maxZoom,
    tileCount,
    raster: raster
      ? {
          source: rasterInputPath,
          tileFormat: "webp",
          tileSize: raster.tileSize,
          tileCount: raster.tileCount,
          width: raster.width,
          height: raster.height,
          flipped: flipRaster,
          tiles: "tiles/raster/{z}/{x}/{y}.webp",
        }
      : null,
    coordinateMode,
    sourceBounds: normalized.sourceBounds,
    rawSourceBounds: normalized.rawSourceBounds,
    localBoundsMode: localTransform?.boundsMode ?? null,
    yAxisDetection: localTransform?.yAxisReason ?? null,
    tileBounds: coordinateMode === "local" ? { west: -180, south: -85, east: 180, north: 85 } : null,
    yAxis: coordinateMode === "local" ? (yUp ? "up" : "down") : null,
    generatedAt: new Date().toISOString(),
    files: {
      geojson: "adm1.geojson",
      provinces: "provinces.json",
      tiles: "tiles/adm1/{z}/{x}/{y}.mvt",
      rasterTiles: raster ? "tiles/raster/{z}/{x}/{y}.webp" : null,
    },
  };
  writeJson(join(tempMapDir, "map-meta.json"), meta);

  if (existsSync(finalDir)) rmSync(finalDir, { recursive: true, force: true });
  mkdirSync(scenariosRoot, { recursive: true });
  renameSync(tempDir, finalDir);

  console.log("");
  console.log("Done.");
  console.log(`Scenario output: ${finalDir}`);
  console.log(`Map output: ${finalMapDir}`);
  console.log(`Tiles: ${tileCount}`);
  if (raster) console.log(`Raster tiles: ${raster.tileCount}`);
} catch (error) {
  if (existsSync(tempDir)) rmSync(tempDir, { recursive: true, force: true });
  throw error;
}
