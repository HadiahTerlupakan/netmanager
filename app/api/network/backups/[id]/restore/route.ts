import { ApiErrors, apiSuccess, createHandler } from "@/lib/api";
import { DeviceBackupService } from "@/modules/network";
import { configurationRestoreCreateSchema } from "@/lib/validations/device-backup";

const backupService = new DeviceBackupService();

/**
 * @swagger
 * /api/network/backups/{id}/restore:
 *   post:
 *     summary: Restore configuration from backup
 *     description: Memulih konfigurasi dari backup
 *     tags: [Configuration Restore]
 */
export const POST = createHandler(
  {
    auth: true,
    schema: configurationRestoreCreateSchema,
  },
  async (_req, ctx) => {
    const result = await backupService.createRestore({
      ...ctx.validated,
      backupId: ctx.params.id,
      createdBy: ctx.session!.user.id,
    });

    if (result.type === "notFound") {
      return ApiErrors.notFound(result.message);
    }

    if (result.type === "migrationPending") {
      return ApiErrors.internalError(result.message);
    }

    return apiSuccess(result.data, { status: result.status });
  },
);
