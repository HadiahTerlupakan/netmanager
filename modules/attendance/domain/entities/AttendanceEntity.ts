export type AttendanceStatusValue =
  | "ON_TIME"
  | "LATE"
  | "ALPHA"
  | "ABSENT"
  | "DAY_OFF"
  | "PERMIT"
  | "SICK"
  | "NO_CHECKOUT";

export interface ShiftEntity {
  startTime: string | null;
  endTime: string | null;
}

export interface AttendanceUserEntity {
  id: string;
  name: string | null;
  email: string;
  departmentName: string | null;
  joinDate?: Date | null;
  siteId?: string | null;
  departmentId?: string | null;
  sites?: { name: string }[] | null;
  departments?: { name: string }[] | null;
}

export interface AttendanceEntity {
  id: string;
  tenantId: string | null;
  userId: string;
  checkIn: Date | null;
  checkOut: Date | null;
  status: AttendanceStatusValue;
  location: string | null;
  notes: string | null;
  checkInPhoto: string | null;
  checkOutPhoto: string | null;
  geofenceStatus: string | null;
  geofenceDistance: number | null;
  geofenceSiteName: string | null;
  createdAt: Date;
  updatedAt: Date;
  user?: AttendanceUserEntity | null;
}
