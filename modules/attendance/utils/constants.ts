/**
 * Attendance System Constants
 * Centralized configuration values for attendance management
 */

export const ATTENDANCE_CONSTANTS = {
  DEFAULT_WORK_HOURS: 9,
  AUTO_CHECKOUT_GRACE_HOURS: 3,
  END_OF_DAY_HOUR: 23,
  END_OF_DAY_MINUTE: 59,
  END_OF_DAY_SECOND: 59,
  END_OF_DAY_MILLISECOND: 999,
  MAX_PHOTO_SIZE: 5 * 1024 * 1024, // 5MB
  PHOTO_UPLOAD_DIR: "public/uploads/attendance",
  GEOFENCE_DEFAULT_RADIUS: 100, // meters
  GEOFENCE_MAX_DISTANCE: 1000, // meters
  AUTO_CHECKOUT_NOTE: "(Auto-Checkout: Lupa Absen Pulang)",

  // Photo validation constants
  ALLOWED_PHOTO_TYPES: [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
  ] as const,
  MAX_PHOTO_DIMENSION: 4096, // 4K max
  MIN_PHOTO_DIMENSION: 200, // minimum 200px
  PHOTO_COMPRESSION_QUALITY: 85, // 85% quality
  PHOTO_MAX_WIDTH: 1920, // Full HD width
  PHOTO_MAX_HEIGHT: 1920, // Full HD height
} as const;

// Type-safe access to constants
export type AttendanceConstants = typeof ATTENDANCE_CONSTANTS;
