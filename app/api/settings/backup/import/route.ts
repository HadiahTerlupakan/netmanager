import { logger } from "@/lib/logger";
import { NextResponse } from "next/server";
import { ApiErrors, createHandler } from "@/lib/api";
import { hasPermission } from "@/lib/rbac";
import { isMainTenant } from "@/modules/mitra";
import { importBackupArchive } from "@/modules/settings";

export const POST = createHandler({ auth: true }, async (req, ctx) => {
  const user = ctx.session!.user;

  if (!isMainTenant(user.tenantId)) {
    return ApiErrors.forbidden(
      "Hanya tenant utama yang dapat mengakses backup ini",
    );
  }

  if (!(await hasPermission("backup_database:delete", user))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki permission untuk mengunggah backup database",
    );
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return ApiErrors.badRequest(
        'File backup tidak ditemukan. Pastikan form field bernama "file".',
      );
    }

    const result = await importBackupArchive({
      fileBuffer: Buffer.from(await file.arrayBuffer()),
      fileName: file.name,
      tenantId: user.tenantId,
    });

    return NextResponse.json(result);
  } catch (error) {
    logger.error("Error importing settings backup:", error);

    const message = error instanceof Error ? error.message : String(error);

    if (
      message.includes("Format file tidak valid") ||
      message.includes("tidak berisi data database yang valid")
    ) {
      return ApiErrors.badRequest(
        "File backup tidak valid atau tidak berisi data database yang valid",
      );
    }

    return ApiErrors.internalError("Gagal import backup");
  }
});
