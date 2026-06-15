import { existsSync, readFileSync, writeFileSync } from "node:fs";

export type PersistedContentLibrary = {
  content?: unknown;
  civilopedia?: {
    categories?: unknown;
    entries?: unknown;
  };
  map?: {
    backgroundImageUrl?: unknown;
  };
  resourceIcons?: Record<string, unknown>;
  updatedAt?: unknown;
};

export type ContentLibraryReadResult =
  | { status: "missing" }
  | { status: "loaded"; data: PersistedContentLibrary }
  | { status: "invalid"; error: unknown };

export type ContentLibraryWriteResult =
  | { ok: true }
  | { ok: false; error: unknown };

export function readContentLibraryFile(path: string): ContentLibraryReadResult {
  if (!existsSync(path)) return { status: "missing" };

  try {
    const raw = readFileSync(path, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { status: "missing" };
    }
    return { status: "loaded", data: parsed as PersistedContentLibrary };
  } catch (error) {
    return { status: "invalid", error };
  }
}

export function writeContentLibraryFile(path: string, snapshot: PersistedContentLibrary): ContentLibraryWriteResult {
  try {
    writeFileSync(path, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
    return { ok: true };
  } catch (error) {
    return { ok: false, error };
  }
}
