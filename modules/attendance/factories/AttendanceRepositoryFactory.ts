import { AttendanceRepository } from "../repositories/AttendanceRepository";
import { HolidayRepository } from "../repositories/HolidayRepository";
import { LeaveRepository } from "../repositories/LeaveRepository";

/** Buat repository attendance konkret untuk wiring service. */
export function createAttendanceRepository(): AttendanceRepository {
  return new AttendanceRepository();
}

/** Buat repository holiday konkret untuk wiring service. */
export function createHolidayRepository(): HolidayRepository {
  return new HolidayRepository();
}

/** Buat repository leave konkret untuk wiring service. */
export function createLeaveRepository(): LeaveRepository {
  return new LeaveRepository();
}
