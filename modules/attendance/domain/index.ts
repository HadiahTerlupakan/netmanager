// Domain Layer - Public API
// All exports from this file are framework-independent

// Entities
export { Attendance } from './entities/Attendance'
export type { AttendanceProps } from './entities/Attendance'
export { Holiday } from './entities/Holiday'
export type { HolidayProps } from './entities/Holiday'
export { Leave, LeaveTypeEnum, LeaveStatusEnum } from './entities/Leave'
export type { LeaveProps } from './entities/Leave'
export { LeaveBalance } from './entities/LeaveBalance'
export type { LeaveBalanceProps } from './entities/LeaveBalance'

// Value Objects
export { AttendanceStatus, AttendanceStatusEnum } from './value-objects/AttendanceStatus'
export { GeoCoordinate } from './value-objects/GeoCoordinate'
export { CheckInRequest } from './value-objects/CheckInRequest'
export type { CheckInRequestProps } from './value-objects/CheckInRequest'
export { CheckOutRequest } from './value-objects/CheckOutRequest'
export type { CheckOutRequestProps } from './value-objects/CheckOutRequest'
export { DateRange } from './value-objects/DateRange'
export { TimeWindow } from './value-objects/TimeWindow'

// Repository Interfaces
export type { AttendanceRepositoryInterface } from './repositories/AttendanceRepository'
export type { AttendanceFindManyParams, AttendanceStatsResult, DailyStatsResult } from './repositories/AttendanceRepository'
export type { HolidayRepositoryInterface } from './repositories/HolidayRepository'
export type { LeaveRepositoryInterface } from './repositories/LeaveRepository'
export type { LeaveFindManyParams } from './repositories/LeaveRepository'
export type { LeaveBalanceRepositoryInterface } from './repositories/LeaveBalanceRepository'

// Use Cases
export { CheckInUseCase } from './use-cases/CheckInUseCase'
export type { CheckInResult, CheckInError, CheckInUseCaseDependencies } from './use-cases/CheckInUseCase'
export type { GeofenceGateway, TimezoneGateway, UserScheduleGateway, IdempotencyGateway } from './use-cases/CheckInUseCase'
export { CheckOutUseCase } from './use-cases/CheckOutUseCase'
export type { CheckOutResult, CheckOutUseCaseDependencies } from './use-cases/CheckOutUseCase'
export { GetCurrentStatusUseCase } from './use-cases/GetCurrentStatusUseCase'
export type { CurrentStatusResult, AttendanceUiStatus, GetCurrentStatusUseCaseDependencies } from './use-cases/GetCurrentStatusUseCase'
