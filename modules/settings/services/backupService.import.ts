import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { exec } from "node:child_process";

import { logger } from "@/lib/logger";
import type { BackupImportResult, BackupResultItem } from "./backupService";
import {
  buildRestoreError,
  buildRestoreSuccess,
  getRestoreConfig,
} from "./backupService.import.helpers";
import { pushPrismaSchema } from "./backupService.import.prisma";
import { backfillTenantId } from "./backupService.import.tenant";
import {
  buildPsqlCommand,
  findPrismaBin,
  getPostgresClient,
  parseDatabaseUrl,
  shellQuote,
  summarizeBackupResults,
} from "./backupService";

type ExecAsync = typeof exec.__promisify__;
type ResolvedDbConfig = NonNullable<ReturnType<typeof parseDatabaseUrl>>;

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
  if (files.length === 0) {
    throw new Error("File backup tidak berisi data database yang valid.");
  }
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
  const restoreConfig = getRestoreConfig(context, dbName, parseDatabaseUrl);
  if (!restoreConfig) return;

  try {
    await restoreResolvedDatabase(
      context,
      dbName,
      sqlGzFile,
      restoreConfig.dbConfig,
    );
    context.results.push(buildRestoreSuccess(dbName));
  } catch (error) {
    context.results.push(buildRestoreError(dbName, error));
  }
}

async function restoreResolvedDatabase(
  context: RestoreContext,
  dbName: string,
  sqlGzFile: string,
  dbConfig: ResolvedDbConfig,
) {
  const psqlCommand = buildPsqlCommand(getPostgresClient(dbName), dbConfig);

  await replaceDatabaseSchema(context.execAsync, psqlCommand);
  await importSqlDump(context, psqlCommand, sqlGzFile);
  await pushPrismaSchema({
    execAsync: context.execAsync,
    prismaBin: context.prismaBin,
    dbName,
    database: dbConfig.database,
    psqlCommand,
  });
  await backfillTenantId(context, dbName, psqlCommand);
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

function removeTempDir(tmpDir: string) {
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch (error) {
    logger.error(
      `[backup:import] Failed to remove temporary restore directory ${tmpDir}:`,
      error,
    );
  }
}
