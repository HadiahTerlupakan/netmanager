export interface OvertimeUser {
  name: string | null;
  email: string;
  image?: string | null;
  workDays?: string | null;
  workingHourMode?: string | null;
  sites?: { name: string } | null;
  departments?: { name: string } | null;
}

export interface Overtime {
  id: string;
  createdAt: string;
  duration: number | null;
  reason: string;
  status: "PENDING" | "APPROVED" | "IN_PROGRESS" | "COMPLETED" | "REJECTED";
  rejectionReason?: string;
  startTime?: string;
  endTime?: string;
  startPhoto?: string;
  endPhoto?: string;
  startLocation?: string;
  endLocation?: string;
  isHolidayOvertime?: boolean;
  isNationalHoliday?: boolean;
  isOffDay?: boolean;
  holidayDescription?: string;
  user: OvertimeUser | null;
}
