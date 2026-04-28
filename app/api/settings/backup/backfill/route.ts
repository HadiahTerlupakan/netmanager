import { logger } from "@/lib/logger";
import { NextResponse } from "next/server";
import { ApiErrors, createHandler } from "@/lib/api";
import { hasPermission } from "@/lib/rbac";
import { isMainTenant } from "@/modules/mitra";
import { runBackupBackfillJob } from "@/modules/settings";

export const POST = createHandler({ auth: true }, async (_req, ctx) => {
  const user = ctx.session!.user;

  if (!isMainTenant(user.tenantId)) {
    return ApiErrors.forbidden(
      "Hanya tenant utama yang bisa menjalankan sinkronisasi backup",
    );
  }

  if (!(await hasPermission("backup_database:delete", user))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki permission untuk melakukan sinkronisasi ini",
    );
  }

  try {
    const result = await runBackupBackfillJob();
    return NextResponse.json(result);
  } catch (error) {
    logger.error("Error running settings backup backfill:", error);
    return ApiErrors.internalError("Gagal menjalankan sinkronisasi");
  }
});
