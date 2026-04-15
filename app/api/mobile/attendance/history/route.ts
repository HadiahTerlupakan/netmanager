import { prisma } from "@/modules/database";
import {
  AttendanceTimezoneService,
  AttendanceValidationService,
} from "@/modules/attendance";
import { apiPaginated, createHandler } from "@/lib/api";

export const dynamic = "force-dynamic";

const STALE_FLEXIBLE_SESSION_HOURS = 24;

export const GET = createHandler({ auth: true }, async (_request, ctx) => {
  const userSession = ctx.session!.user;
  const userId = userSession.id;
  const tenantId = userSession.tenantId as string;

  const page = parseInt((ctx.query.page as string) || "1");
  const limit = parseInt((ctx.query.limit as string) || "10");
  const skip = (page - 1) * limit;

  const [attendances, total] = await Promise.all([
    prisma.attendance.findMany({
      where: { userId, tenantId },
      orderBy: { checkIn: "desc" },
      take: limit,
      skip,
      include: {
        user: {
          select: {
            workingHourMode: true,
            flexibleTargetHour: true,
            shift: {
              select: {
                startTime: true,
                endTime: true,
              },
            },
          },
        },
      },
    }),
    prisma.attendance.count({ where: { userId, tenantId } }),
  ]);

  const now = new Date();
  const attendancesWithSessionMeta = attendances.map((attendance) => {
    const isStaleFlexibleSession =
      attendance.user?.workingHourMode === "FLEXIBLE" &&
      attendance.checkOut === null &&
      now.getTime() - attendance.checkIn.getTime() >
        STALE_FLEXIBLE_SESSION_HOURS * 60 * 60 * 1000;

    return {
      ...attendance,
      sessionMeta: {
        isStaleFlexibleSession,
      },
    };
  });

  const timezoneService = new AttendanceTimezoneService();
  const validationService = new AttendanceValidationService();
  const timezone = await timezoneService.getTimezone(tenantId);
  const today = await validationService.getAttendanceDayMetadata(
    userId,
    timezone,
    new Date(),
    tenantId,
  );

  return apiPaginated(attendancesWithSessionMeta, {
    page,
    limit,
    total,
    today,
  } as unknown as Parameters<typeof apiPaginated>[1]);
});
