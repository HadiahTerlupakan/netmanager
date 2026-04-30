import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { exec } from "node:child_process";

import { logger } from "@/lib/logger";
import {
  ensurePrismaMigrationHistory,
  getBackupPrismaConfig,
} from "../lib/prismaMigrationHistory";
import type { BackupImportResult, BackupResultItem } from "./backupService";
import {
  buildPsqlCommand,
  findPrismaBin,
  getPostgresClient,
  parseDatabaseUrl,
  shellQuote,
  summarizeBackupResults,
} from "./backupService";

type ExecAsync = typeof exec.__promisify__;

type ImportBackupArchiveInput = {
  fileBuffer: Buffer;
  fileName: string;
  tenantId?: string | null;
  dbEnvMap: Record<string, string>;
  execAsync: ExecAsync;
};

type RestoreContext = {
  extractDir: string;
  prismaBin: string;
  results: BackupResultItem[];
} & Pick<ImportBackupArchiveInput, "dbEnvMap" | "execAsync" | "tenantId">;

/** Restore a compressed backup archive into configured databases. */
export async function importBackupArchiveIntoDatabases(
  input: ImportBackupArchiveInput,
): Promise<BackupImportResult> {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "netmgr-import-"));

  try {
    validateBackupFileName(input.fileName);
    const extractDir = await extractBackupArchive(input, tmpDir);
    const sqlFiles = getExtractedSqlFiles(extractDir);
    const context = createRestoreContext(input, extractDir);
    await restoreSqlFiles(context, sqlFiles);
    return {
      ...summarizeBackupResults("Import", context.results),
      results: context.results,
    };
  } finally {
    removeTempDir(tmpDir);
  }
}

function validateBackupFileName(fileName: string) {
  if (fileName.endsWith(".tar.gz") || fileName.endsWith(".tgz")) return;
  throw new Error(
    "Format file tidak valid. Gunakan file .tar.gz hasil export backup.",
  );
}

async function extractBackupArchive(
  input: ImportBackupArchiveInput,
  tmpDir: string,
) {
  const uploadedFilePath = path.join(tmpDir, "backup.tar.gz");
  const extractDir = path.join(tmpDir, "extracted");
  fs.writeFileSync(uploadedFilePath, input.fileBuffer);
  fs.mkdirSync(extractDir);
  await input.execAsync(`tar -xzf "${uploadedFilePath}" -C "${extractDir}"`, {
    shell: "/bin/sh",
  });
  return extractDir;
}

function getExtractedSqlFiles(extractDir: string) {
  const files = fs
    .readdirSync(extractDir)
    .filter((entry) => entry.endsWith(".sql.gz"));
  if (files.length === 0)
    throw new Error("File backup tidak berisi data database yang valid.");
  return files;
}

function createRestoreContext(
  input: ImportBackupArchiveInput,
  extractDir: string,
): RestoreContext {
  return {
    extractDir,
    dbEnvMap: input.dbEnvMap,
    execAsync: input.execAsync,
    tenantId: input.tenantId,
    prismaBin: findPrismaBin(),
    results: [],
  };
}

async function restoreSqlFiles(context: RestoreContext, sqlFiles: string[]) {
  for (const sqlGzFile of sqlFiles) {
    await restoreSqlFile(context, sqlGzFile);
  }
}

async function restoreSqlFile(context: RestoreContext, sqlGzFile: string) {
  const dbName = sqlGzFile.replace(".sql.gz", "");
  const restoreConfig = getRestoreConfig(context, dbName);
  if (!restoreConfig) return;

  try {
    const psqlCommand = buildPsqlCommand(
      getPostgresClient(dbName),
      restoreConfig.dbConfig,
    );
    await replaceDatabaseSchema(context.execAsync, psqlCommand);
    await importSqlDump(context, psqlCommand, sqlGzFile);
    await pushPrismaSchema(
      context,
      dbName,
      restoreConfig.dbConfig.database,
      psqlCommand,
    );
    context.results.push(buildRestoreSuccess(dbName));
    await backfillTenantId(context, dbName, psqlCommand);
  } catch (error) {
    context.results.push(buildRestoreError(dbName, error));
  }
}

function getRestoreConfig(context: RestoreContext, dbName: string) {
  const envVar = context.dbEnvMap[dbName];
  if (!envVar)
    return pushSkipped(
      context.results,
      dbName,
      `Database "${dbName}" tidak dikenal, dilewati.`,
    );

  const rawUrl = process.env[envVar];
  if (!rawUrl)
    return pushSkipped(
      context.results,
      dbName,
      `Env var ${envVar} tidak ditemukan.`,
    );

  const dbConfig = parseDatabaseUrl(rawUrl);
  if (!dbConfig)
    return pushError(
      context.results,
      dbName,
      `Gagal parse DATABASE_URL untuk ${dbName}.`,
    );
  return { dbConfig };
}

function pushSkipped(
  results: BackupResultItem[],
  database: string,
  message: string,
): null {
  results.push({ database, status: "skipped", message });
  return null;
}

function pushError(
  results: BackupResultItem[],
  database: string,
  message: string,
): null {
  results.push({ database, status: "error", message });
  return null;
}

async function replaceDatabaseSchema(
  execAsync: ExecAsync,
  psqlCommand: string,
) {
  await execAsync(
    `${psqlCommand} -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;" -q`,
    {
      shell: "/bin/sh",
      maxBuffer: 1024 * 1024 * 10,
    },
  );
}

async function importSqlDump(
  context: RestoreContext,
  psqlCommand: string,
  sqlGzFile: string,
) {
  const sqlGzPath = path.join(context.extractDir, sqlGzFile);
  await context.execAsync(
    `gunzip -c ${shellQuote(sqlGzPath)} | ${psqlCommand}`,
    {
      shell: "/bin/sh",
      maxBuffer: 1024 * 1024 * 10,
    },
  );
}

async function pushPrismaSchema(
  context: RestoreContext,
  dbName: string,
  database: string,
  psqlCommand: string,
) {
  const prismaConfig = getBackupPrismaConfig(dbName);
  if (!prismaConfig) return;

  try {
    const configFlag = prismaConfig.config
      ? ` --config=${prismaConfig.config}`
      : "";
    await runPrismaDbPush(context, configFlag);
    await resolveMigrationHistory(context, dbName, database, psqlCommand);
  } catch (pushError) {
    logger.warn(
      `[backup:import] prisma db push warning for ${dbName}:`,
      String(pushError).substring(0, 300),
    );
  }
}

async function runPrismaDbPush(context: RestoreContext, configFlag: string) {
  await context.execAsync(
    `cd "${process.cwd()}" && "${context.prismaBin}" db push --accept-data-loss${configFlag}`,
    buildPrismaExecOptions(),
  );
}

async function resolveMigrationHistory(
  context: RestoreContext,
  dbName: string,
  database: string,
  psqlCommand: string,
) {
  await ensurePrismaMigrationHistory({
    dbName,
    database,
    pgPrefix: "",
    psqlBin: psqlCommand,
    psqlCommand,
    prismaBin: context.prismaBin,
    projectRoot: process.cwd(),
    env: buildPrismaEnv(),
    runCommand: async (command, options) =>
      context.execAsync(command, {
        ...options,
        shell: "/bin/sh",
        maxBuffer: 1024 * 1024 * 30,
      }),
  });
}

async function backfillTenantId(
  context: RestoreContext,
  dbName: string,
  psqlCommand: string,
) {
  if (!context.tenantId) return;

  try {
    const tables = await findTenantTables(context.execAsync, psqlCommand);
    for (const table of tables)
      await backfillTenantTable(context, psqlCommand, table);
  } catch (backfillError) {
    logger.warn(
      `[backup:import] Auto-backfill warning for ${dbName}:`,
      String(backfillError).substring(0, 300),
    );
  }
}

async function findTenantTables(execAsync: ExecAsync, psqlCommand: string) {
  const command = `${psqlCommand} -t -A -c "SELECT table_name FROM information_schema.columns WHERE column_name = 'tenantId' AND table_schema = 'public'"`;
  const tablesResult = await execAsync(command, { shell: "/bin/sh" });
  return tablesResult.stdout.trim().split("\n").filter(Boolean);
}

async function backfillTenantTable(
  context: RestoreContext,
  psqlCommand: string,
  table: string,
) {
  const command = `${psqlCommand} -c "UPDATE \\"${table}\\" SET \\"tenantId\\" = ${shellQuote(context.tenantId ?? "")} WHERE \\"tenantId\\" IS NULL;"`;
  await context.execAsync(command, { shell: "/bin/sh" });
}

function buildRestoreSuccess(database: string): BackupResultItem {
  return {
    database,
    status: "success",
    message: "Berhasil di-restore. Data diganti dengan isi backup.",
  };
}

function buildRestoreError(database: string, error: unknown): BackupResultItem {
  return {
    database,
    status: "error",
    message: `Gagal restore: ${getErrorMessage(error).substring(0, 200)}`,
  };
}

function buildPrismaExecOptions() {
  return {
    shell: "/bin/sh",
    maxBuffer: 1024 * 1024 * 30,
    env: buildPrismaEnv(),
  };
}

function buildPrismaEnv() {
  return { ...process.env, PRISMA_HIDE_UPDATE_MESSAGE: "1" };
}

function removeTempDir(tmpDir: string) {
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch {}
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
