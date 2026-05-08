import type { ExecException, exec } from "node:child_process";

import { logger } from "@/lib/logger";
import {
  ensurePrismaMigrationHistory,
  getBackupPrismaConfig,
} from "../lib/prismaMigrationHistory";

const PRISMA_SCHEMA_DIFF_EXIT_CODE = 2;

type ExecAsync = typeof exec.__promisify__;

type PushPrismaSchemaInput = {
  execAsync: ExecAsync;
  prismaBin: string;
  dbName: string;
  database: string;
  psqlCommand: string;
};

export async function pushPrismaSchema(
  input: PushPrismaSchemaInput,
): Promise<void> {
  const prismaConfig = getBackupPrismaConfig(input.dbName);
  if (!prismaConfig) {
    return;
  }

  logger.info(
    `[backup:import] Checking schema compatibility for ${input.dbName}...`,
  );

  const needsPush = await checkSchemaNeedsPush(
    input,
    prismaConfig.schemaPath,
    prismaConfig.config,
  );

  if (!needsPush) {
    logger.info(
      `[backup:import] Schema already compatible for ${input.dbName}, skipping push`,
    );
    return;
  }

  logger.info(
    `[backup:import] Schema mismatch detected, running db push for ${input.dbName}...`,
  );

  try {
    await runPrismaDbPush(
      input.execAsync,
      input.prismaBin,
      prismaConfig.config,
    );
    await resolveMigrationHistory(input);
    logger.info(`[backup:import] Schema sync completed for ${input.dbName}`);
  } catch (error) {
    logger.error(
      `[backup:import] Schema sync failed for ${input.dbName}:`,
      getErrorMessage(error),
    );
    throw new Error(
      `Schema database ${input.dbName} gagal disinkronkan setelah restore: ${getErrorMessage(error)}`,
    );
  }
}

async function checkSchemaNeedsPush(
  input: PushPrismaSchemaInput,
  schemaPath: string,
  config: string | null,
) {
  try {
    await input.execAsync(
      `cd "${/*turbopackIgnore: true*/ process.cwd()}" && "${input.prismaBin}" migrate diff --from-config-datasource --to-schema ${schemaPath}${getConfigFlag(config)} --exit-code`,
      buildPrismaExecOptions(),
    );
    return false;
  } catch (error) {
    if (isSchemaDiffError(error)) {
      return true;
    }

    logger.error(
      `[backup:import] Unable to verify schema compatibility for ${input.dbName}:`,
      getErrorMessage(error),
    );
    throw error;
  }
}

function isSchemaDiffError(error: unknown) {
  return isExecException(error) && error.code === PRISMA_SCHEMA_DIFF_EXIT_CODE;
}

function isExecException(error: unknown): error is ExecException {
  return error instanceof Error;
}

async function runPrismaDbPush(
  execAsync: ExecAsync,
  prismaBin: string,
  config: string | null,
) {
  await execAsync(
    `cd "${/*turbopackIgnore: true*/ process.cwd()}" && "${prismaBin}" db push --accept-data-loss${getConfigFlag(config)}`,
    buildPrismaExecOptions(),
  );
}

async function resolveMigrationHistory(input: PushPrismaSchemaInput) {
  await ensurePrismaMigrationHistory({
    dbName: input.dbName,
    database: input.database,
    pgPrefix: "",
    psqlBin: input.psqlCommand,
    psqlCommand: input.psqlCommand,
    prismaBin: input.prismaBin,
    projectRoot: /*turbopackIgnore: true*/ process.cwd(),
    env: buildPrismaEnv(),
    runCommand: async (command, options) =>
      input.execAsync(command, {
        ...options,
        shell: "/bin/sh",
        maxBuffer: 1024 * 1024 * 30,
      }),
  });
}

function getConfigFlag(config: string | null) {
  return config ? ` --config=${config}` : "";
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
