import { prisma } from "@/modules/database";
import { apiPaginated } from "@/lib/api";

import { AttendanceRepository } from "../repositories/AttendanceRepository";
import { AttendanceTimezoneService } from "./AttendanceTimezoneService";
import { AttendanceValidationService } from "./AttendanceValidationService";

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;
const STALE_FLEXIBLE_SESSION_HOURS = 24;
const MILLISECONDS_PER_HOUR = 60 * 60 * 1000;

interface MobileAttendanceHistoryInput {
  userId: string;
  tenantId: string;
  page?: number;
  limit?: number;
}

/** Service untuk route history absensi mobile. */
export class MobileAttendanceHistoryRouteService {
  private readonly attendanceRepository: AttendanceRepository;
  private readonly timezoneService: AttendanceTimezoneService;
  private readonly validationService: AttendanceValidationService;

  constructor(
    attendanceRepository: AttendanceRepository = new AttendanceRepository(),
    timezoneService: AttendanceTimezoneService = new AttendanceTimezoneService(),
    validationService: AttendanceValidationService = new AttendanceValidationService(),
  ) {
    this.attendanceRepository = attendanceRepository;
    this.timezoneService = timezoneService;
    this.validationService = validationService;
  }

  /** Ambil history absensi user untuk aplikasi mobile. */
  async getHistory(input: MobileAttendanceHistoryInput) {
    const pagination = this.normalizePagination(input.page, input.limit);
    const joinDate = await this.getJoinDate(input.userId);
    const [attendances, total, today] = await Promise.all([
      this.attendanceRepository.findManyForHistory({
        userId: input.userId,
        skip: pagination.skip,
        take: pagination.limit,
        joinDate: joinDate ?? undefined,
      }),
      this.attendanceRepository.countByUserId(
        input.userId,
        joinDate ?? undefined,
      ),
      this.getTodayMetadata(input.userId, input.tenantId),
    ]);

    return apiPaginated(this.addSessionMeta(attendances), {
      page: pagination.page,
      limit: pagination.limit,
      total,
      today,
    } as unknown as Parameters<typeof apiPaginated>[1]);
  }

  /** Normalisasi parameter pagination. */
  private normalizePagination(page?: number, limit?: number) {
    const safePage = page && page > 0 ? page : DEFAULT_PAGE;
    const safeLimit = limit && limit > 0 ? limit : DEFAULT_LIMIT;

    return {
      page: safePage,
      limit: safeLimit,
      skip: (safePage - 1) * safeLimit,
    };
  }

  /** Ambil join date user untuk membatasi history. */
  private async getJoinDate(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { joinDate: true },
    });

    return user?.joinDate ?? null;
  }

  /** Tambahkan metadata stale session untuk mode fleksibel. */
  private addSessionMeta(
    attendances: Array<{
      checkIn: Date;
      checkOut: Date | null;
      userId: string;
      id: string;
      status: string;
    }>,
  ) {
    const now = new Date();

    return attendances.map((attendance) => ({
      ...attendance,
      sessionMeta: {
        isStaleFlexibleSession: this.isStaleFlexibleSession(attendance, now),
      },
    }));
  }

  /** Cek apakah sesi fleksibel sudah stale. */
  private isStaleFlexibleSession(
    attendance: { checkIn: Date; checkOut: Date | null },
    now: Date,
  ): boolean {
    if (attendance.checkOut !== null) {
      return false;
    }

    return (
      now.getTime() - attendance.checkIn.getTime() >
      STALE_FLEXIBLE_SESSION_HOURS * MILLISECONDS_PER_HOUR
    );
  }

  /** Ambil metadata hari ini untuk status mobile. */
  private async getTodayMetadata(userId: string, tenantId: string) {
    const timezone = await this.timezoneService.getTimezone(tenantId);
    return this.validationService.getAttendanceDayMetadata(
      userId,
      timezone,
      new Date(),
      tenantId,
    );
  }
}
