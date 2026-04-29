import { Prisma } from "@prisma/client";
import type { AttendanceStatus } from "@prisma/client";
import type { IAttendanceRepository } from "../domain/ports/IAttendanceRepository";
import { AttendanceCorrectionRepository } from "./AttendanceCorrectionRepository";
import { AttendanceReminderRepository } from "./AttendanceReminderRepository";
import { AttendanceSessionRepository } from "./AttendanceSessionRepository";
import { AttendanceEvaluationRepository } from "./AttendanceEvaluationRepository";
import { AttendanceRepositoryReportFacade } from "./AttendanceRepositoryReportFacade";

export type AttendanceCorrectionSource = Prisma.AttendanceGetPayload<{
  include: {
    user: {
      include: { shift: true };
    };
  };
}>;

export class AttendanceRepositoryFacade
  extends AttendanceRepositoryReportFacade
  implements IAttendanceRepository
{
  private readonly reminderRepository = new AttendanceReminderRepository();
  private readonly sessionRepository = new AttendanceSessionRepository();

  async findAllOpenSessionsWithUser(
    endOfToday: Date,
    twentyFourHoursAgo: Date,
    tenantId?: string,
  ) {
    return this.sessionRepository.findAllOpenSessionsWithUser({
      endOfToday,
      twentyFourHoursAgo,
      tenantId,
    });
  }

  async findOpenSessionForAutoCheckout(params: {
    attendanceId: string;
    tenantId: string;
  }) {
    return this.sessionRepository.findOpenSessionForAutoCheckout(params);
  }

  private readonly correctionRepository = new AttendanceCorrectionRepository();

  async findCorrectionSourceById(
    id: string,
  ): Promise<AttendanceCorrectionSource | null> {
    return this.correctionRepository.findCorrectionSourceById(id);
  }

  async createCorrectedAttendance(data: Prisma.AttendanceUncheckedCreateInput) {
    return this.correctionRepository.createCorrectedAttendance(data);
  }

  async markAttendanceAsCorrected(input: {
    sourceAttendanceId: string;
    correctedById: string;
    correctionReason: string;
    correctionNotes: string | null;
    correctionEvidencePhotoUrl: string;
    replacementAttendanceId: string;
  }) {
    return this.correctionRepository.markAttendanceAsCorrected(input);
  }

  async applyMissedCheckInCorrection(input: {
    createData: Prisma.AttendanceUncheckedCreateInput;
    sourceAttendanceId: string;
    correctedById: string;
    correctionReason: string;
    correctionNotes: string | null;
    correctionEvidencePhotoUrl: string;
    evaluationChange?: {
      evaluation: Prisma.AttendanceEvaluationUncheckedCreateInput;
      audit: Omit<
        Prisma.AttendanceEvaluationAuditUncheckedCreateInput,
        "evaluationId"
      >;
    };
  }) {
    return this.correctionRepository.applyMissedCheckInCorrection(input);
  }

  async updateOpenSessionForAutoCheckout(params: {
    attendanceId: string;
    tenantId: string;
    data: Prisma.AttendanceUpdateInput;
  }) {
    return this.sessionRepository.updateOpenSessionForAutoCheckout(params);
  }

  async update(id: string, data: Prisma.AttendanceUpdateInput) {
    return this.crudRepository.update(id, data);
  }

  async create(data: Prisma.AttendanceUncheckedCreateInput) {
    return this.crudRepository.create(data);
  }

  async findFirstByUserAndDateRange(
    userId: string,
    tenantId: string,
    startOfDay: Date,
    endOfDay: Date,
  ) {
    return this.crudRepository.findFirstByUserAndDateRange({
      userId,
      tenantId,
      startOfDay,
      endOfDay,
    });
  }

  async findCheckedInUserIds(startOfDay: Date, endOfDay: Date) {
    return this.reminderRepository.findCheckedInUserIds(startOfDay, endOfDay);
  }

  async findIncompleteCheckOutWithUser(startOfDay: Date, endOfDay: Date) {
    return this.reminderRepository.findIncompleteCheckOutWithUser(
      startOfDay,
      endOfDay,
    );
  }

  async findIncompleteCheckOutSelect(startOfDay: Date, endOfDay: Date) {
    return this.reminderRepository.findIncompleteCheckOutSelect(
      startOfDay,
      endOfDay,
    );
  }

  async findActiveFlexibleSessionsWithUser() {
    return this.reminderRepository.findActiveFlexibleSessionsWithUser();
  }

  async createWithId(data: {
    id: string;
    userId: string;
    tenantId: string;
    checkIn: Date;
    status: AttendanceStatus;
    notes: string;
    location: string;
    updatedAt: Date;
  }) {
    return this.crudRepository.createWithId(data);
  }

  async deleteMany(where: Prisma.AttendanceWhereInput) {
    return this.crudRepository.deleteMany(where);
  }

  async findFirstOpenSession(params: { userId: string; tenantId?: string }) {
    return this.sessionRepository.findFirstOpenSession(params);
  }

  async findManyStaleSessions(params: {
    userId: string;
    effectiveToday: Date;
    tenantId?: string;
  }) {
    return this.sessionRepository.findManyStaleSessions(params);
  }

  async findFirstActiveForCheckout(params: {
    userId: string;
    tenantId?: string;
  }) {
    return this.sessionRepository.findFirstActiveForCheckout(params);
  }

  async findFirstForCurrentStatus(params: {
    userId: string;
    tenantId?: string;
  }) {
    return this.sessionRepository.findFirstForCurrentStatus(params);
  }

  private readonly evaluationRepository = new AttendanceEvaluationRepository();

  async findLatestEvaluationForUser(params: {
    userId: string;
    tenantId?: string;
    workDate?: Date;
  }) {
    return this.evaluationRepository.findLatestEvaluationForUser(params);
  }

  async findManyEvaluationLookups(params: {
    tenantId: string;
    userIds: string[];
    workDates: Date[];
  }) {
    return this.evaluationRepository.findManyEvaluationLookups(params);
  }

  async findManyPayrollEvaluationsByUserAndDateRange(params: {
    userId: string;
    startDate: Date;
    endDate: Date;
    tenantId?: string;
  }) {
    return this.evaluationRepository.findManyPayrollEvaluationsByUserAndDateRange(
      params,
    );
  }

  async findManyForHistory(params: {
    userId: string;
    skip: number;
    take: number;
    joinDate?: Date;
  }) {
    return this.crudRepository.findManyForHistory(params);
  }

  async countByUserId(userId: string, joinDate?: Date) {
    return this.crudRepository.countByUserId(userId, joinDate);
  }

  async upsertAttendanceEvaluation(
    data: Prisma.AttendanceEvaluationUncheckedCreateInput,
  ) {
    return this.evaluationRepository.upsertAttendanceEvaluation(data);
  }

  async createAttendanceEvaluationAudit(
    data: Prisma.AttendanceEvaluationAuditUncheckedCreateInput,
  ) {
    return this.evaluationRepository.createAttendanceEvaluationAudit(data);
  }

  async recordEvaluationChange(data: {
    evaluation: Prisma.AttendanceEvaluationUncheckedCreateInput;
    audit: Omit<
      Prisma.AttendanceEvaluationAuditUncheckedCreateInput,
      "evaluationId"
    >;
  }) {
    return this.evaluationRepository.recordEvaluationChange(data);
  }

  async findManyForAnalytics(params: {
    userId: string;
    startDate: Date;
    endDate: Date;
  }) {
    return this.crudRepository.findManyForAnalytics(params);
  }
}
