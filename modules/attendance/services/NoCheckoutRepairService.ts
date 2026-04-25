import { prisma } from "@/lib/prisma";
import type { AttendanceStatus } from "@prisma/client";

import { AttendanceRepository } from "../repositories/AttendanceRepository";
import { AttendanceTimezoneService } from "./AttendanceTimezoneService";
import { AttendanceService } from "./AttendanceService";

const AUTO_CHECKOUT_NOTE = "Auto-Checkout: Lupa Absen Pulang";

type RepairSummary = {
  scanned: number;
  repairable: number;
  repaired: number;
};

export type NoCheckoutRepairRecord = {
  id: string;
  tenantId: string | null;
  userId: string;
  checkIn: Date;
  checkOut: Date | null;
  checkOutPhoto: string | null;
  checkOutLocation: string | null;
  status: AttendanceStatus;
  notes: string | null;
  user: {
    workingHourMode: string | null;
    startWorkTime: string | null;
    shift: {
      startTime: string;
    } | null;
  };
};

type RepairInput = {
  tenantId: string;
  startDate: Date;
  endDate: Date;
  dryRun: boolean;
  actorId: string;
  timezone: string;
};

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

type StatusCalculator = {
  calculateStatus(
    checkInTime: Date,
    scheduleTime: string,
    timezone?: string,
  ): Promise<"ON_TIME" | "LATE">;
};

type EvaluationRecomputer = {
  recompute(input: {
    userId: string;
    tenantId: string;
    startDate: Date;
    endDate: Date;
    actorId: string;
  }): Promise<unknown>;
};

class PrismaNoCheckoutRepairRepository implements NoCheckoutRepairRepository {
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

class AttendanceEvaluationRecomputer implements EvaluationRecomputer {
  async recompute(input: {
    userId: string;
    tenantId: string;
    startDate: Date;
    endDate: Date;
    actorId: string;
  }) {
    const service = new AttendanceService();
    return service.recomputeHistoricalAttendanceEvaluations(input);
  }
}

export class NoCheckoutRepairService {
  constructor(
    private readonly repository: NoCheckoutRepairRepository = new PrismaNoCheckoutRepairRepository(),
    private readonly statusCalculator: StatusCalculator = new AttendanceTimezoneService(),
    private readonly evaluator: EvaluationRecomputer = new AttendanceEvaluationRecomputer(),
  ) {}

  /** Memeriksa apakah record NO_CHECKOUT punya bukti checkout sah untuk repair otomatis. */
  isRepairable(record: NoCheckoutRepairRecord): boolean {
    if (record.status !== "NO_CHECKOUT") {
      return false;
    }

    if (!record.checkOut) {
      return false;
    }

    return Boolean(record.checkOutPhoto || record.checkOutLocation);
  }

  /** Memperbaiki status NO_CHECKOUT historis yang punya bukti checkout sah. */
  async repair(input: RepairInput): Promise<RepairSummary> {
    const records = await this.repository.findCandidates(input);
    const repairableRecords = records.filter((record) =>
      this.isRepairable(record),
    );

    if (input.dryRun) {
      return {
        scanned: records.length,
        repairable: repairableRecords.length,
        repaired: 0,
      };
    }

    for (const record of repairableRecords) {
      const status = await this.resolveStatus(record, input.timezone);
      await this.repository.updateStatus({
        attendanceId: record.id,
        status,
      });
      await this.evaluator.recompute({
        userId: record.userId,
        tenantId: input.tenantId,
        startDate: record.checkIn,
        endDate: record.checkIn,
        actorId: input.actorId,
      });
    }

    return {
      scanned: records.length,
      repairable: repairableRecords.length,
      repaired: repairableRecords.length,
    };
  }

  private async resolveStatus(
    record: NoCheckoutRepairRecord,
    timezone: string,
  ): Promise<AttendanceStatus> {
    const scheduleTime = this.resolveScheduleTime(record);
    return this.statusCalculator.calculateStatus(
      record.checkIn,
      scheduleTime,
      timezone,
    );
  }

  private resolveScheduleTime(record: NoCheckoutRepairRecord): string {
    if (record.user.workingHourMode === "SHIFT") {
      return record.user.shift?.startTime ?? "08:00";
    }

    return record.user.startWorkTime ?? "08:00";
  }
}

export function isPureAutoCheckoutRecord(
  record: NoCheckoutRepairRecord,
): boolean {
  return Boolean(record.notes?.includes(AUTO_CHECKOUT_NOTE));
}
