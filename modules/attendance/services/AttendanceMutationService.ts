import { Prisma } from "../repositories/prisma-boundary";
import { AttendanceStatus } from "../types/attendance.enums";
import { randomUUID } from "crypto";
import { UserLookupService } from "@/modules/users";
import { AttendanceRepository } from "../repositories/AttendanceRepository";
import { AttendanceValidationService } from "./AttendanceValidationService";
import { AttendanceTimezoneService } from "./AttendanceTimezoneService";
import {
  buildFixedCheckoutWarning,
  buildFlexibleCheckoutWarning,
  buildShiftCheckoutWarning,
  getCachedUserAttendanceSettings,
  mergeAttendanceNotes,
  resolveCheckInStatus,
  resolveCheckInTimeContext,
} from "./attendance-service-helpers";
import type { AttendanceEvaluationResult } from "../types/AttendanceEvaluation";
import type { CheckInParams } from "./attendance-service.contracts";
import type {
  CheckoutParams,
  CheckoutResult,
  CheckoutSourceAttendance,
  CheckoutWarningAttendance,
  EvaluationAttendance,
  MutationGeofence,
} from "./attendance-mutation.types";
import { AttendanceEvaluationRecomputeService } from "./AttendanceEvaluationRecomputeService";
import { AttendanceMutationGeofenceService } from "./AttendanceMutationGeofenceService";
import { AttendanceMutationEventService } from "./AttendanceMutationEventService";
import { AttendanceSessionGuardService } from "./AttendanceSessionGuardService";

export class AttendanceMutationService {
  constructor(
    private readonly geofenceService: AttendanceMutationGeofenceService,
    private readonly eventService: AttendanceMutationEventService,
    private readonly sessionGuardService: AttendanceSessionGuardService,
    private readonly validationService: AttendanceValidationService,
    private readonly timezoneService: AttendanceTimezoneService,
    private readonly attendanceRepo: AttendanceRepository,
    private readonly userRepo: UserLookupService,
    private readonly recomputeService: AttendanceEvaluationRecomputeService,
  ) {}

  async checkIn(params: CheckInParams) {
    // Validate coordinates if provided
    this.validateCoordinates(params.latitude, params.longitude);

    const context = await this.prepareCheckInContext(params);

    // Auto-checkout stale sessions
    await this.sessionGuardService.processAutoCheckout({
      ...context,
      userId: params.userId,
      tenantId: params.tenantId,
    });

    // Assert no active session conflict (DUPLICATE_ENTRY has priority over window validation)
    await this.sessionGuardService.assertNoActiveSessionConflict({
      ...context,
      userId: params.userId,
      tenantId: params.tenantId,
    });

    // Validate time window AFTER session guard to preserve error priority
    const windowCheck = await this.validationService.validateCheckInTimeWindow(
      params.userId,
      context.checkInTime,
      context.timezone,
    );
    if (!windowCheck.isValid)
      throw new Error(`CHECKIN_REJECTED:${windowCheck.reason}`);

    const geofenceResult = await this.geofenceService.resolveCheckInGeofence(
      params,
      context.userDetails,
    );
    const status = await resolveCheckInStatus({
      checkInTime: context.checkInTime,
      timezone: context.timezone,
      userDetails: context.userDetails,
      timezoneService: this.timezoneService,
    });
    const result = await this.createCheckInAttendance(
      params,
      context,
      geofenceResult,
      status,
    );
    this.eventService.publishCheckInEvent(params, context, result.id);
    return {
      attendance: result,
      evaluation: await this.evaluateCreatedAttendance(result, params, context),
    };
  }

  async checkOut(params: CheckoutParams): Promise<CheckoutResult> {
    const attendance = await this.attendanceRepo.findFirstActiveForCheckout({
      userId: params.userId,
      tenantId: params.tenantId,
    });
    if (!attendance) throw new Error("NO_ACTIVE_SESSION");
    const checkOutTime = params.offlineTime || new Date();
    const geofence = await this.geofenceService.resolveCheckOutGeofence(
      params,
      attendance,
    );
    const updatedAttendance = await this.updateCheckoutAttendance(
      params,
      attendance,
      checkOutTime,
      geofence,
    );
    const evaluation = await this.evaluateCheckoutAttendance(
      params,
      attendance,
      updatedAttendance,
    );
    this.eventService.publishCheckOutEvent(params, attendance, checkOutTime);
    return this.buildCheckoutResult(
      attendance,
      updatedAttendance,
      evaluation,
      checkOutTime,
    );
  }

  private async prepareCheckInContext(params: CheckInParams) {
    const timeContext = await resolveCheckInTimeContext({
      offlineTime: params.offlineTime,
      timezone: params.timezone,
      tenantId: params.tenantId,
      timezoneService: this.timezoneService,
    });

    // Validate eligibility (leave, holiday, off-day)
    const eligibility = await this.validationService.validateCheckInEligibility(
      params.userId,
      timeContext.timezone,
      timeContext.checkInTime,
      params.tenantId,
    );
    if (!eligibility.isValid)
      throw new Error(`CHECKIN_REJECTED:${eligibility.reason}`);

    const userDetails = await getCachedUserAttendanceSettings({
      userId: params.userId,
      userRepo: this.userRepo,
    });

    return { ...timeContext, userDetails };
  }

  private async createCheckInAttendance(
    params: CheckInParams,
    context: { checkInTime: Date; effectiveToday: Date },
    geofence: MutationGeofence,
    status: AttendanceStatus,
  ) {
    const createData = this.buildCheckInCreateData(
      params,
      context,
      geofence,
      status,
    );
    try {
      return await this.attendanceRepo.create(createData);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new Error("DUPLICATE_ENTRY");
      }
      throw error;
    }
  }

  private buildCheckInCreateData(
    params: CheckInParams,
    context: { checkInTime: Date; effectiveToday: Date },
    geofence: MutationGeofence,
    status: AttendanceStatus,
  ): Prisma.AttendanceUncheckedCreateInput {
    const createData: Prisma.AttendanceUncheckedCreateInput = {
      id: randomUUID(),
      userId: params.userId,
      tenantId: params.tenantId,
      checkIn: context.checkInTime,
      checkInDate: context.effectiveToday,
      checkInPhoto: params.photoUrl,
      location: params.location,
      notes: params.notes,
      status,
      geofenceStatus: geofence.status,
      geofenceDistance: geofence.distance,
      geofenceSiteName: geofence.siteName,
      updatedAt: new Date(),
    };
    if (params.offlineTime) {
      createData.geofenceMeta = {
        offline: true,
        capturedAt: params.offlineTime.toISOString(),
      };
    }
    return createData;
  }

  private async evaluateCreatedAttendance(
    attendance: EvaluationAttendance,
    params: CheckInParams,
    context: {
      timezone: string;
      userDetails: { workingHourMode: string | null } | null;
    },
  ) {
    const tenantId = attendance.tenantId ?? params.tenantId;
    if (!tenantId) throw new Error("TENANT_REQUIRED_FOR_EVALUATION");
    return this.recomputeAttendanceEvaluation({
      attendance: {
        tenantId,
        userId: attendance.userId,
        checkIn: attendance.checkIn,
        checkOut: attendance.checkOut,
        status: attendance.status,
      },
      timezone: context.timezone,
      workingHourMode: context.userDetails?.workingHourMode,
      actorId: params.userId,
      audit: { reason: "attendance mutation recompute", actorType: "user" },
    });
  }

  private updateCheckoutAttendance(
    params: Pick<CheckoutParams, "photoUrl" | "location" | "notes">,
    attendance: CheckoutSourceAttendance,
    checkOutTime: Date,
    geofence: MutationGeofence,
  ) {
    return this.attendanceRepo.update(attendance.id, {
      checkOut: checkOutTime,
      checkOutPhoto: params.photoUrl,
      checkOutLocation: params.location ?? null,
      checkOutGeofenceStatus: geofence.status,
      checkOutGeofenceDistance: geofence.distance,
      notes: mergeAttendanceNotes({
        existingNotes: attendance.notes,
        checkoutNotes: params.notes,
      }),
      status: attendance.status,
      updatedAt: new Date(),
    });
  }

  private async evaluateCheckoutAttendance(
    params: Pick<CheckoutParams, "userId" | "tenantId">,
    attendance: { user: { workingHourMode?: string | null } },
    updatedAttendance: EvaluationAttendance,
  ) {
    const tenantId = updatedAttendance.tenantId ?? params.tenantId;
    if (!tenantId) throw new Error("TENANT_REQUIRED_FOR_EVALUATION");
    return this.recomputeAttendanceEvaluation({
      attendance: {
        tenantId,
        userId: updatedAttendance.userId,
        checkIn: updatedAttendance.checkIn,
        checkOut: updatedAttendance.checkOut,
        status: updatedAttendance.status,
      },
      timezone: await this.timezoneService.getTimezone(tenantId),
      workingHourMode: attendance.user.workingHourMode,
      actorId: params.userId,
      audit: { reason: "attendance mutation recompute", actorType: "user" },
    });
  }

  private buildCheckoutResult(
    attendance: CheckoutWarningAttendance,
    updatedAttendance: unknown,
    evaluation: AttendanceEvaluationResult,
    checkOutTime: Date,
  ): CheckoutResult {
    let warning: string | undefined;

    // FLEXIBLE mode warning
    if (attendance.user.workingHourMode === "FLEXIBLE") {
      warning = buildFlexibleCheckoutWarning({
        checkIn: attendance.checkIn,
        checkOutTime,
        targetHours: attendance.user.flexibleTargetHour || 8,
      });
    }

    // FIXED mode warning
    if (attendance.user.workingHourMode === "FIXED") {
      warning = buildFixedCheckoutWarning({
        checkOutTime,
        scheduleEndTime: attendance.user.endWorkTime,
        timezone: attendance.user.timezone || "Asia/Jakarta",
      });
    }

    // SHIFT mode warning
    if (attendance.user.workingHourMode === "SHIFT") {
      warning = buildShiftCheckoutWarning({
        checkOutTime,
        shiftEndTime: attendance.user.shift?.endTime,
        timezone: attendance.user.timezone || "Asia/Jakarta",
      });
    }

    const result: {
      attendance: Prisma.AttendanceGetPayload<{ include: { user: true } }>;
      evaluation: AttendanceEvaluationResult;
      warning?: string;
    } = {
      attendance: updatedAttendance as Prisma.AttendanceGetPayload<{
        include: { user: true };
      }>,
      evaluation,
    };
    if (warning) result.warning = warning;
    return result;
  }

  /** Rekalkulasi evaluasi attendance setelah mutasi. */
  recomputeAttendanceEvaluation(
    params: Parameters<
      AttendanceEvaluationRecomputeService["recomputeAttendanceEvaluation"]
    >[0],
  ) {
    return this.recomputeService.recomputeAttendanceEvaluation(params);
  }

  private validateCoordinates(latitude?: number, longitude?: number): void {
    if (latitude === undefined || longitude === undefined) return;

    if (isNaN(latitude) || isNaN(longitude)) {
      throw new Error("INVALID_COORDINATES");
    }

    if (latitude < -90 || latitude > 90) {
      throw new Error("INVALID_LATITUDE_RANGE");
    }

    if (longitude < -180 || longitude > 180) {
      throw new Error("INVALID_LONGITUDE_RANGE");
    }
  }
}
