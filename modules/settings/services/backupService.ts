import fs from "node:fs";
import path from "node:path";
import { exec, execSync } from "node:child_process";
import { promisify } from "node:util";

import { createBackupArchiveFromDatabases } from "./backupService.archive";
import { runTenantBackfillJob } from "./backupService.backfill";
import { importBackupArchiveIntoDatabases } from "./backupService.import";
import { resetConfiguredDatabases } from "./backupService.reset";

const execAsync = promisify(exec);

const DB_ENV_MAP: Record<string, string> = {
  netmanager: "DATABASE_URL",
  radius: "RADIUS_DATABASE_URL",
  billing: "DATABASE_URL_BILLING",
  mitra: "DATABASE_URL_MITRA",
};

const DB_DOCKER_CONTAINER_MAP: Record<string, string> = {
  netmanager: "netmanager-postgres-app",
  radius: "netmanager-postgres-radius",
  billing: "netmanager-postgres-billing",
  mitra: "netmanager-postgres-mitra",
};

type ParsedDbConfig = {
  host: string;
  port: string;
  user: string;
  password: string;
  database: string;
};

type PostgresClient =
  | { kind: "local"; psqlBin: string; pgDumpBin: string }
  | { kind: "docker"; container: string };

export type BackupResultItem = {
  database: string;
  status: "success" | "skipped" | "error";
  message: string;
};

export type BackupImportResult = {
  success: boolean;
  message: string;
  results: BackupResultItem[];
};

export type BackupResetResult = {
  success: boolean;
  message: string;
  results: BackupResultItem[];
};

export type BackupExportResult = {
  fileName: string;
  fileBuffer: Buffer;
  databases: string[];
  warnings: string[];
};

export type BackupBackfillResult = {
  success: boolean;
  message: string;
  log: string;
};

export function summarizeBackupResults(
  operation: "Import" | "Reset",
  results: BackupResultItem[],
) {
  const successCount = results.filter(
    (result) => result.status === "success",
  ).length;
  const errorCount = results.filter(
    (result) => result.status === "error",
  ).length;

  if (operation === "Import") {
    return {
      success: errorCount === 0,
      message:
        errorCount === 0
          ? `Import berhasil: ${successCount} database berhasil di-restore.`
          : `Import selesai dengan ${errorCount} error. ${successCount} database berhasil.`,
    };
  }

  return {
    success: errorCount === 0,
    message:
      errorCount === 0
        ? `Reset selesai: ${successCount} langkah berhasil (termasuk seed jika tersedia). Anda bisa login ulang.`
        : `Reset selesai dengan ${errorCount} error. ${successCount} langkah berhasil.`,
  };
}

export function parseDatabaseUrl(url: string): ParsedDbConfig | null {
  try {
    const cleanUrl = url.split("?")[0];
    const parsed = new URL(cleanUrl);

    return {
      host: parsed.hostname,
      port: parsed.port || "5432",
      user: parsed.username,
      password: parsed.password,
      database: parsed.pathname.replace("/", ""),
    };
  } catch {
    return null;
  }
}

export function shellQuote(value: string) {
  return `'${value.replace(/'/g, `"'"'`)}'`;
}

function hasCommand(binary: string): boolean {
  try {
    execSync(`command -v ${shellQuote(binary)}`, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function findBinary(
  candidates: string[],
  fallbackBinary: string,
): string | null {
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  try {
    return execSync(`which ${fallbackBinary}`, { encoding: "utf-8" }).trim();
  } catch {
    return null;
  }
}

function findPgDump(): string | null {
  return findBinary(
    [
      "/opt/homebrew/opt/postgresql@18/bin/pg_dump",
      "/opt/homebrew/opt/postgresql@17/bin/pg_dump",
      "/opt/homebrew/opt/postgresql@16/bin/pg_dump",
      "/opt/homebrew/bin/pg_dump",
      "/usr/local/bin/pg_dump",
      "/usr/bin/pg_dump",
    ],
    "pg_dump",
  );
}

function findPsql(): string | null {
  return findBinary(
    [
      "/opt/homebrew/opt/postgresql@18/bin/psql",
      "/opt/homebrew/opt/postgresql@17/bin/psql",
      "/opt/homebrew/opt/postgresql@16/bin/psql",
      "/opt/homebrew/bin/psql",
      "/usr/local/bin/psql",
      "/usr/bin/psql",
    ],
    "psql",
  );
}

export function getPostgresClient(
  dbName: string,
  hasLocalPsql = findPsql() !== null,
  hasDocker = hasCommand("docker"),
): PostgresClient {
  const pgDumpBin = findPgDump();
  const psqlBin = findPsql();

  if (hasLocalPsql && psqlBin && pgDumpBin) {
    return { kind: "local", psqlBin, pgDumpBin };
  }

  const container = DB_DOCKER_CONTAINER_MAP[dbName];
  if (container && hasDocker) {
    return { kind: "docker", container };
  }

  throw new Error(
    "psql/pg_dump tidak ditemukan. Install postgresql-client atau jalankan database via Docker Compose.",
  );
}

export function buildPsqlCommand(
  client: PostgresClient,
  dbConfig: ParsedDbConfig,
): string {
  if (client.kind === "docker") {
    return [
      "docker exec",
      `-e PGPASSWORD=${shellQuote(dbConfig.password)}`,
      "-i",
      shellQuote(client.container),
      "psql",
      "-h 'localhost'",
      "-p '5432'",
      `-U ${shellQuote(dbConfig.user)}`,
      `-d ${shellQuote(dbConfig.database)}`,
    ].join(" ");
  }

  return [
    `PGPASSWORD=${shellQuote(dbConfig.password)}`,
    shellQuote(client.psqlBin),
    `-h ${shellQuote(dbConfig.host)}`,
    `-p ${shellQuote(dbConfig.port)}`,
    `-U ${shellQuote(dbConfig.user)}`,
    `-d ${shellQuote(dbConfig.database)}`,
  ].join(" ");
}

export function buildPgDumpCommand(
  client: PostgresClient,
  dbConfig: ParsedDbConfig,
): string {
  if (client.kind === "docker") {
    return buildPsqlCommand(client, dbConfig).replace("psql", "pg_dump");
  }

  return buildPsqlCommand(client, dbConfig).replace(
    shellQuote(client.psqlBin),
    shellQuote(client.pgDumpBin),
  );
}

export function findPrismaBin(): string {
  const local = path.join(
    /*turbopackIgnore: true*/ process.cwd(),
    "node_modules",
    ".bin",
    "prisma",
  );
  if (fs.existsSync(local)) {
    return local;
  }

  return "npx prisma";
}

export function findTsxCommand(): string {
  const local = path.join(
    /*turbopackIgnore: true*/ process.cwd(),
    "node_modules",
    ".bin",
    "tsx",
  );
  if (fs.existsSync(local)) {
    return `"${local}"`;
  }

  return "npx tsx";
}

export async function createBackupArchive(): Promise<BackupExportResult> {
  return createBackupArchiveFromDatabases({
    dbEnvMap: DB_ENV_MAP,
    execAsync,
  });
}

export async function importBackupArchive({
  fileBuffer,
  fileName,
  tenantId,
}: {
  fileBuffer: Buffer;
  fileName: string;
  tenantId?: string | null;
}): Promise<BackupImportResult> {
  return importBackupArchiveIntoDatabases({
    fileBuffer,
    fileName,
    tenantId,
    dbEnvMap: DB_ENV_MAP,
    execAsync,
  });
}

export async function resetDatabasesAndSchema(): Promise<BackupResetResult> {
  return resetConfiguredDatabases({
    dbEnvMap: DB_ENV_MAP,
    execAsync,
  });
}

export async function runBackupBackfillJob(): Promise<BackupBackfillResult> {
  return runTenantBackfillJob(execAsync);
}
