import { AttendanceRepository } from "../repositories/AttendanceRepository";
import { HolidayRepository } from "../repositories/HolidayRepository";
import { LeaveRepository } from "../repositories/LeaveRepository";
import { UserLookupService } from "@/modules/users";

let attendanceRepository: AttendanceRepository | null = null;
let leaveRepository: LeaveRepository | null = null;
let holidayRepository: HolidayRepository | null = null;
let userLookupService: UserLookupService | null = null;

/** Ambil singleton repository attendance untuk job alert. */
export function getAttendanceRepository() {
  attendanceRepository ??= new AttendanceRepository();
  return attendanceRepository;
}

/** Ambil singleton repository leave untuk job alert. */
export function getLeaveRepository() {
  leaveRepository ??= new LeaveRepository();
  return leaveRepository;
}

/** Ambil singleton repository holiday untuk job alert. */
export function getHolidayRepository() {
  holidayRepository ??= new HolidayRepository();
  return holidayRepository;
}

/** Ambil singleton lookup user untuk job alert. */
export function getUserLookupService() {
  userLookupService ??= new UserLookupService();
  return userLookupService;
}
