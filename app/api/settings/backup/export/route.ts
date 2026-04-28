import { logger } from "@/lib/logger";
import { NextResponse } from "next/server";
import { ApiErrors, createHandler } from "@/lib/api";
import { hasPermission } from "@/lib/rbac";
import { isMainTenant } from "@/modules/mitra";
import { createBackupArchive } from "@/modules/settings";

export const GET = createHandler({ auth: true }, async (_req, ctx) => {
  const user = ctx.session!.user;

  if (!isMainTenant(user.tenantId)) {
    return ApiErrors.forbidden(
      "Hanya tenant utama yang dapat mengakses backup ini",
    );
  }

  if (!(await hasPermission("backup_database:read", user))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki permission untuk mengunduh backup database",
    );
  }

  try {
    const result = await createBackupArchive();

    return new NextResponse(new Uint8Array(result.fileBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/gzip",
        "Content-Disposition": `attachment; filename="${result.fileName}"`,
        "Content-Length": result.fileBuffer.length.toString(),
        "X-Backup-Databases": result.databases.join(","),
        ...(result.warnings.length > 0
          ? { "X-Backup-Warnings": result.warnings.join("; ") }
          : {}),
      },
    });
  } catch (error) {
    logger.error("Error creating settings backup export:", error);
    return ApiErrors.internalError("Gagal membuat backup");
  }
});
