/**
 * Attendance System Constants
 * Centralized configuration values for attendance management
 */

export const ATTENDANCE_CONSTANTS = {
  DEFAULT_WORK_HOURS: 9,
  END_OF_DAY_HOUR: 23,
  END_OF_DAY_MINUTE: 59,
  END_OF_DAY_SECOND: 59,
  END_OF_DAY_MILLISECOND: 999,
  MAX_PHOTO_SIZE: 5 * 1024 * 1024, // 5MB
  PHOTO_UPLOAD_DIR: 'public/uploads/attendance',
  GEOFENCE_DEFAULT_RADIUS: 100, // meters
  GEOFENCE_MAX_DISTANCE: 1000, // meters
  AUTO_CHECKOUT_NOTE: '(Auto-Checkout: Lupa Absen Pulang)'
} as const

// Type-safe access to constants
export type AttendanceConstants = typeof ATTENDANCE_CONSTANTS
