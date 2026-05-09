import { AdminHolidayRouteService } from "@/modules/attendance";
import { notifyHolidayCreated } from "@/modules/notification";
import { apiSuccess, ApiErrors, createHandler } from "@/lib/api";
import * as z from "zod";
import { logger } from "@/lib/logger";
import { hasPermission } from "@/lib/rbac";

const holidayService = new AdminHolidayRouteService();

const holidayFilterSchema = z.object({
  year: z.coerce
    .number()
    .int()
    .min(2000)
    .max(2100)
    .default(() => new Date().getFullYear()),
});

const createHolidaySchema = z.object({
  date: z
    .string()
    .refine((val) => !isNaN(Date.parse(val)), "Invalid date format"),
  description: z.string().min(1, "Description is required").max(255),
  isNational: z.boolean().optional().default(true),
});

/**
 * GET /api/admin/holidays - List holidays by year
 */
export const GET = createHandler({ auth: true }, async (req, ctx) => {
  if (!(await hasPermission("holidays:read"))) {
    return ApiErrors.forbidden("Akses ditolak");
  }

  const { searchParams } = req.nextUrl;
  const parseResult = holidayFilterSchema.safeParse({
    year: searchParams.get("year"),
  });

  if (!parseResult.success) {
    return ApiErrors.badRequest("Parameter tidak valid", {
      errors: z.flattenError(parseResult.error).fieldErrors,
    });
  }

  const tenantId = ctx.session!.user.tenantId;
  if (!tenantId) return ApiErrors.badRequest("Tenant ID tidak ditemukan");

  const holidays = await holidayService.getHolidaysByYear(
    parseResult.data.year,
    tenantId,
  );
  return apiSuccess(holidays);
});

/**
 * POST /api/admin/holidays - Create new holiday
 */
export const POST = createHandler(
  {
    auth: true,
    schema: createHolidaySchema,
  },
  async (_req, ctx) => {
    if (!(await hasPermission("holidays:create"))) {
      return ApiErrors.forbidden("Akses ditolak");
    }

    const { date, description, isNational } = ctx.validated;
    const tenantId = ctx.session!.user.tenantId;
    if (!tenantId) return ApiErrors.badRequest("Tenant ID tidak ditemukan");

    const holiday = await holidayService.createHoliday(
      { date, description, isNational },
      tenantId,
    );
    if (!holiday) {
      return ApiErrors.conflict("Hari libur untuk tanggal ini sudah ada");
    }

    await logger.logActivity({
      action: "CREATE",
      subject: "Holiday",
      details: {
        id: holiday.id,
        date: holiday.date,
        description: holiday.description,
      },
      userId: ctx.session!.user.id,
      tenantId,
    });

    await notifyHolidayCreated({
      holidayId: holiday.id,
      holidayName: holiday.description,
      holidayDate: new Date(holiday.date),
      holidayType: holiday.isNational ? "NATIONAL" : "COMPANY",
      description: holiday.description,
      tenantId,
    });

    return apiSuccess(holiday, {
      status: 201,
      message: "Hari libur berhasil dibuat",
    });
  },
);
