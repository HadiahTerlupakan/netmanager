import type { exec } from "node:child_process";

import {
  ensurePrismaMigrationHistory,
  getBackupPrismaConfig,
} from "../lib/prismaMigrationHistory";
import type { BackupResetResult, BackupResultItem } from "./backupService";
import {
  buildPsqlCommand,
  findPrismaBin,
  findTsxCommand,
  getPostgresClient,
  parseDatabaseUrl,
  summarizeBackupResults,
} from "./backupService";

type ExecAsync = typeof exec.__promisify__;

type ResetDatabasesInput = {
  dbEnvMap: Record<string, string>;
  execAsync: ExecAsync;
};

type ResetContext = ResetDatabasesInput & {
  prismaBin: string;
  results: BackupResultItem[];
};

/** Drop and recreate configured database schemas, then seed when reset succeeds. */
export async function resetConfiguredDatabases(
  input: ResetDatabasesInput,
): Promise<BackupResetResult> {
  const context: ResetContext = {
    ...input,
    prismaBin: findPrismaBin(),
    results: [],
  };

  await resetDatabases(context);
  await runSeedWhenResetSucceeds(context);
  return {
    ...summarizeBackupResults("Reset", context.results),
    results: context.results,
  };
}

async function resetDatabases(context: ResetContext) {
  for (const [dbName, envVar] of Object.entries(context.dbEnvMap)) {
    await resetDatabase(context, dbName, envVar);
  }
}

async function resetDatabase(
  context: ResetContext,
  dbName: string,
  envVar: string,
) {
  const dbConfig = getResetDbConfig(context.results, dbName, envVar);
  if (!dbConfig) return;

  try {
    const psqlCommand = buildPsqlCommand(getPostgresClient(dbName), dbConfig);
    await dropAndRecreateSchema(context.execAsync, psqlCommand);
    await pushPrismaSchema(context, dbName, dbConfig.database, psqlCommand);
    context.results.push(buildResetSuccess(dbName));
  } catch (error) {
    context.results.push(buildResetError(dbName, error));
  }
}

function getResetDbConfig(
  results: BackupResultItem[],
  dbName: string,
  envVar: string,
) {
  const rawUrl = process.env[envVar];
  if (!rawUrl)
    return pushSkipped(results, dbName, `Env var ${envVar} tidak ditemukan.`);

  const dbConfig = parseDatabaseUrl(rawUrl);
  if (!dbConfig) return pushError(results, dbName, "Gagal parse DATABASE_URL.");
  return dbConfig;
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

async function dropAndRecreateSchema(
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

async function pushPrismaSchema(
  context: ResetContext,
  dbName: string,
  database: string,
  psqlCommand: string,
) {
  const configFlag = getPrismaConfigFlag(dbName);
  await context.execAsync(
    `cd "${process.cwd()}" && "${context.prismaBin}" db push --accept-data-loss${configFlag}`,
    buildPrismaExecOptions(),
  );
  await resolveMigrationHistory(context, dbName, database, psqlCommand);
}

function getPrismaConfigFlag(dbName: string) {
  const prismaConfig = getBackupPrismaConfig(dbName);
  return prismaConfig?.config ? ` --config=${prismaConfig.config}` : "";
}

async function resolveMigrationHistory(
  context: ResetContext,
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

async function runSeedWhenResetSucceeds(context: ResetContext) {
  if (!shouldRunSeedAfterReset(context.results)) return;

  try {
    await runSeed(context);
    context.results.push(buildSeedSuccess());
  } catch (error) {
    context.results.push(buildSeedError(error));
  }
}

function shouldRunSeedAfterReset(results: BackupResultItem[]): boolean {
  return (
    results.length > 0 && results.every((result) => result.status === "success")
  );
}

async function runSeed(context: ResetContext) {
  await context.execAsync(
    `cd "${process.cwd()}" && ${findTsxCommand()} prisma/seed.ts`,
    buildPrismaExecOptions(),
  );
}

function buildResetSuccess(database: string): BackupResultItem {
  return {
    database,
    status: "success",
    message: "Database berhasil di-reset dan schema sudah dibuat ulang.",
  };
}

function buildResetError(database: string, error: unknown): BackupResultItem {
  return {
    database,
    status: "error",
    message: `Gagal reset: ${getErrorMessage(error).substring(0, 200)}`,
  };
}

function buildSeedSuccess(): BackupResultItem {
  return {
    database: "seed",
    status: "success",
    message: "Seed berhasil dijalankan ulang. Login default tersedia kembali.",
  };
}

function buildSeedError(error: unknown): BackupResultItem {
  return {
    database: "seed",
    status: "error",
    message: `Reset selesai, tetapi seed gagal: ${getErrorMessage(error).substring(0, 200)}`,
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

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
