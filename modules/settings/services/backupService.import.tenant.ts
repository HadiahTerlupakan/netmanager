import path from "node:path";
import { logger } from "@/lib/logger";

import type { exec } from "node:child_process";

type ExecAsync = typeof exec.__promisify__;

type TenantRestoreContext = {
  extractDir: string;
  execAsync: ExecAsync;
  tenantId?: string | null;
};

export async function backfillTenantId(
  context: TenantRestoreContext,
  dbName: string,
  psqlCommand: string,
) {
  if (!context.tenantId) return;

  try {
    const tables = await findTenantTables(context.execAsync, psqlCommand);
    for (const table of tables) {
      await backfillTenantTable(context, psqlCommand, table);
    }
  } catch (backfillError) {
    logger.warn(
      `[backup:import] Auto-backfill warning for ${dbName}:`,
      String(backfillError).substring(0, 300),
    );
  }
}

async function findTenantTables(execAsync: ExecAsync, psqlCommand: string) {
  const command = `${psqlCommand} -t -A -c "SELECT table_name FROM information_schema.columns WHERE column_name = 'tenantId' AND table_schema = 'public'"`;
  const tablesResult = await execAsync(command, { shell: "/bin/sh" });
  return tablesResult.stdout.trim().split("\n").filter(Boolean);
}

async function backfillTenantTable(
  context: TenantRestoreContext,
  psqlCommand: string,
  table: string,
) {
  const sqlFilePath = path.join(context.extractDir, `${table}.sql.gz`);
  void sqlFilePath;
  const command = `${psqlCommand} -c "UPDATE \\"${table}\\" SET \\"tenantId\\" = '${String(
    context.tenantId ?? "",
  ).replace(/'/g, "''")}' WHERE \\"tenantId\\" IS NULL;"`;
  await context.execAsync(command, { shell: "/bin/sh" });
}
