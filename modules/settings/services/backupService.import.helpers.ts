import type { BackupResultItem } from "./backupService";

type RestoreContextLike = {
  dbEnvMap: Record<string, string>;
  results: BackupResultItem[];
};

export function getRestoreConfig<T>(
  context: RestoreContextLike,
  dbName: string,
  parseDatabaseUrl: (url: string) => T | null,
) {
  const envVar = context.dbEnvMap[dbName];
  if (!envVar) {
    return pushSkipped(
      context.results,
      dbName,
      `Database "${dbName}" tidak dikenal, dilewati.`,
    );
  }

  const rawUrl = process.env[envVar];
  if (!rawUrl) {
    return pushSkipped(
      context.results,
      dbName,
      `Env var ${envVar} tidak ditemukan.`,
    );
  }

  const dbConfig = parseDatabaseUrl(rawUrl);
  if (!dbConfig) {
    return pushError(
      context.results,
      dbName,
      `Gagal parse DATABASE_URL untuk ${dbName}.`,
    );
  }

  return { dbConfig };
}

export function buildRestoreSuccess(database: string): BackupResultItem {
  return {
    database,
    status: "success",
    message: "Berhasil di-restore. Data diganti dengan isi backup.",
  };
}

export function buildRestoreError(
  database: string,
  error: unknown,
): BackupResultItem {
  return {
    database,
    status: "error",
    message: `Gagal restore: ${getErrorMessage(error).substring(0, 200)}`,
  };
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

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
