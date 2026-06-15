import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import type { ServerStatus } from "@arcanorum/shared";

export type ServerEnvironmentRuntime = {
  moduleDir: string;
  dataRoot: string;
  scenariosRoot: string;
  contentLibraryPath: string;
  port: number;
  jwtSecret: string;
  serverStatus: ServerStatus;
  redisUrl?: string;
  autoCleanupUploadsOnStart: boolean;
};

export function createServerEnvironmentRuntime(importMetaUrl: string): ServerEnvironmentRuntime {
  const moduleDir = dirname(fileURLToPath(importMetaUrl));
  dotenv.config({ path: resolve(moduleDir, "../.env") });
  if (!process.env.DATABASE_URL) {
    const fallbackDbPath = resolve(moduleDir, "../prisma/dev.db").replace(/\\/g, "/");
    process.env.DATABASE_URL = `file:${fallbackDbPath}`;
  }

  const dataRoot = resolve(moduleDir, "../data");
  return {
    moduleDir,
    dataRoot,
    scenariosRoot: resolve(dataRoot, "scenarios"),
    contentLibraryPath: resolve(moduleDir, "../data/content-library.json"),
    port: Number(process.env.PORT ?? 3001),
    jwtSecret: process.env.JWT_SECRET ?? "dev_secret_change_me",
    serverStatus: (process.env.SERVER_STATUS as ServerStatus) ?? "online",
    redisUrl: process.env.REDIS_URL,
    autoCleanupUploadsOnStart: process.env.AUTO_CLEANUP_UPLOADS_ON_START !== "false",
  };
}
