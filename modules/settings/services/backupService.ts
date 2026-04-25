import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { exec, execSync } from "node:child_process";
import { promisify } from "node:util";

import {
  ensurePrismaMigrationHistory,
  getBackupPrismaConfig,
} from "../lib/prismaMigrationHistory";

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

function parseDatabaseUrl(url: string): ParsedDbConfig | null {
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

function shellQuote(value: string) {
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

function findPrismaBin(): string {
  const local = path.join(process.cwd(), "node_modules", ".bin", "prisma");
  if (fs.existsSync(local)) {
    return local;
  }

  return "npx prisma";
}

function findTsxCommand(): string {
  const local = path.join(process.cwd(), "node_modules", ".bin", "tsx");
  if (fs.existsSync(local)) {
    return `"${local}"`;
  }

  return "npx tsx";
}

function shouldRunSeedAfterReset(results: BackupResultItem[]): boolean {
  if (results.length === 0) {
    return false;
  }

  return results.every((result) => result.status === "success");
}

export async function createBackupArchive(): Promise<BackupExportResult> {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "netmgr-backup-"));
  const now = new Date();
  const timestamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
    "_",
    String(now.getHours()).padStart(2, "0"),
    String(now.getMinutes()).padStart(2, "0"),
    String(now.getSeconds()).padStart(2, "0"),
  ].join("");
  const tarFileName = `netmanager_backup_${timestamp}.tar.gz`;
  const tarFilePath = path.join(tmpDir, tarFileName);

  const dumpFiles: string[] = [];
  const errors: string[] = [];

  try {
    for (const [name, envVar] of Object.entries(DB_ENV_MAP)) {
      const rawUrl = process.env[envVar];

      if (!rawUrl) {
        errors.push(`${name}: env var ${envVar} tidak ditemukan`);
        continue;
      }

      const dbConfig = parseDatabaseUrl(rawUrl);
      if (!dbConfig) {
        errors.push(`${name}: gagal parse DATABASE_URL`);
        continue;
      }

      const dumpFilePath = path.join(tmpDir, `${name}.sql.gz`);
      const postgresClient = getPostgresClient(name);
      const pgDumpCmd = [
        "set -e;",
        buildPgDumpCommand(postgresClient, dbConfig),
        "--no-owner",
        "--no-acl",
        "--format=plain",
        "--inserts",
        "--column-inserts",
        `| gzip > ${shellQuote(dumpFilePath)}`,
      ].join(" ");

      try {
        await execAsync(pgDumpCmd, { shell: "/bin/sh" });
        dumpFiles.push(dumpFilePath);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        errors.push(`${name}: ${message}`);
      }
    }

    if (dumpFiles.length === 0) {
      throw new Error(`Semua database gagal di-backup: ${errors.join("; ")}`);
    }

    const fileNames = dumpFiles
      .map((filePath) => path.basename(filePath))
      .join(" ");
    await execAsync(`tar -czf "${tarFilePath}" -C "${tmpDir}" ${fileNames}`, {
      shell: "/bin/sh",
    });
    const fileBuffer = fs.readFileSync(tarFilePath);

    return {
      fileName: tarFileName,
      fileBuffer,
      databases: dumpFiles.map((filePath) =>
        path.basename(filePath, ".sql.gz"),
      ),
      warnings: errors,
    };
  } finally {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {}
  }
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
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "netmgr-import-"));

  try {
    if (!fileName.endsWith(".tar.gz") && !fileName.endsWith(".tgz")) {
      throw new Error(
        "Format file tidak valid. Gunakan file .tar.gz hasil export backup.",
      );
    }

    const uploadedFilePath = path.join(tmpDir, "backup.tar.gz");
    fs.writeFileSync(uploadedFilePath, fileBuffer);

    const extractDir = path.join(tmpDir, "extracted");
    fs.mkdirSync(extractDir);
    await execAsync(`tar -xzf "${uploadedFilePath}" -C "${extractDir}"`, {
      shell: "/bin/sh",
    });

    const extractedFiles = fs
      .readdirSync(extractDir)
      .filter((entry) => entry.endsWith(".sql.gz"));
    if (extractedFiles.length === 0) {
      throw new Error("File backup tidak berisi data database yang valid.");
    }

    const results: BackupResultItem[] = [];
    const prismaBin = findPrismaBin();

    for (const sqlGzFile of extractedFiles) {
      const dbName = sqlGzFile.replace(".sql.gz", "");
      const envVar = DB_ENV_MAP[dbName];

      if (!envVar) {
        results.push({
          database: dbName,
          status: "skipped",
          message: `Database "${dbName}" tidak dikenal, dilewati.`,
        });
        continue;
      }

      const rawUrl = process.env[envVar];
      if (!rawUrl) {
        results.push({
          database: dbName,
          status: "skipped",
          message: `Env var ${envVar} tidak ditemukan.`,
        });
        continue;
      }

      const dbConfig = parseDatabaseUrl(rawUrl);
      if (!dbConfig) {
        results.push({
          database: dbName,
          status: "error",
          message: `Gagal parse DATABASE_URL untuk ${dbName}.`,
        });
        continue;
      }

      const sqlGzPath = path.join(extractDir, sqlGzFile);
      const postgresClient = getPostgresClient(dbName);
      const psqlCommand = buildPsqlCommand(postgresClient, dbConfig);
      const pgPrefix = "";

      try {
        await execAsync(
          `${psqlCommand} -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;" -q`,
          { shell: "/bin/sh", maxBuffer: 1024 * 1024 * 10 },
        );

        await execAsync(`gunzip -c ${shellQuote(sqlGzPath)} | ${psqlCommand}`, {
          shell: "/bin/sh",
          maxBuffer: 1024 * 1024 * 10,
        });

        const prismaConfig = getBackupPrismaConfig(dbName);
        if (prismaConfig) {
          const configFlag = prismaConfig.config
            ? ` --config=${prismaConfig.config}`
            : "";

          try {
            await execAsync(
              `cd "${process.cwd()}" && "${prismaBin}" db push --accept-data-loss${configFlag}`,
              {
                shell: "/bin/sh",
                maxBuffer: 1024 * 1024 * 30,
                env: { ...process.env, PRISMA_HIDE_UPDATE_MESSAGE: "1" },
              },
            );

            await ensurePrismaMigrationHistory({
              dbName,
              database: dbConfig.database,
              pgPrefix,
              psqlBin: psqlCommand,
              psqlCommand,
              prismaBin,
              projectRoot: process.cwd(),
              env: { ...process.env, PRISMA_HIDE_UPDATE_MESSAGE: "1" },
              runCommand: async (command, options) =>
                execAsync(command, {
                  ...options,
                  shell: "/bin/sh",
                  maxBuffer: 1024 * 1024 * 30,
                }),
            });
          } catch (pushError) {
            console.warn(
              `[backup:import] prisma db push warning for ${dbName}:`,
              String(pushError).substring(0, 300),
            );
          }
        }

        results.push({
          database: dbName,
          status: "success",
          message: "Berhasil di-restore. Data diganti dengan isi backup.",
        });

        if (tenantId) {
          try {
            const getTablesCommand = `${psqlCommand} -t -A -c "SELECT table_name FROM information_schema.columns WHERE column_name = 'tenantId' AND table_schema = 'public'"`;
            const tablesResult = await execAsync(getTablesCommand, {
              shell: "/bin/sh",
            });
            const tables = tablesResult.stdout
              .trim()
              .split("\n")
              .filter(Boolean);

            for (const table of tables) {
              const backfillCommand = `${psqlCommand} -c "UPDATE \\\"${table}\\\" SET \\\"tenantId\\\" = ${shellQuote(tenantId)} WHERE \\\"tenantId\\\" IS NULL;"`;
              await execAsync(backfillCommand, { shell: "/bin/sh" });
            }
          } catch (backfillError) {
            console.warn(
              `[backup:import] Auto-backfill warning for ${dbName}:`,
              String(backfillError).substring(0, 300),
            );
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        results.push({
          database: dbName,
          status: "error",
          message: `Gagal restore: ${message.substring(0, 200)}`,
        });
      }
    }

    const successCount = results.filter(
      (result) => result.status === "success",
    ).length;
    const errorCount = results.filter(
      (result) => result.status === "error",
    ).length;

    return {
      success: errorCount === 0,
      message:
        errorCount === 0
          ? `Import berhasil: ${successCount} database berhasil di-restore.`
          : `Import selesai dengan ${errorCount} error. ${successCount} database berhasil.`,
      results,
    };
  } finally {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {}
  }
}

export async function resetDatabasesAndSchema(): Promise<BackupResetResult> {
  const prismaBin = findPrismaBin();
  const tsxCommand = findTsxCommand();
  const results: BackupResultItem[] = [];

  for (const [dbName, envVar] of Object.entries(DB_ENV_MAP)) {
    const rawUrl = process.env[envVar];

    if (!rawUrl) {
      results.push({
        database: dbName,
        status: "skipped",
        message: `Env var ${envVar} tidak ditemukan.`,
      });
      continue;
    }

    const dbConfig = parseDatabaseUrl(rawUrl);
    if (!dbConfig) {
      results.push({
        database: dbName,
        status: "error",
        message: "Gagal parse DATABASE_URL.",
      });
      continue;
    }

    const postgresClient = getPostgresClient(dbName);
    const psqlCommand = buildPsqlCommand(postgresClient, dbConfig);
    const pgPrefix = "";
    const prismaConfig = getBackupPrismaConfig(dbName);
    const configFlag = prismaConfig?.config
      ? ` --config=${prismaConfig.config}`
      : "";

    try {
      await execAsync(
        `${psqlCommand} -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;" -q`,
        { shell: "/bin/sh", maxBuffer: 1024 * 1024 * 10 },
      );

      await execAsync(
        `cd "${process.cwd()}" && "${prismaBin}" db push --accept-data-loss${configFlag}`,
        {
          shell: "/bin/sh",
          maxBuffer: 1024 * 1024 * 30,
          env: { ...process.env, PRISMA_HIDE_UPDATE_MESSAGE: "1" },
        },
      );

      await ensurePrismaMigrationHistory({
        dbName,
        database: dbConfig.database,
        pgPrefix,
        psqlBin: psqlCommand,
        psqlCommand,
        prismaBin,
        projectRoot: process.cwd(),
        env: { ...process.env, PRISMA_HIDE_UPDATE_MESSAGE: "1" },
        runCommand: async (command, options) =>
          execAsync(command, {
            ...options,
            shell: "/bin/sh",
            maxBuffer: 1024 * 1024 * 30,
          }),
      });

      results.push({
        database: dbName,
        status: "success",
        message: "Database berhasil di-reset dan schema sudah dibuat ulang.",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      results.push({
        database: dbName,
        status: "error",
        message: `Gagal reset: ${message.substring(0, 200)}`,
      });
    }
  }

  if (shouldRunSeedAfterReset(results)) {
    try {
      await execAsync(`cd "${process.cwd()}" && ${tsxCommand} prisma/seed.ts`, {
        shell: "/bin/sh",
        maxBuffer: 1024 * 1024 * 30,
        env: { ...process.env, PRISMA_HIDE_UPDATE_MESSAGE: "1" },
      });

      results.push({
        database: "seed",
        status: "success",
        message:
          "Seed berhasil dijalankan ulang. Login default tersedia kembali.",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      results.push({
        database: "seed",
        status: "error",
        message: `Reset selesai, tetapi seed gagal: ${message.substring(0, 200)}`,
      });
    }
  }

  const successCount = results.filter(
    (result) => result.status === "success",
  ).length;
  const errorCount = results.filter(
    (result) => result.status === "error",
  ).length;

  return {
    success: errorCount === 0,
    message:
      errorCount === 0
        ? `Reset selesai: ${successCount} langkah berhasil (termasuk seed jika tersedia). Anda bisa login ulang.`
        : `Reset selesai dengan ${errorCount} error. ${successCount} langkah berhasil.`,
    results,
  };
}

export async function runBackupBackfillJob(): Promise<BackupBackfillResult> {
  const tsxCommand = findTsxCommand();
  const scriptPath = path.join(process.cwd(), "scripts", "backfill-tenant.ts");

  if (!fs.existsSync(scriptPath)) {
    throw new Error("Script backfill-tenant.ts tidak ditemukan");
  }

  const command = `cd ${process.cwd()} && ${tsxCommand} ${scriptPath}`;
  const { stdout, stderr } = await execAsync(command);

  if (stderr && stderr.toLowerCase().includes("error")) {
    console.error("[backup:backfill] Script Error details:", stderr);
  }

  return {
    success: true,
    message:
      "Sinkronisasi berhasil dijalankan. Data telah dihubungkan dengan Tenant yang benar.",
    log: stdout,
  };
}
