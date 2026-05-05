import type { exec } from "node:child_process";

import { logger } from "@/lib/logger";
import {
  ensurePrismaMigrationHistory,
  getBackupPrismaConfig,
} from "../lib/prismaMigrationHistory";

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

  try {
    const configFlag = prismaConfig.config
      ? ` --config=${prismaConfig.config}`
      : "";
    await runPrismaDbPush(input.execAsync, input.prismaBin, configFlag);
    await resolveMigrationHistory(input);
  } catch (pushError) {
    logger.warn(
      `[backup:import] prisma db push warning for ${input.dbName}:`,
      String(pushError).substring(0, 300),
    );
  }
}

async function runPrismaDbPush(
  execAsync: ExecAsync,
  prismaBin: string,
  configFlag: string,
) {
  await execAsync(
    `cd "${/*turbopackIgnore: true*/ process.cwd()}" && "${prismaBin}" db push --accept-data-loss${configFlag}`,
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
