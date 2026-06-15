import { existsSync, readFileSync } from "node:fs";

export type PersistedStateFileReadResult =
  | { status: "missing" }
  | { status: "loaded"; data: unknown }
  | { status: "invalid"; error: unknown };

export function readPersistedStateFile(path: string): PersistedStateFileReadResult {
  if (!existsSync(path)) return { status: "missing" };

  try {
    const raw = readFileSync(path, "utf8");
    return { status: "loaded", data: JSON.parse(raw) as unknown };
  } catch (error) {
    return { status: "invalid", error };
  }
}
