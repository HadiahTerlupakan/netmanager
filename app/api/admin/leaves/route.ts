import { LeaveStatus, LeaveType } from "@prisma/client";
import * as z from "zod";

import {
  apiError,
  apiSuccess,
  ApiErrors,
  createHandler,
  ErrorCodes,
} from "@/lib/api";
import { hasPermission } from "@/lib/rbac";
import { AdminLeaveRouteService } from "@/modules/attendance";

const leaveRouteService = new AdminLeaveRouteService();

const createLeaveSchema = z.object({
  userId: z.uuid({ error: "Invalid user ID" }),
  type: z.enum(LeaveType),
  startDate: z
    .string()
    .refine((value) => !Number.isNaN(Date.parse(value)), "Invalid date format"),
  endDate: z
    .string()
    .refine((value) => !Number.isNaN(Date.parse(value)), "Invalid date format"),
  reason: z.string().min(1, "Alasan wajib diisi").max(500),
  replacementDate: z
    .string()
    .refine((value) => !Number.isNaN(Date.parse(value)), "Invalid date format")
    .optional()
    .nullable(),
  attachmentUrl: z.url().optional().nullable(),
});

export const GET = createHandler({ auth: true }, async (req, ctx) => {
  const user = ctx.session!.user;
  const tenantId = user.tenantId;

  if (!(await hasPermission("izin:read"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk melihat data izin/cuti",
    );
  }

  const status = req.nextUrl.searchParams.get("status");
  const result = await leaveRouteService.getLeaves({
    session: ctx.session as never,
    tenantId,
    ...(status ? { status: status as LeaveStatus } : {}),
  });

  if (!result.success) {
    return ApiErrors.internalError(result.error);
  }

  return apiSuccess(result.data?.leaves || []);
});

export const POST = createHandler(
  {
    auth: true,
    schema: createLeaveSchema,
  },
  async (_req, ctx) => {
    if (!(await hasPermission("izin:create"))) {
      return ApiErrors.forbidden(
        "Anda tidak memiliki akses untuk membuat izin/cuti",
      );
    }

    const result = await leaveRouteService.createLeave({
      ...ctx.validated,
      startDate: new Date(ctx.validated.startDate),
      endDate: new Date(ctx.validated.endDate),
      replacementDate: ctx.validated.replacementDate
        ? new Date(ctx.validated.replacementDate)
        : undefined,
      session: ctx.session as never,
    });

    if (!result.success) {
      return apiError(
        result.error || "Gagal membuat izin/cuti",
        ErrorCodes.BUSINESS_LOGIC_ERROR,
        { status: 400 },
      );
    }

    return apiSuccess(result.data, {
      status: 201,
      message: "Izin/cuti berhasil dibuat",
    });
  },
);
