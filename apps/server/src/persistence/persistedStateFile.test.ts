import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readPersistedStateFile } from "./persistedStateFile";

describe("readPersistedStateFile", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "arcanorum-state-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("reports missing files without throwing", () => {
    expect(readPersistedStateFile(join(dir, "missing.json"))).toEqual({ status: "missing" });
  });

  it("loads valid JSON as unknown data", () => {
    const path = join(dir, "game-state.json");
    writeFileSync(path, JSON.stringify({ turnId: 3 }), "utf8");

    expect(readPersistedStateFile(path)).toEqual({ status: "loaded", data: { turnId: 3 } });
  });

  it("reports invalid JSON without throwing", () => {
    const path = join(dir, "game-state.json");
    writeFileSync(path, "{bad", "utf8");

    const result = readPersistedStateFile(path);
    expect(result.status).toBe("invalid");
    if (result.status === "invalid") {
      expect(result.error).toBeInstanceOf(Error);
    }
  });
});
