import fs from 'node:fs'
import path from 'node:path'

type BackupDatabaseName = 'netmanager' | 'radius' | 'billing' | 'mitra'

type BackupPrismaConfig = {
  config: string | null
  migrationsDir: string
  schemaPath: string
}

type CommandRunner = (command: string, options: { env: NodeJS.ProcessEnv }) => Promise<unknown>

const BACKUP_PRISMA_CONFIG_MAP: Record<BackupDatabaseName, BackupPrismaConfig> = {
  netmanager: {
    config: null,
    migrationsDir: 'prisma/migrations',
    schemaPath: 'prisma/schema.prisma',
  },
  radius: {
    config: 'prisma.radius.config.ts',
    migrationsDir: 'prisma/radius_migrations',
    schemaPath: 'prisma/schema.radius.prisma',
  },
  billing: {
    config: 'prisma.billing.config.ts',
    migrationsDir: 'prisma/billing_migrations',
    schemaPath: 'prisma/billing.prisma',
  },
  mitra: {
    config: 'prisma.mitra.config.ts',
    migrationsDir: 'prisma/mitra_migrations',
    schemaPath: 'prisma/mitra.prisma',
  },
}

function shellQuote(value: string) {
  return `'${value.replace(/'/g, `'"'"'`)}'`
}

function parseAppliedCount(stdout: string) {
  const normalized = stdout.trim()
  const appliedCount = Number.parseInt(normalized, 10)

  if (Number.isNaN(appliedCount)) {
    throw new Error(`Unable to parse Prisma migration count from output: ${stdout}`)
  }

  return appliedCount
}

function getConfigArg(config: string | null) {
  return config ? ` --config=${config}` : ''
}

export function getBackupPrismaConfig(dbName: string): BackupPrismaConfig | null {
  return BACKUP_PRISMA_CONFIG_MAP[dbName as BackupDatabaseName] ?? null
}

export function listMigrationNames(projectRoot: string, dbName: string) {
  const prismaConfig = getBackupPrismaConfig(dbName)

  if (!prismaConfig) {
    return []
  }

  const migrationsRoot = path.join(projectRoot, prismaConfig.migrationsDir)

  return fs
    .readdirSync(migrationsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right))
}

export async function ensurePrismaMigrationHistory({
  dbName,
  database,
  pgPrefix,
  psqlBin,
  prismaBin,
  projectRoot,
  env,
  runCommand,
  listMigrationNames: listMigrationNamesOverride = (inputProjectRoot, inputDbName) =>
    listMigrationNames(inputProjectRoot, inputDbName),
}: {
  dbName: string
  database: string
  pgPrefix: string
  psqlBin: string
  prismaBin: string
  projectRoot: string
  env: NodeJS.ProcessEnv
  runCommand: CommandRunner
  listMigrationNames?: (projectRoot: string, dbName: string) => string[]
}) {
  const prismaConfig = getBackupPrismaConfig(dbName)

  if (!prismaConfig) {
    return
  }

  const configArg = getConfigArg(prismaConfig.config)
  const checkTableCommand = `${pgPrefix} ${shellQuote(psqlBin)} -d ${shellQuote(database)} -t -A -c "SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='_prisma_migrations'"`
  const getCountCommand = `${pgPrefix} ${shellQuote(psqlBin)} -d ${shellQuote(database)} -t -A -c "SELECT count(*) FROM \\"_prisma_migrations\\""`
  
  const appliedCountCommand = `
    EXISTS=$(${checkTableCommand})
    if [ "$EXISTS" = "1" ]; then
      ${getCountCommand}
    else
      echo "-1"
    fi
  `

  const appliedCountResult = (await runCommand(appliedCountCommand, { env })) as { stdout?: string }
  const appliedCount = parseAppliedCount(appliedCountResult.stdout ?? '')

  if (appliedCount > 0) {
    return
  }

  const diffCommand = `cd ${shellQuote(projectRoot)} && ${shellQuote(prismaBin)} migrate diff${configArg} --from-config-datasource --to-schema ${prismaConfig.schemaPath} --exit-code`
  await runCommand(diffCommand, { env })

  const migrationNames = listMigrationNamesOverride(projectRoot, dbName)

  for (const migrationName of migrationNames) {
    const resolveCommand = `cd ${shellQuote(projectRoot)} && ${shellQuote(prismaBin)} migrate resolve${configArg} --applied ${migrationName}`
    await runCommand(resolveCommand, { env })
  }
}
