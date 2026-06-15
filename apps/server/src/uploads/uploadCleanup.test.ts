import { existsSync } from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanupOrphanUploads, type UploadCleanupLogger } from "./uploadCleanup";

const tempDirs: string[] = [];
const uploadUrl = (relativePath: string) => `/scenario-assets/demo/assets/uploads/${relativePath}`;

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("cleanupOrphanUploads", () => {
  it("does nothing when disabled", async () => {
    const uploadsRoot = await createUploadsRoot(["flags/used.png"]);

    const result = cleanupOrphanUploads({
      enabled: false,
      uploadsRoot,
      referencedData: [],
      uploadReferenceRecords: [],
    });

    expect(result).toEqual({ status: "disabled" });
    expect(existsSync(join(uploadsRoot, "flags/used.png"))).toBe(true);
  });

  it("skips cleanup when files exist but no references are detected", async () => {
    const uploadsRoot = await createUploadsRoot(["flags/orphan.png"]);
    const logger = createLogger();

    const result = cleanupOrphanUploads({
      enabled: true,
      uploadsRoot,
      referencedData: [],
      uploadReferenceRecords: [],
      logger,
    });

    expect(result).toEqual({ status: "skipped-no-references", totalFiles: 1 });
    expect(logger.warn).toHaveBeenCalledWith("[uploads] Startup cleanup skipped: no references detected.");
    expect(existsSync(join(uploadsRoot, "flags/orphan.png"))).toBe(true);
  });

  it("skips cleanup when the orphan ratio is suspiciously high", async () => {
    const files = Array.from({ length: 12 }, (_, index) => `orphans/${index}.png`);
    const uploadsRoot = await createUploadsRoot([...files, "flags/used.png"]);
    const logger = createLogger();

    const result = cleanupOrphanUploads({
      enabled: true,
      uploadsRoot,
      referencedData: [{ flag: uploadUrl("flags/used.png") }],
      uploadReferenceRecords: [],
      logger,
    });

    expect(result.status).toBe("skipped-suspicious-ratio");
    expect(logger.warn).toHaveBeenCalledWith("[uploads] Startup cleanup skipped: suspicious orphan ratio 92% (12/13).");
    expect(existsSync(join(uploadsRoot, "orphans/0.png"))).toBe(true);
  });

  it("removes ordinary orphan files and preserves referenced files", async () => {
    const uploadsRoot = await createUploadsRoot(["flags/used.png", "crests/used.png", "unused/orphan.png"]);
    const logger = createLogger();

    const result = cleanupOrphanUploads({
      enabled: true,
      uploadsRoot,
      referencedData: [{ nested: [`${uploadUrl("flags/used.png")}?v=1`] }],
      uploadReferenceRecords: [{ crestUrl: uploadUrl("crests/used.png") }],
      logger,
    });

    expect(result).toEqual({
      status: "removed",
      totalFiles: 3,
      orphanFiles: 1,
      removedFiles: 1,
      referencedFiles: 2,
    });
    expect(existsSync(join(uploadsRoot, "flags/used.png"))).toBe(true);
    expect(existsSync(join(uploadsRoot, "crests/used.png"))).toBe(true);
    expect(existsSync(join(uploadsRoot, "unused/orphan.png"))).toBe(false);
    expect(logger.info).toHaveBeenCalledWith("[uploads] Startup cleanup removed 1/1 orphan files (tracked=2).");
  });

  it("reports nothing to remove when all files are referenced", async () => {
    const uploadsRoot = await createUploadsRoot(["flags/used.png"]);

    const result = cleanupOrphanUploads({
      enabled: true,
      uploadsRoot,
      referencedData: [{ flag: uploadUrl("flags/used.png") }],
      uploadReferenceRecords: [],
    });

    expect(result).toEqual({ status: "nothing-to-remove", totalFiles: 1, referencedFiles: 1 });
  });
});

async function createUploadsRoot(files: string[]): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "arc-upload-cleanup-"));
  tempDirs.push(root);
  for (const file of files) {
    const path = join(root, file);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, "");
  }
  return root;
}

function createLogger(): UploadCleanupLogger {
  return {
    warn: vi.fn(),
    info: vi.fn(),
  };
}
