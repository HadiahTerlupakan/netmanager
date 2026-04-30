import { UserLookupService } from "@/modules/users";
import {
  OvertimePayrollQueryService,
  OvertimeQueryService,
} from "@/modules/overtime";
import { AttendanceRepository } from "../repositories/AttendanceRepository";
import { HolidayRepository } from "../repositories/HolidayRepository";
import { LeaveRepository } from "../repositories/LeaveRepository";
import { AttendanceDailyEvaluator } from "./AttendanceDailyEvaluator";
import { AttendanceEvaluationAuditService } from "./AttendanceEvaluationAuditService";
import { AttendanceEvaluationRecomputeService } from "./AttendanceEvaluationRecomputeService";
import { AttendanceMutationEventService } from "./AttendanceMutationEventService";
import { AttendanceMutationGeofenceService } from "./AttendanceMutationGeofenceService";
import { AttendanceMutationService } from "./AttendanceMutationService";
import { AttendanceReadService } from "./AttendanceReadService";
import { AttendanceReportService } from "./AttendanceReportService";
import { AttendanceSessionGuardService } from "./AttendanceSessionGuardService";
import { AttendanceTimezoneService } from "./AttendanceTimezoneService";
import { AttendanceValidationService } from "./AttendanceValidationService";
import { GeofenceService } from "./GeofenceService";

export function createAttendanceServiceDependencies() {
  const base = createBaseDependencies();
  const recomputeService = createRecomputeService(base);

  return {
    ...base,
    readService: createReadService(base),
    reportService: createReportService(base),
    recomputeService,
    sessionGuardService: new AttendanceSessionGuardService(base.attendanceRepo),
    mutationService: createMutationService({ ...base, recomputeService }),
  };
}

function createBaseDependencies() {
  return {
    geofenceService: new GeofenceService(),
    validationService: new AttendanceValidationService(),
    timezoneService: new AttendanceTimezoneService(),
    attendanceRepo: new AttendanceRepository(),
    userRepo: new UserLookupService(),
    attendanceEvaluator: new AttendanceDailyEvaluator(),
    evaluationAuditService: new AttendanceEvaluationAuditService(),
    leaveRepo: new LeaveRepository(),
    holidayRepo: new HolidayRepository(),
    overtimeRepo: new OvertimeQueryService(),
  };
}

function createReadService(input: {
  attendanceRepo: AttendanceRepository;
  userRepo: UserLookupService;
  timezoneService: AttendanceTimezoneService;
}) {
  return new AttendanceReadService(input);
}

function createReportService(input: {
  attendanceRepo: AttendanceRepository;
  leaveRepo: LeaveRepository;
  userRepo: UserLookupService;
}) {
  return new AttendanceReportService(
    input.attendanceRepo,
    new OvertimePayrollQueryService(),
    input.leaveRepo,
    input.userRepo,
  );
}

function createRecomputeService(input: {
  attendanceRepo: AttendanceRepository;
  attendanceEvaluator: AttendanceDailyEvaluator;
  evaluationAuditService: AttendanceEvaluationAuditService;
  leaveRepo: LeaveRepository;
  holidayRepo: HolidayRepository;
  overtimeRepo: OvertimeQueryService;
}) {
  return new AttendanceEvaluationRecomputeService(
    input.attendanceRepo,
    input.attendanceEvaluator,
    input.evaluationAuditService,
    input.leaveRepo,
    input.holidayRepo,
    input.overtimeRepo,
  );
}

function createMutationService(input: {
  geofenceService: GeofenceService;
  attendanceRepo: AttendanceRepository;
  validationService: AttendanceValidationService;
  timezoneService: AttendanceTimezoneService;
  userRepo: UserLookupService;
  recomputeService: AttendanceEvaluationRecomputeService;
}) {
  return new AttendanceMutationService(
    new AttendanceMutationGeofenceService(input.geofenceService),
    new AttendanceMutationEventService(),
    new AttendanceSessionGuardService(input.attendanceRepo),
    input.validationService,
    input.timezoneService,
    input.attendanceRepo,
    input.userRepo,
    input.recomputeService,
  );
}
