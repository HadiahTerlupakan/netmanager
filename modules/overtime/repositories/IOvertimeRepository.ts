import {
  type Overtime,
  type OvertimeStatus,
  Prisma,
  type PrismaPromise,
} from "@prisma/client";

export interface UpsertOvertimeAutoCheckoutScheduleInput {
  overtimeId: string;
  scheduledFor: Date;
  jobId?: string | null;
}

export interface CancelOvertimeAutoCheckoutScheduleInput {
  overtimeId: string;
  cancelledAt: Date;
}

export interface CompleteOvertimeAutoCheckoutScheduleInput {
  overtimeId: string;
  executedAt: Date;
  scheduleStatus: "COMPLETED" | "FAILED";
  lastError: string | null;
}

export interface CompleteScheduledAutoCheckoutInput {
  scheduleId: string;
  overtimeId: string;
  version: number;
  executedAt: Date;
  endTime: Date;
  duration: number;
}

export interface OvertimeAutoCheckoutScheduleRecord {
  id: string;
  overtimeId: string;
  scheduledFor: Date;
  jobId: string | null;
  version: number;
  scheduleStatus: string;
  executedAt?: Date | null;
  cancelledAt?: Date | null;
  lastError?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IOvertimeRepository {
  findById(id: string): Promise<Overtime | null>;
  findAll(filters?: {
    userId?: string;
    status?: OvertimeStatus;
    startDate?: Date;
    endDate?: Date;
  }): Promise<Overtime[]>;
  create(data: Prisma.OvertimeCreateInput): Promise<Overtime>;
  update(id: string, data: Prisma.OvertimeUpdateInput): Promise<Overtime>;
  delete(id: string): Promise<void>;
  findAutoCheckoutScheduleById(
    id: string,
  ): Promise<OvertimeAutoCheckoutScheduleRecord | null>;
  findAutoCheckoutScheduleByOvertimeId(
    overtimeId: string,
  ): Promise<OvertimeAutoCheckoutScheduleRecord | null>;
  findSchedulesForRehydration(
    now: Date,
  ): Promise<OvertimeAutoCheckoutScheduleRecord[]>;
  attachAutoCheckoutJobId(
    overtimeId: string,
    jobId: string,
  ): Promise<OvertimeAutoCheckoutScheduleRecord>;
  upsertAutoCheckoutSchedule(
    input: UpsertOvertimeAutoCheckoutScheduleInput,
  ): Promise<OvertimeAutoCheckoutScheduleRecord>;
  cancelAutoCheckoutSchedule(
    input: CancelOvertimeAutoCheckoutScheduleInput,
  ): PrismaPromise<Prisma.BatchPayload>;
  completeAutoCheckoutSchedule(
    input: CompleteOvertimeAutoCheckoutScheduleInput,
  ): Promise<OvertimeAutoCheckoutScheduleRecord>;
  completeScheduledAutoCheckout(
    input: CompleteScheduledAutoCheckoutInput,
  ): Promise<boolean>;
}
