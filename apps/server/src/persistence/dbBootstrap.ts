type PrismaBootstrapClient = {
  $executeRawUnsafe(sql: string): Promise<unknown>;
  $queryRawUnsafe<T>(sql: string): Promise<T>;
};

export async function ensureWorldDeltaLogTable(prisma: PrismaBootstrapClient): Promise<void> {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS WorldDeltaLog (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      worldStateVersion INTEGER NOT NULL UNIQUE,
      turnId INTEGER NOT NULL,
      payloadJson TEXT NOT NULL,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS idx_world_delta_log_version ON WorldDeltaLog(worldStateVersion)`,
  );
}

export async function ensureCorePrismaTables(prisma: PrismaBootstrapClient): Promise<void> {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS Country (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL UNIQUE,
      color TEXT NOT NULL,
      flagUrl TEXT,
      crestUrl TEXT,
      cultureId TEXT NOT NULL UNIQUE,
      cultureName TEXT NOT NULL UNIQUE,
      cultureColor TEXT NOT NULL,
      cultureLogoUrl TEXT,
      religionId TEXT NOT NULL UNIQUE,
      religionName TEXT NOT NULL UNIQUE,
      religionColor TEXT NOT NULL,
      religionLogoUrl TEXT,
      cultureGroupId TEXT NOT NULL,
      religionGroupId TEXT NOT NULL,
      raceId TEXT NOT NULL,
      passwordHash TEXT NOT NULL,
      isLocked INTEGER NOT NULL DEFAULT 0,
      isAdmin INTEGER NOT NULL DEFAULT 0,
      blockedUntilTurn INTEGER,
      blockedUntilAt DATETIME,
      lockReason TEXT,
      ignoreUntilTurn INTEGER,
      eventLogRetentionTurns INTEGER NOT NULL DEFAULT 3,
      isRegistrationApproved INTEGER NOT NULL DEFAULT 1,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await assertRequiredTableColumns(prisma, "Country", [
    "cultureId",
    "cultureName",
    "cultureColor",
    "cultureLogoUrl",
    "religionId",
    "religionName",
    "religionColor",
    "religionLogoUrl",
    "cultureGroupId",
    "religionGroupId",
    "raceId",
  ]);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS GameState (
      id TEXT PRIMARY KEY NOT NULL,
      turnId INTEGER NOT NULL,
      gameSettingsJson JSONB NOT NULL,
      worldBaseJson JSONB NOT NULL,
      ordersByTurnJson JSONB NOT NULL,
      resolveReadyByTurnJson JSONB NOT NULL,
      adminAuditLogJson JSONB NOT NULL DEFAULT '[]',
      updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await ensureTableColumn(prisma, {
    tableName: "GameState",
    columnName: "adminAuditLogJson",
    definition: "JSONB NOT NULL DEFAULT '[]'",
  });
}

async function assertRequiredTableColumns(
  prisma: PrismaBootstrapClient,
  tableName: string,
  columnNames: string[],
): Promise<void> {
  const rows = await prisma.$queryRawUnsafe<Array<{ name: string }>>(`PRAGMA table_info(${tableName})`);
  const existing = new Set(rows.map((row) => row.name));
  const missing = columnNames.filter((columnName) => !existing.has(columnName));
  if (missing.length > 0) {
    throw new Error(`DEV_RESET_REQUIRED: ${tableName} is missing required columns: ${missing.join(", ")}`);
  }
}

async function ensureTableColumn(
  prisma: PrismaBootstrapClient,
  params: { tableName: string; columnName: string; definition: string },
): Promise<void> {
  const rows = await prisma.$queryRawUnsafe<Array<{ name: string }>>(`PRAGMA table_info(${params.tableName})`);
  if (rows.some((row) => row.name === params.columnName)) return;
  await prisma.$executeRawUnsafe(`ALTER TABLE ${params.tableName} ADD COLUMN ${params.columnName} ${params.definition}`);
}
