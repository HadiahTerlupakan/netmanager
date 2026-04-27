import type { Holiday } from "@prisma/client";

import type { HolidayEntity } from "../domain/entities/HolidayEntity";
import type {
  ActiveLeaveEntity,
  LeaveApproverEntity,
  LeaveRequesterContextEntity,
  TukarLiburDateEntity,
} from "../domain/entities/LeaveEntity";
import type { EmployeeLocationEntity } from "../domain/entities/LocationTrackingEntity";
import type { SettingEntity } from "../domain/entities/SettingEntity";

/** Map Prisma holiday model into pure holiday entity. */
export function toHolidayEntity(
  holiday: Pick<
    Holiday,
    "id" | "tenantId" | "date" | "description" | "isNational"
  >,
): HolidayEntity {
  return {
    id: holiday.id,
    tenantId: holiday.tenantId,
    date: holiday.date,
    description: holiday.description,
    isNational: holiday.isNational,
  };
}

/** Map requester projection into pure leave requester context. */
export function toLeaveRequesterContextEntity(input: {
  workingHourMode: string | null;
  workDays: string | null;
  name: string | null;
  siteId: string | null;
}): LeaveRequesterContextEntity {
  return { ...input };
}

/** Map leave summary projection into pure active leave entity. */
export function toActiveLeaveEntity(input: {
  type: string;
  reason: string;
}): ActiveLeaveEntity {
  return {
    type: input.type as ActiveLeaveEntity["type"],
    reason: input.reason,
  };
}

/** Map tukar-libur projection into pure date entity. */
export function toTukarLiburDateEntity(input: {
  startDate: Date;
  replacementDate: Date | null;
}): TukarLiburDateEntity {
  return { ...input };
}

/** Map approver projection into pure approver entity. */
export function toLeaveApproverEntity(input: {
  id: string;
}): LeaveApproverEntity {
  return { id: input.id };
}

/** Map settings projection into pure setting entity. */
export function toSettingEntity(input: {
  key: string;
  value: string | null;
  tenantId?: string | null;
}): SettingEntity {
  return { ...input };
}

/** Map location projection into pure location entity. */
export function toEmployeeLocationEntity(input: {
  userId: string;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  altitude?: number | null;
  speed?: number | null;
  heading?: number | null;
  batteryLevel?: number | null;
  isMoving: boolean;
  recordedAt: Date;
}): EmployeeLocationEntity {
  return {
    altitude: null,
    speed: null,
    heading: null,
    batteryLevel: null,
    ...input,
  };
}
