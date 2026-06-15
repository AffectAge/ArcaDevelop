import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readContentLibraryFile, writeContentLibraryFile } from "./contentLibraryFile";

describe("contentLibraryFile", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "arcanorum-content-library-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("reports missing files", () => {
    expect(readContentLibraryFile(join(dir, "content-library.json"))).toEqual({ status: "missing" });
  });

  it("loads object JSON", () => {
    const path = join(dir, "content-library.json");
    writeFileSync(path, JSON.stringify({ content: { goods: [] } }), "utf8");

    expect(readContentLibraryFile(path)).toEqual({ status: "loaded", data: { content: { goods: [] } } });
  });

  it("reports invalid JSON", () => {
    const path = join(dir, "content-library.json");
    writeFileSync(path, "{bad", "utf8");

    const result = readContentLibraryFile(path);
    expect(result.status).toBe("invalid");
  });

  it("writes formatted JSON with trailing newline", () => {
    const path = join(dir, "content-library.json");

    expect(writeContentLibraryFile(path, { content: { goods: [] }, updatedAt: "now" })).toEqual({ ok: true });
    expect(readFileSync(path, "utf8")).toBe(`${JSON.stringify({ content: { goods: [] }, updatedAt: "now" }, null, 2)}\n`);
  });
});
