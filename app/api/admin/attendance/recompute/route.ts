import { createHandler, apiSuccess, ApiErrors } from "@/lib/api";
import { isSuperAdmin } from "@/lib/auth";
import { getTimezone } from "@/lib/utils/get-timezone";
import { toStartOfDay, toEndOfDay } from "@/lib/utils/server-datetime";
import { AttendanceService } from "@/modules/attendance";
import * as z from "zod";

const recomputeSchema = z.object({
  userId: z.string().min(1),
  startDate: z.string(),
  endDate: z.string(),
});

export const POST = createHandler({ auth: true }, async (req, ctx) => {
  const user = ctx.session!.user;
  const tenantId = user.tenantId;

  if (!tenantId) {
    return ApiErrors.badRequest("Tenant ID tidak ditemukan");
  }

  if (!isSuperAdmin(user)) {
    return ApiErrors.forbidden(
      "Hanya Superadmin yang dapat melakukan recompute evaluasi absensi",
    );
  }

  const body = await req.json();
  const parseResult = recomputeSchema.safeParse(body);

  if (!parseResult.success) {
    return ApiErrors.badRequest("Data tidak valid", {
      errors: z.flattenError(parseResult.error).fieldErrors,
    });
  }

  const timezone = await getTimezone(tenantId);
  const startDate = toStartOfDay(
    new Date(parseResult.data.startDate),
    timezone,
  );
  const endDate = toEndOfDay(new Date(parseResult.data.endDate), timezone);

  if (startDate > endDate) {
    return ApiErrors.badRequest(
      "Tanggal awal tidak bisa lebih dari tanggal akhir",
    );
  }

  const attendanceService = new AttendanceService();
  const result =
    await attendanceService.recomputeHistoricalAttendanceEvaluations({
      userId: parseResult.data.userId,
      tenantId,
      startDate,
      endDate,
      actorId: user.id,
    });

  return apiSuccess(result);
});
