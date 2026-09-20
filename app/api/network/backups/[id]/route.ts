import { ApiErrors, apiSuccess, createHandler } from "@/lib/api";
import { DeviceBackupService } from "@/modules/network";

const backupService = new DeviceBackupService();

/**
 * @swagger
 * /api/network/backups/{id}:
 *   get:
 *     summary: Get device backup by ID
 *     description: Mengambil data backup perangkat berdasarkan ID
 *     tags: [Device Backups]
 */
export const GET = createHandler({ auth: true, permissions: ["network:read"] }, async (_req, ctx) => {
  const result = await backupService.getBackup(ctx.params.id);
  return toBackupResponse(result);
});

/**
 * @swagger
 * /api/network/backups/{id}:
 *   delete:
 *     summary: Delete device backup
 *     description: Menghapus data backup perangkat
 *     tags: [Device Backups]
 */
export const DELETE = createHandler({ auth: true, permissions: ["network:delete"] }, async (_req, ctx) => {
  const result = await backupService.deleteBackup({
    id: ctx.params.id,
    userId: ctx.session!.user.id,
  });
  return toBackupResponse(result);
});

function toBackupResponse<T>(result: {
  type: "success" | "notFound" | "migrationPending";
  data?: T;
  message?: string;
}) {
  if (result.type === "notFound") {
    return ApiErrors.notFound(result.message ?? "Backup");
  }

  if (result.type === "migrationPending") {
    return ApiErrors.internalError(
      result.message ??
        "Device backups will be available after database migration",
    );
  }

  return apiSuccess(result.data);
}
