import type { WorldDelta } from "@arcanorum/shared";

type PrismaWorldDeltaLogClient = {
  $executeRaw(query: TemplateStringsArray, ...values: unknown[]): Promise<unknown>;
  $executeRawUnsafe(sql: string): Promise<unknown>;
  $queryRaw<T>(query: TemplateStringsArray, ...values: unknown[]): Promise<T>;
};

export type WorldDeltaLogStatus = {
  dbDepth: number;
  dbOldestWorldStateVersion: number | null;
  dbNewestWorldStateVersion: number | null;
};

export async function persistWorldDeltaToDb(
  prisma: PrismaWorldDeltaLogClient,
  delta: WorldDelta,
): Promise<void> {
  await prisma.$executeRaw`
    INSERT OR IGNORE INTO WorldDeltaLog (worldStateVersion, turnId, payloadJson)
    VALUES (${delta.worldStateVersion}, ${delta.turnId}, ${JSON.stringify(delta)})
  `;
}

export async function prunePersistedWorldDeltaLog(
  prisma: PrismaWorldDeltaLogClient,
  maxEntries: number,
): Promise<void> {
  const boundedMaxEntries = requirePositiveInteger(maxEntries, "maxEntries");
  await prisma.$executeRawUnsafe(`
    DELETE FROM WorldDeltaLog
    WHERE id NOT IN (
      SELECT id FROM WorldDeltaLog
      ORDER BY worldStateVersion DESC
      LIMIT ${boundedMaxEntries}
    )
  `);
}

export async function syncPersistedWorldDeltaLogWithCurrentState(
  prisma: PrismaWorldDeltaLogClient,
  currentWorldStateVersion: number,
): Promise<void> {
  await prisma.$executeRaw`DELETE FROM WorldDeltaLog WHERE worldStateVersion > ${currentWorldStateVersion}`;
}

export async function loadPersistedWorldDeltaHistory(
  prisma: PrismaWorldDeltaLogClient,
  params: { currentWorldStateVersion: number; limit: number },
): Promise<WorldDelta[]> {
  const limit = requirePositiveInteger(params.limit, "limit");
  const rows = await prisma.$queryRaw<Array<{ worldStateVersion: number; payloadJson: string }>>`
    SELECT worldStateVersion, payloadJson
    FROM WorldDeltaLog
    WHERE worldStateVersion <= ${params.currentWorldStateVersion}
    ORDER BY worldStateVersion DESC
    LIMIT ${limit}
  `;

  const parsed: WorldDelta[] = [];
  for (const row of [...rows].reverse()) {
    try {
      const payload = JSON.parse(row.payloadJson) as unknown;
      if (!isWorldDeltaPayload(payload)) continue;
      parsed.push(payload);
    } catch {
      // Malformed persisted diagnostic rows are ignored; fresh deltas continue from live state.
    }
  }
  return parsed;
}

export async function getWorldDeltaLogStatus(
  prisma: PrismaWorldDeltaLogClient,
): Promise<WorldDeltaLogStatus> {
  const rows = await prisma.$queryRaw<Array<{ depth: number; oldest: number | null; newest: number | null }>>`
    SELECT COUNT(*) as depth, MIN(worldStateVersion) as oldest, MAX(worldStateVersion) as newest
    FROM WorldDeltaLog
  `;
  const row = rows[0] ?? { depth: 0, oldest: null, newest: null };
  return {
    dbDepth: Number(row.depth ?? 0),
    dbOldestWorldStateVersion: row.oldest == null ? null : Number(row.oldest),
    dbNewestWorldStateVersion: row.newest == null ? null : Number(row.newest),
  };
}

function isWorldDeltaPayload(value: unknown): value is WorldDelta {
  if (!value || typeof value !== "object") return false;
  const row = value as Partial<WorldDelta>;
  return row.type === "WORLD_DELTA" && typeof row.worldStateVersion === "number" && typeof row.turnId === "number";
}

function requirePositiveInteger(value: number, name: string): number {
  if (Number.isInteger(value) && value > 0) return value;
  throw new Error(`${name} must be a positive integer.`);
}
