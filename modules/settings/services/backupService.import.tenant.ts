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

  logger.info(`[backup:import] Starting tenantId backfill for ${dbName}...`);
  const tables = await findTenantTables(context.execAsync, psqlCommand);

  if (tables.length === 0) {
    logger.info(
      `[backup:import] No tables with tenantId column found in ${dbName}`,
    );
    return;
  }

  logger.info(
    `[backup:import] Found ${tables.length} tables to backfill in ${dbName}`,
  );

  for (const table of tables) {
    await backfillTenantTable(context, psqlCommand, table);
  }

  logger.info(`[backup:import] TenantId backfill completed for ${dbName}`);
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
  const escapedTenantId = String(context.tenantId ?? "").replace(/'/g, "''");
  const command = `${psqlCommand} -c "UPDATE \\"${table}\\" SET \\"tenantId\\" = '${escapedTenantId}' WHERE \\"tenantId\\" IS NULL;"`;

  try {
    await context.execAsync(command, { shell: "/bin/sh" });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (message.includes("duplicate key value violates unique constraint")) {
      throw new Error(
        `Backfill tenantId gagal pada tabel ${table} karena konflik unique constraint: ${message}`,
      );
    }

    throw error;
  }
}
