import fs from "node:fs";
import path from "node:path";

export type BackupDatabaseName = "netmanager" | "radius" | "billing" | "mitra";

export type BackupPrismaConfig = {
  config: string | null;
  migrationsDir: string;
  schemaPath: string;
};

type CommandRunner = (
  command: string,
  options: { env: NodeJS.ProcessEnv },
) => Promise<unknown>;

type EnsurePrismaMigrationHistoryInput = {
  dbName: string;
  database: string;
  pgPrefix: string;
  psqlBin: string;
  psqlCommand?: string;
  prismaBin: string;
  projectRoot: string;
  env: NodeJS.ProcessEnv;
  runCommand: CommandRunner;
  listMigrationNames?: (projectRoot: string, dbName: string) => string[];
};

type MigrationCommandContext = EnsurePrismaMigrationHistoryInput & {
  prismaConfig: BackupPrismaConfig;
};

const BACKUP_PRISMA_CONFIG_MAP: Record<BackupDatabaseName, BackupPrismaConfig> =
  {
    netmanager: {
      config: null,
      migrationsDir: "prisma/migrations",
      schemaPath: "prisma/schema.prisma",
    },
    radius: {
      config: "prisma.radius.config.ts",
      migrationsDir: "prisma/radius_migrations",
      schemaPath: "prisma/schema.radius.prisma",
    },
    billing: {
      config: "prisma.billing.config.ts",
      migrationsDir: "prisma/billing_migrations",
      schemaPath: "prisma/billing.prisma",
    },
    mitra: {
      config: "prisma.mitra.config.ts",
      migrationsDir: "prisma/mitra_migrations",
      schemaPath: "prisma/mitra.prisma",
    },
  };

function shellQuote(value: string) {
  return `'${value.replace(/'/g, `"'"'`)}'`;
}

function parseAppliedCount(stdout: string) {
  const normalized = stdout.trim();
  const appliedCount = Number.parseInt(normalized, 10);

  if (Number.isNaN(appliedCount)) {
    throw new Error(
      `Unable to parse Prisma migration count from output: ${stdout}`,
    );
  }

  return appliedCount;
}

function getConfigArg(config: string | null) {
  return config ? ` --config=${config}` : "";
}

export function getBackupPrismaConfig(
  dbName: string,
): BackupPrismaConfig | null {
  return BACKUP_PRISMA_CONFIG_MAP[dbName as BackupDatabaseName] ?? null;
}

function listMigrationNames(projectRoot: string, dbName: string) {
  const prismaConfig = getBackupPrismaConfig(dbName);

  if (!prismaConfig) {
    return [];
  }

  const migrationsRoot = path.join(projectRoot, prismaConfig.migrationsDir);

  return fs
    .readdirSync(migrationsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));
}

export async function ensurePrismaMigrationHistory(
  input: EnsurePrismaMigrationHistoryInput,
) {
  const prismaConfig = getBackupPrismaConfig(input.dbName);
  if (!prismaConfig) return;

  const context = { ...input, prismaConfig };
  const appliedCount = await readAppliedMigrationCount(context);
  if (appliedCount > 0) return;

  await input.runCommand(buildMigrationDiffCommand(context), {
    env: input.env,
  });
  await resolveAppliedMigrations(context);
}

async function readAppliedMigrationCount(input: MigrationCommandContext) {
  const appliedCountResult = (await input.runCommand(
    buildAppliedCountCommand(input),
    { env: input.env },
  )) as { stdout?: string };
  return parseAppliedCount(appliedCountResult.stdout ?? "");
}

function buildAppliedCountCommand(input: MigrationCommandContext) {
  const basePsqlCommand = buildBasePsqlCommand(input);
  const checkTableCommand = `${basePsqlCommand} -t -A -c "SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='_prisma_migrations'"`;
  const getCountCommand = `${basePsqlCommand} -t -A -c "SELECT count(*) FROM \"_prisma_migrations\""`;
  return `
    EXISTS=$(${checkTableCommand})
    if [ "$EXISTS" = "1" ]; then
      ${getCountCommand}
    else
      echo "-1"
    fi
  `;
}

function buildBasePsqlCommand(input: MigrationCommandContext) {
  return (
    input.psqlCommand ??
    `${input.pgPrefix} ${shellQuote(input.psqlBin)} -d ${shellQuote(input.database)}`
  );
}

function buildMigrationDiffCommand(input: MigrationCommandContext) {
  return `cd ${shellQuote(input.projectRoot)} && ${shellQuote(input.prismaBin)} migrate diff${getConfigArg(input.prismaConfig.config)} --from-config-datasource --to-schema ${input.prismaConfig.schemaPath} --exit-code`;
}

async function resolveAppliedMigrations(input: MigrationCommandContext) {
  const migrationNames = getMigrationNames(input);
  for (const migrationName of migrationNames) {
    await input.runCommand(buildMigrationResolveCommand(input, migrationName), {
      env: input.env,
    });
  }
}

function getMigrationNames(input: MigrationCommandContext) {
  const listMigrationNamesOverride =
    input.listMigrationNames ?? listMigrationNames;
  return listMigrationNamesOverride(input.projectRoot, input.dbName);
}

function buildMigrationResolveCommand(
  input: MigrationCommandContext,
  migrationName: string,
) {
  return `cd ${shellQuote(input.projectRoot)} && ${shellQuote(input.prismaBin)} migrate resolve${getConfigArg(input.prismaConfig.config)} --applied ${migrationName}`;
}
