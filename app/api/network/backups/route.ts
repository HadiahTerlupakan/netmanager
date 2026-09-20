import { ApiErrors, apiSuccess, createHandler } from "@/lib/api";
import { DeviceBackupService } from "@/modules/network";
import {
  deviceBackupCreateSchema,
  deviceBackupQuerySchema,
} from "@/lib/validations/device-backup";
import * as z from "zod";

const backupService = new DeviceBackupService();

/**
 * @swagger
 * /api/network/backups:
 *   get:
 *     summary: Get all device backups
 *     description: Mengambil semua data backup perangkat dengan filter
 *     tags: [Device Backups]
 */
export const GET = createHandler({ auth: true, permissions: ["network:read"] }, async (req) => {
  const queryParams = Object.fromEntries(req.nextUrl.searchParams.entries());
  const parsed = deviceBackupQuerySchema.safeParse(queryParams);

  if (!parsed.success) {
    return ApiErrors.badRequest("Invalid query parameters", {
      errors: z.flattenError(parsed.error),
    });
  }

  const backups = await backupService.listBackups(parsed.data);
  return apiSuccess(backups);
});

/**
 * @swagger
 * /api/network/backups:
 *   post:
 *     summary: Create new device backup
 *     description: Membuat backup perangkat baru
 *     tags: [Device Backups]
 */
export const POST = createHandler(
  {
    auth: true,
    permissions: ["network:create"],
    schema: deviceBackupCreateSchema,
  },
  async (_req, ctx) => {
    const result = await backupService.createBackup({
      ...ctx.validated,
      createdBy: ctx.session!.user.id,
    });

    return apiSuccess(result, { status: 201 });
  },
);
