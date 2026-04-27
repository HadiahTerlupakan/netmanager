import { NextResponse } from "next/server";
import * as z from "zod";

import { createHandler } from "@/lib/api";
import { isSuperAdmin } from "@/lib/auth";
import { ApiErrors } from "@/lib/api-response";
import { AdminAttendanceBackdateRouteService } from "@/modules/attendance";

const backdateSchema = z.object({
  startDate: z.string(),
  endDate: z.string(),
});

const backdateService = new AdminAttendanceBackdateRouteService();

export const POST = createHandler({ auth: true }, async (req, ctx) => {
  const user = ctx.session!.user;
  const tenantId = user.tenantId;

  if (!tenantId) {
    return ApiErrors.badRequest("Tenant ID tidak ditemukan");
  }

  if (!isSuperAdmin(user)) {
    return ApiErrors.forbidden(
      "Hanya Superadmin yang dapat melakukan backfill absensi",
    );
  }

  const body = await req.json();
  const parseResult = backdateSchema.safeParse(body);
  if (!parseResult.success) {
    return ApiErrors.badRequest("Data tidak valid", {
      errors: z.flattenError(parseResult.error).fieldErrors,
    });
  }

  try {
    const result = await backdateService.backfillAttendance({
      tenantId,
      startDate: parseResult.data.startDate,
      endDate: parseResult.data.endDate,
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "Tanggal awal tidak bisa lebih dari tanggal akhir"
    ) {
      return ApiErrors.badRequest(error.message);
    }

    console.error("Attendance Backdate Error:", error);
    return ApiErrors.internalError("Gagal melakukan backfill absensi");
  }
});
