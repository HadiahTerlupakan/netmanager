export const DB_ENV_MAP: Record<string, string> = {
  netmanager: "DATABASE_URL",
  radius: "RADIUS_DATABASE_URL",
  billing: "DATABASE_URL_BILLING",
  mitra: "DATABASE_URL_MITRA",
};

export type BackupResultItem = {
  database: string;
  status: "success" | "skipped" | "error";
  message: string;
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
