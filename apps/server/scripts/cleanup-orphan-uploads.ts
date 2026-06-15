import { PrismaClient } from "@prisma/client";
import { existsSync, readdirSync, readFileSync, statSync, unlinkSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { resolveScenarioUploadsRoot } from "../src/uploads/uploadPaths";
import { collectUploadPathsFromUnknown, extractUploadRelativePathFromUrl } from "../src/uploads/uploadValidation";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const serverRoot = resolve(__dirname, "..");
dotenv.config({ path: resolve(serverRoot, ".env") });
if (!process.env.DATABASE_URL) {
  const fallbackDbPath = resolve(serverRoot, "prisma/dev.db").replace(/\\/g, "/");
  process.env.DATABASE_URL = `file:${fallbackDbPath}`;
}
const dataRoot = resolve(serverRoot, "data");
const statePath = resolve(serverRoot, "data/game-state.json");
const prisma = new PrismaClient();

function collectStateUrls(input: unknown, sink: Set<string>): void {
  collectUploadPathsFromUnknown(input, sink);
}

function listUploadFiles(root: string): string[] {
  const result: string[] = [];
  const walk = (base: string, relBase = "") => {
    const entries = readdirSync(base, { withFileTypes: true });
    for (const entry of entries) {
      const rel = relBase ? `${relBase}/${entry.name}` : entry.name;
      const abs = resolve(base, entry.name);
      if (entry.isDirectory()) {
        walk(abs, rel);
      } else if (entry.isFile()) {
        result.push(rel.replace(/\\/g, "/"));
      }
    }
  };
  walk(root);
  return result;
}

async function main() {
  const apply = process.argv.includes("--apply");
  const scenarioId = readArgValue("--scenario") ?? "active";
  const uploadsRoot = resolveScenarioUploadsRoot(dataRoot, scenarioId);
  const referenced = new Set<string>();
  const hasState = existsSync(statePath);

  if (hasState) {
    const raw = readFileSync(statePath, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    collectStateUrls(parsed, referenced);
  }

  const countries = await prisma.country.findMany({
    select: { flagUrl: true, crestUrl: true },
  });
  for (const country of countries) {
    const flagRel = extractUploadRelativePathFromUrl(country.flagUrl);
    if (flagRel) referenced.add(flagRel);
    const crestRel = extractUploadRelativePathFromUrl(country.crestUrl);
    if (crestRel) referenced.add(crestRel);
  }

  if (!existsSync(uploadsRoot)) {
    console.log(`[cleanup-orphan-uploads] scenario uploads directory not found for ${scenarioId}, nothing to do.`);
    return;
  }

  const files = listUploadFiles(uploadsRoot);
  const orphan = files.filter((rel) => !referenced.has(rel));
  if (apply && !hasState) {
    throw new Error("game-state.json not found; refusing to apply cleanup without state references");
  }

  let reclaimedBytes = 0;
  if (apply) {
    for (const rel of orphan) {
      const abs = resolve(uploadsRoot, rel);
      try {
        const size = statSync(abs).size;
        unlinkSync(abs);
        reclaimedBytes += size;
      } catch {
        // ignore per-file delete errors
      }
    }
  }

  const mb = (bytes: number) => (bytes / (1024 * 1024)).toFixed(2);
  console.log(`[cleanup-orphan-uploads] mode=${apply ? "apply" : "dry-run"}`);
  console.log(`[cleanup-orphan-uploads] scenario=${scenarioId}`);
  console.log(`[cleanup-orphan-uploads] referenced=${referenced.size}`);
  console.log(`[cleanup-orphan-uploads] files=${files.length}`);
  console.log(`[cleanup-orphan-uploads] orphan=${orphan.length}`);
  if (orphan.length > 0) {
    const preview = orphan.slice(0, 20);
    console.log("[cleanup-orphan-uploads] sample:", preview);
  }
  if (apply) {
    console.log(`[cleanup-orphan-uploads] reclaimed=${mb(reclaimedBytes)} MB`);
  }
}

function readArgValue(name: string): string | null {
  const index = process.argv.indexOf(name);
  if (index < 0) return null;
  const value = process.argv[index + 1];
  return value && !value.startsWith("--") ? value : null;
}

main()
  .catch((error) => {
    console.error("[cleanup-orphan-uploads] failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
