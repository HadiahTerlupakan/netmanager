import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { exec } from "node:child_process";

import type { BackupExportResult } from "./backupService";
import {
  buildPgDumpCommand,
  getPostgresClient,
  parseDatabaseUrl,
  shellQuote,
} from "./backupService";

type ExecAsync = typeof exec.__promisify__;

type CreateBackupArchiveInput = {
  dbEnvMap: Record<string, string>;
  execAsync: ExecAsync;
};

/** Create a compressed SQL archive for all configured databases. */
export async function createBackupArchiveFromDatabases(
  input: CreateBackupArchiveInput,
): Promise<BackupExportResult> {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "netmgr-backup-"));
  const tarFileName = `netmanager_backup_${formatBackupTimestamp()}.tar.gz`;
  const tarFilePath = path.join(tmpDir, tarFileName);
  const context: DumpContext = {
    ...input,
    tmpDir,
    dumpFiles: [],
    errors: [],
  };

  try {
    await dumpConfiguredDatabases(context);
    ensureBackupHasDumpFiles(context.dumpFiles, context.errors);
    await createTarArchive(
      input.execAsync,
      tmpDir,
      tarFilePath,
      context.dumpFiles,
    );
    return buildBackupExportResult(tarFileName, tarFilePath, context);
  } finally {
    removeTempDir(tmpDir);
  }
}

type DumpContext = CreateBackupArchiveInput & {
  tmpDir: string;
  dumpFiles: string[];
  errors: string[];
};

async function dumpConfiguredDatabases(context: DumpContext) {
  for (const [name, envVar] of Object.entries(context.dbEnvMap)) {
    await dumpConfiguredDatabase(context, name, envVar);
  }
}

async function dumpConfiguredDatabase(
  context: DumpContext,
  name: string,
  envVar: string,
) {
  const dbConfig = getArchiveDbConfig(name, envVar, context.errors);
  if (!dbConfig) return;

  try {
    const dumpFilePath = path.join(context.tmpDir, `${name}.sql.gz`);
    await context.execAsync(buildDumpCommand(name, dbConfig, dumpFilePath), {
      shell: "/bin/sh",
    });
    context.dumpFiles.push(dumpFilePath);
  } catch (error) {
    context.errors.push(`${name}: ${getErrorMessage(error)}`);
  }
}

function getArchiveDbConfig(name: string, envVar: string, errors: string[]) {
  const rawUrl = process.env[envVar];
  if (!rawUrl) {
    errors.push(`${name}: env var ${envVar} tidak ditemukan`);
    return null;
  }

  const dbConfig = parseDatabaseUrl(rawUrl);
  if (!dbConfig) errors.push(`${name}: gagal parse DATABASE_URL`);
  return dbConfig;
}

function buildDumpCommand(
  name: string,
  dbConfig: NonNullable<ReturnType<typeof parseDatabaseUrl>>,
  dumpFilePath: string,
) {
  return [
    "set -e;",
    buildPgDumpCommand(getPostgresClient(name), dbConfig),
    "--no-owner",
    "--no-acl",
    "--format=plain",
    "--inserts",
    "--column-inserts",
    `| gzip > ${shellQuote(dumpFilePath)}`,
  ].join(" ");
}

function ensureBackupHasDumpFiles(dumpFiles: string[], errors: string[]) {
  if (dumpFiles.length > 0) return;
  throw new Error(`Semua database gagal di-backup: ${errors.join("; ")}`);
}

async function createTarArchive(
  execAsync: ExecAsync,
  tmpDir: string,
  tarFilePath: string,
  dumpFiles: string[],
) {
  const fileNames = dumpFiles
    .map((filePath) => path.basename(filePath))
    .join(" ");
  await execAsync(`tar -czf "${tarFilePath}" -C "${tmpDir}" ${fileNames}`, {
    shell: "/bin/sh",
  });
}

function buildBackupExportResult(
  fileName: string,
  filePath: string,
  context: Pick<DumpContext, "dumpFiles" | "errors">,
): BackupExportResult {
  return {
    fileName,
    fileBuffer: fs.readFileSync(filePath),
    databases: context.dumpFiles.map((dumpFile) =>
      path.basename(dumpFile, ".sql.gz"),
    ),
    warnings: context.errors,
  };
}

function formatBackupTimestamp() {
  const now = new Date();
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
    "_",
    String(now.getHours()).padStart(2, "0"),
    String(now.getMinutes()).padStart(2, "0"),
    String(now.getSeconds()).padStart(2, "0"),
  ].join("");
}

function removeTempDir(tmpDir: string) {
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch {}
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
