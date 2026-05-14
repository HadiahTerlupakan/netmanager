import { prisma } from "@/lib/prisma";
import type { AttendanceStatus } from "../types/attendance.enums";
import type { NoCheckoutRepairRecord } from "../services/NoCheckoutRepairService";
import { AttendanceRepository } from "./AttendanceRepository";

type NoCheckoutRepairRepository = {
  findCandidates(input: {
    tenantId: string;
    startDate: Date;
    endDate: Date;
  }): Promise<NoCheckoutRepairRecord[]>;
  updateStatus(input: {
    attendanceId: string;
    status: AttendanceStatus;
  }): Promise<void>;
};

export class PrismaNoCheckoutRepairRepository implements NoCheckoutRepairRepository {
  async findCandidates(input: {
    tenantId: string;
    startDate: Date;
    endDate: Date;
  }): Promise<NoCheckoutRepairRecord[]> {
    return prisma.attendance.findMany({
      where: {
        tenantId: input.tenantId,
        status: "NO_CHECKOUT",
        checkIn: {
          gte: input.startDate,
          lte: input.endDate,
        },
        checkOut: { not: null },
        correctedAt: null,
      },
      include: {
        user: {
          select: {
            workingHourMode: true,
            startWorkTime: true,
            shift: {
              select: {
                startTime: true,
              },
            },
          },
        },
      },
      orderBy: { checkIn: "asc" },
    });
  }

  async updateStatus(input: {
    attendanceId: string;
    status: AttendanceStatus;
  }): Promise<void> {
    const repository = new AttendanceRepository();
    await repository.update(input.attendanceId, { status: input.status });
  }
}
