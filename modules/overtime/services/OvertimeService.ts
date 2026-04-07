import { OvertimeRepository } from "@/modules/overtime";
import { OvertimeStatus } from "@prisma/client";
import { createNotification } from "../../notification/services/NotificationService";
import { HolidayRepository, AttendanceRepository } from "@/modules/attendance";
import { UserRepository } from "@/modules/users";
import { toStartOfDay, toEndOfDay } from "@/lib/utils/server-datetime";

export class OvertimeService {
  private repository: OvertimeRepository;
  private holidayRepository: HolidayRepository;
  private userRepository: UserRepository;
  private attendanceRepository: AttendanceRepository;

  constructor() {
    this.repository = new OvertimeRepository();
    this.holidayRepository = new HolidayRepository();
    this.userRepository = new UserRepository();
    this.attendanceRepository = new AttendanceRepository();
  }

  // 1. Create Request - Bisa kapan saja selama hari itu (tidak perlu absen dulu)
  async createRequest(
    userId: string,
    data: {
      date: Date;
      reason: string;
      tenantId?: string;
    },
  ) {
    const startOfDay = new Date(data.date);
    startOfDay.setTime(toStartOfDay(startOfDay).getTime());

    const endOfDay = new Date(data.date);
    endOfDay.setTime(toEndOfDay(endOfDay).getTime());

    const tenantId = data.tenantId;

    // Cek apakah sudah ada request PENDING/APPROVED/IN_PROGRESS hari ini
    const existing = await this.repository.findActiveRequestByDate(
      userId,
      tenantId,
      startOfDay,
      endOfDay,
    );

    if (existing) {
      throw new Error(
        "Anda sudah memiliki pengajuan lembur aktif (Pending/Approved/Berjalan) untuk hari ini.",
      );
    }

    // Buat request tanpa attendance link (akan di-link saat start)
    const request = await this.repository.create({
      user: { connect: { id: userId } },
      reason: data.reason,
      status: OvertimeStatus.PENDING,
      tenant: tenantId ? { connect: { id: tenantId } } : undefined,
    });

    // Notify Admins
    try {
      const user = await this.userRepository.findByIdWithSite(userId, tenantId);
      const admins = await this.userRepository.findAdminsForNotification(
        tenantId,
        user?.siteId ?? null,
      );

      for (const admin of admins) {
        await createNotification({
          type: "SYSTEM",
          priority: "NORMAL",
          title: "🔔 Pengajuan Lembur Baru",
          message: `${user?.name || "Karyawan"} mengajukan lembur: ${data.reason}`,
          link: "/admin/lembur",
          userId: admin.id,
          sourceType: "OVERTIME",
          sourceId: request.id,
          tenantId,
        });
      }
    } catch (error) {
      console.error("Failed to send notification:", error);
    }

    return request;
  }

  async startOvertime(
    userId: string,
    overtimeId: string,
    data: {
      photo: string;
      location?: string;
      timestamp?: Date;
      tenantId?: string;
    },
  ) {
    const { tenantId } = data;
    const overtime = await this.repository.findById(overtimeId);

    if (!overtime) throw new Error("Data lembur tidak ditemukan");
    if (overtime.userId !== userId) throw new Error("Akses ditolak");

    if (overtime.status !== OvertimeStatus.APPROVED) {
      throw new Error(
        "Pengajuan lembur belum disetujui atau status tidak valid.",
      );
    }

    // Cek apakah hari ini libur (dari tabel Holiday)
    const today = new Date();
    const { isHoliday, holiday } = await this.holidayRepository.isHoliday(
      today,
      tenantId,
    );

    // Cari attendance hari ini (tidak wajib checkout)
    const startOfDay = new Date();
    startOfDay.setTime(toStartOfDay(startOfDay).getTime());
    const endOfDay = new Date();
    endOfDay.setTime(toEndOfDay(endOfDay).getTime());

    const attendance = await this.attendanceRepository.findFirstWithUser({
      where: {
        userId: userId,
        tenantId,
        checkIn: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
      orderBy: {
        checkIn: "desc",
      },
      userSelect: {
        workingHourMode: true,
        flexibleTargetHour: true,
        workDays: true,
      },
    });

    // Cek apakah hari ini adalah off-day user (dari workDays)
    const userWorkDays = attendance?.user?.workDays;
    const userWorkingMode = attendance?.user?.workingHourMode;
    const isOffDay = this.isUserOffDay(userWorkDays, userWorkingMode, today);

    // NEW: More flexible validation - warning instead of error
    if (!isHoliday && !isOffDay && !attendance) {
      // Warning instead of error
      console.warn(
        `[Overtime] User ${userId} starting overtime without regular attendance`,
      );
      // Still allow, but log it
    }

    // NEW: Remove flexible target requirement - only log warning
    if (
      attendance &&
      attendance.user.workingHourMode === "FLEXIBLE" &&
      !isHoliday &&
      attendance.checkOut
    ) {
      const checkInTime = new Date(attendance.checkIn).getTime();
      const checkOutTime = new Date(attendance.checkOut).getTime();
      const durationHours = (checkOutTime - checkInTime) / (1000 * 60 * 60);

      // Default target 8 jam jika null
      const targetHours = attendance.user.flexibleTargetHour || 8;

      if (durationHours < targetHours) {
        const shortfall = (targetHours - durationHours).toFixed(1);
        console.warn(
          `[Overtime] User ${userId} starting overtime with incomplete regular shift: ${durationHours.toFixed(1)}h worked vs ${targetHours}h target (shortfall: ${shortfall}h)`,
        );
        // Still allow, but log it
      }
    }

    // Determine holiday description
    let holidayDesc: string | null = null;
    if (holiday?.description) {
      holidayDesc = holiday.description;
    } else if (isOffDay) {
      holidayDesc = "Hari Libur Karyawan";
    }

    return this.repository.update(overtimeId, {
      status: OvertimeStatus.IN_PROGRESS,
      startTime: data.timestamp || new Date(),
      startPhoto: data.photo,
      startLocation: data.location,
      // Connect attendance hanya jika ada (hari kerja biasa)
      attendance: attendance ? { connect: { id: attendance.id } } : undefined,
      // NEW: Save holiday/off-day info
      isHolidayOvertime: isHoliday || isOffDay,
      isNationalHoliday: isHoliday && holiday?.isNational === true,
      isOffDay: isOffDay && !isHoliday, // Prioritas: Holiday > OffDay
      holidayDescription: holidayDesc,
    });
  }

  /**
   * Helper: Check apakah hari ini adalah off-day user berdasarkan workDays
   */
  private isUserOffDay(
    workDays: string | null | undefined,
    mode: string | null | undefined,
    date: Date,
  ): boolean {
    if (!workDays || mode === "FLEXIBLE") return false;
    const dayMap: Record<number, string> = {
      0: "SUN",
      1: "MON",
      2: "TUE",
      3: "WED",
      4: "THU",
      5: "FRI",
      6: "SAT",
    };
    const dayName = dayMap[date.getDay()];
    const workDayList = workDays
      .toUpperCase()
      .split(",")
      .map((d) => d.trim());
    return !workDayList.includes(dayName);
  }

  // 3. Stop Overtime
  async stopOvertime(
    userId: string,
    overtimeId: string,
    data: { photo: string; location?: string; timestamp?: Date },
  ) {
    const overtime = await this.repository.findById(overtimeId);

    if (!overtime) throw new Error("Data lembur tidak ditemukan");
    if (overtime.userId !== userId) throw new Error("Akses ditolak");

    if (overtime.status !== OvertimeStatus.IN_PROGRESS) {
      throw new Error("Lembur belum dimulai.");
    }

    if (!overtime.startTime) {
      throw new Error("Data Start Time corrupt.");
    }

    const endTime = data.timestamp || new Date();
    const durationMs =
      endTime.getTime() - new Date(overtime.startTime).getTime();
    const durationMinutes = Math.round(durationMs / 60000);

    // Prevent negative duration if clocks are messed up
    const validDuration = durationMinutes > 0 ? durationMinutes : 0;

    return this.repository.update(overtimeId, {
      status: OvertimeStatus.COMPLETED,
      endTime: endTime,
      endPhoto: data.photo,
      endLocation: data.location,
      duration: validDuration,
    });
  }

  async getHistory(userId: string, tenantId?: string) {
    return this.repository.findAll({ userId, tenantId });
  }

  async getAllRequests(filters?: {
    status?: OvertimeStatus;
    startDate?: Date;
    endDate?: Date;
    siteId?: string;
    departmentId?: string;
    holidayType?: string;
    skip?: number;
    take?: number;
    tenantId?: string;
  }) {
    const [data, total, summary] = await Promise.all([
      this.repository.findAll(filters),
      this.repository.count(filters),
      this.repository.countByStatus(filters),
    ]);

    const tenantId = filters?.tenantId;

    // Enrich with holiday info on-the-fly (untuk data lama yang belum punya flag)
    const enrichedData = await Promise.all(
      data.map(async (item: unknown) => {
        const overtimeItem = item as {
          isHolidayOvertime?: boolean;
          createdAt: Date;
          user?: {
            workDays?: string | null;
            workingHourMode?: string | null;
          };
          [key: string]: unknown;
        };

        // Skip jika sudah ada flag dari startOvertime
        if (overtimeItem.isHolidayOvertime === true) {
          return overtimeItem;
        }

        // Cross-check dengan Holiday table berdasarkan createdAt
        const overtimeDate = new Date(overtimeItem.createdAt);
        const { isHoliday, holiday } = await this.holidayRepository.isHoliday(
          overtimeDate,
          tenantId,
        );

        // Cek user workDays jika ada user data
        let isOffDay = false;
        if (
          overtimeItem.user?.workDays &&
          overtimeItem.user?.workingHourMode !== "FLEXIBLE"
        ) {
          isOffDay = this.isUserOffDay(
            overtimeItem.user.workDays,
            overtimeItem.user.workingHourMode,
            overtimeDate,
          );
        }

        // Determine holiday description
        let holidayDesc: string | null = null;
        if (holiday?.description) {
          holidayDesc = holiday.description;
        } else if (isOffDay) {
          holidayDesc = "Hari Libur Karyawan";
        }

        return {
          ...overtimeItem,
          isHolidayOvertime: isHoliday || isOffDay,
          isNationalHoliday: isHoliday && holiday?.isNational === true,
          isOffDay: isOffDay && !isHoliday,
          holidayDescription: holidayDesc,
        };
      }),
    );

    return { data: enrichedData, total, summary };
  }

  async approveRequest(id: string, approverId: string) {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new Error("Overtime request not found");
    }
    if (existing.status !== OvertimeStatus.PENDING) {
      throw new Error("Only pending overtime requests can be approved");
    }

    const result = await this.repository.update(id, {
      status: OvertimeStatus.APPROVED,
      approvedBy: approverId,
    });

    // Notify User
    try {
      await createNotification({
        type: "SYSTEM",
        priority: "HIGH",
        title: "✅ Pengajuan Lembur Disetujui",
        message:
          "Pengajuan lembur Anda telah disetujui. Silakan mulai lembur setelah checkout.",
        link: "/karyawan/lembur",
        userId: result.userId,
        sourceType: "OVERTIME",
        sourceId: result.id,
        tenantId: result.tenantId || undefined,
      });
    } catch (error) {
      console.error("Failed to send notification:", error);
    }

    return result;
  }

  async rejectRequest(id: string, reason: string) {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new Error("Overtime request not found");
    }
    if (existing.status !== OvertimeStatus.PENDING) {
      throw new Error("Only pending overtime requests can be rejected");
    }

    const result = await this.repository.update(id, {
      status: OvertimeStatus.REJECTED,
      rejectionReason: reason,
    });

    // Notify User
    try {
      await createNotification({
        type: "SYSTEM",
        priority: "HIGH",
        title: "❌ Pengajuan Lembur Ditolak",
        message: `Alasan: ${reason}`,
        link: "/karyawan/lembur",
        userId: result.userId,
        sourceType: "OVERTIME",
        sourceId: result.id,
        tenantId: result.tenantId || undefined,
      });
    } catch (error) {
      console.error("Failed to send notification:", error);
    }

    return result;
  }

  async deleteOvertime(id: string) {
    return this.repository.delete(id);
  }

  async getReportData(
    startDate: Date,
    endDate: Date,
    siteId?: string,
    departmentId?: string,
  ) {
    const [stats, dailyStats, groupedBySite, groupedByDept, topEmployees] =
      await Promise.all([
        this.repository.getStatsByDateRange(
          startDate,
          endDate,
          siteId,
          departmentId,
        ),
        this.repository.getDailyStats(startDate, endDate, siteId, departmentId),
        this.repository.getGroupedStats(startDate, endDate, "site"),
        this.repository.getGroupedStats(startDate, endDate, "department"),
        this.repository.getTopEmployees(
          startDate,
          endDate,
          5,
          siteId,
          departmentId,
        ),
      ]);

    return {
      summary: {
        totalRequests: stats.totalRequests,
        totalDuration: stats.totalDuration,
        avgDuration:
          stats.totalRequests > 0
            ? Math.round(stats.totalDuration / stats.totalRequests)
            : 0,
      },
      trends: dailyStats,
      bySite: groupedBySite,
      byDepartment: groupedByDept,
      topEmployees,
    };
  }
}
