import { existsSync } from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  defaultScenarioUploadDataRoot,
  setActiveUploadScenario,
} from "./uploadPaths";
import {
  collectUploadPathsFromUnknown,
  extractUploadRelativePathFromUrl,
  listUploadFilesRecursively,
  makeVersionedUploadUrl,
  normalizeUploadRelativePath,
  removeUploadedFile,
  removeUploadedFiles,
  removeUploadedByUrl,
  resolveUploadPathInsideRoot,
  validateImageDimensions,
  validateImageRule,
} from "./uploadValidation";

const tempDirs: string[] = [];

afterEach(async () => {
  vi.restoreAllMocks();
  setActiveUploadScenario({ dataRoot: defaultScenarioUploadDataRoot, scenarioId: "active" });
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("uploadValidation", () => {
  it("validates square image dimensions", async () => {
    const file = await writeSvgFile(64, 64);

    expect(validateImageDimensions(file, 64)).toBe(true);
    expect(validateImageDimensions(file, 32)).toBe(false);
  });

  it("validates exact image rules with ratio tolerance", async () => {
    const flagFile = await writeSvgFile(192, 128);
    const wrongRatioFile = await writeSvgFile(192, 120);

    expect(validateImageRule(flagFile, { maxWidth: 192, maxHeight: 128, ratioWidth: 3, ratioHeight: 2 })).toBe(true);
    expect(validateImageRule(wrongRatioFile, { maxWidth: 192, maxHeight: 128, ratioWidth: 3, ratioHeight: 2 })).toBe(
      false,
    );
  });

  it("extracts upload-relative paths from local and absolute URLs", () => {
    const removedGlobalUploadUrl = ["/upl", "oads/flags/a.png?v=1"].join("");

    expect(extractUploadRelativePathFromUrl("/scenario-assets/demo/assets/uploads/flags/a.png?v=1#hash")).toBe(
      "flags/a.png",
    );
    expect(extractUploadRelativePathFromUrl("https://example.test/scenario-assets/demo/assets/uploads/crests/a.png?v=1")).toBe(
      "crests/a.png",
    );
    expect(extractUploadRelativePathFromUrl(removedGlobalUploadUrl)).toBeNull();
    expect(extractUploadRelativePathFromUrl("https://example.test/assets/a.png")).toBeNull();
    expect(extractUploadRelativePathFromUrl(null)).toBeNull();
  });

  it("rejects unsafe upload-relative paths", () => {
    expect(extractUploadRelativePathFromUrl("/scenario-assets/demo/assets/uploads/../secret.txt")).toBeNull();
    expect(extractUploadRelativePathFromUrl("/scenario-assets/demo/assets/uploads/flags/../secret.txt")).toBeNull();
    expect(extractUploadRelativePathFromUrl("/scenario-assets/demo/assets/uploads/flags//a.png")).toBeNull();
    expect(normalizeUploadRelativePath("flags/a.png")).toBe("flags/a.png");
    expect(normalizeUploadRelativePath("../secret.txt")).toBeNull();
  });

  it("builds versioned upload URLs", () => {
    vi.spyOn(Date, "now").mockReturnValue(123);

    expect(makeVersionedUploadUrl("/flags/a.png")).toBe("/scenario-assets/active/assets/uploads/flags/a.png?v=123");
    expect(() => makeVersionedUploadUrl("../secret.txt")).toThrow("INVALID_UPLOAD_PATH");
  });

  it("resolves upload paths only inside the upload root", async () => {
    const root = await makeTempDir();

    expect(resolveUploadPathInsideRoot(root, "flags/a.png")).toBe(join(root, "flags", "a.png"));
    expect(resolveUploadPathInsideRoot(root, "../secret.txt")).toBeNull();
    expect(resolveUploadPathInsideRoot(root, "flags/../secret.txt")).toBeNull();
  });

  it("collects upload paths from nested unknown data", () => {
    const sink = new Set<string>();

    collectUploadPathsFromUnknown(
      {
        flag: "/scenario-assets/demo/assets/uploads/flags/a.png?v=1",
        nested: [
          { flag: "/scenario-assets/demo/assets/uploads/flags/a.png?v=1" },
          { crest: "https://example.test/scenario-assets/demo/assets/uploads/crests/b.png" },
          { ignored: "/assets/c.png" },
          { unsafe: "/scenario-assets/demo/assets/uploads/../secret.txt" },
        ],
      },
      sink,
    );

    expect([...sink].sort()).toEqual(["crests/b.png", "flags/a.png"]);
  });

  it("lists upload files recursively", async () => {
    const root = await makeTempDir();
    await mkdir(join(root, "flags"), { recursive: true });
    await writeFile(join(root, "flags", "a.png"), "");
    await writeFile(join(root, "b.png"), "");

    expect(listUploadFilesRecursively(root).sort()).toEqual(["b.png", "flags/a.png"]);
    expect(listUploadFilesRecursively(join(root, "missing"))).toEqual([]);
  });

  it("removes uploaded files and ignores missing inputs", async () => {
    const file = await writeSvgFile(16, 16);

    removeUploadedFile(file);
    removeUploadedFile(undefined);

    expect(existsSync(file.path)).toBe(false);
  });

  it("removes multiple uploaded files and ignores missing entries", async () => {
    const first = await writeSvgFile(16, 16);
    const second = await writeSvgFile(32, 32);

    removeUploadedFiles([first, undefined, second]);

    expect(existsSync(first.path)).toBe(false);
    expect(existsSync(second.path)).toBe(false);
  });

  it("does not remove files outside uploadsRoot from crafted URLs", async () => {
    const outsideDir = await makeTempDir();
    const outsidePath = join(outsideDir, "secret.txt");
    await writeFile(outsidePath, "");

    removeUploadedByUrl("/scenario-assets/demo/assets/uploads/../secret.txt");

    expect(existsSync(outsidePath)).toBe(true);
  });
});

async function writeSvgFile(width: number, height: number): Promise<Express.Multer.File> {
  const dir = await makeTempDir();
  const path = join(dir, `${width}x${height}.svg`);
  await writeFile(path, `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"></svg>`);
  return {
    fieldname: "image",
    originalname: "image.svg",
    encoding: "7bit",
    mimetype: "image/svg+xml",
    size: 1,
    destination: dir,
    filename: `${width}x${height}.svg`,
    path,
    buffer: Buffer.alloc(0),
    stream: Readable.from([]),
  };
}

async function makeTempDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "arc-upload-validation-"));
  tempDirs.push(dir);
  return dir;
}
