/**
 * Attendance Domain Errors
 *
 * Custom error classes for attendance validation failures.
 * Provides specific error codes and detailed context for debugging.
 */

export interface AttendanceErrorDetails {
  userId?: string;
  reason?: string;
  checkInTime?: Date;
  windowStart?: Date;
  windowEnd?: Date;
  [key: string]: unknown;
}

export enum AttendanceErrorCode {
  CHECKIN_TIME_WINDOW = "ATT_CHECKIN_TIME_WINDOW",
  CHECKIN_ELIGIBILITY = "ATT_CHECKIN_ELIGIBILITY",
  OUTSIDE_GEOFENCE = "ATT_OUTSIDE_GEOFENCE",
  COORDINATES_REQUIRED = "ATT_COORDINATES_REQUIRED",
  ALREADY_CHECKED_IN = "ATT_ALREADY_CHECKED_IN",
  PHOTO_INVALID = "ATT_PHOTO_INVALID",
}

/**
 * Attendance Validation Error
 *
 * Thrown when attendance operations fail validation.
 * Always includes specific error code and detailed context.
 */
export class AttendanceValidationError extends Error {
  constructor(
    public code: AttendanceErrorCode,
    public override message: string,
    public details?: AttendanceErrorDetails,
  ) {
    super(message);
    this.name = "AttendanceValidationError";
  }

  /** Convert error to structured API response format. */
  toApiResponse() {
    return {
      error: this.code,
      message: this.message,
      details: this.details || {},
    };
  }
}

/** Factory functions for attendance validation errors. */
export const AttendanceErrors = {
  /** Check-in outside allowed time window. */
  checkInTimeWindow(
    reason: string,
    details: {
      userId: string;
      checkInTime: Date;
      windowStart?: Date;
      windowEnd?: Date;
    },
  ): AttendanceValidationError {
    return new AttendanceValidationError(
      AttendanceErrorCode.CHECKIN_TIME_WINDOW,
      reason,
      {
        userId: details.userId,
        checkInTime: details.checkInTime,
        ...(details.windowStart && { windowStart: details.windowStart }),
        ...(details.windowEnd && { windowEnd: details.windowEnd }),
      },
    );
  },

  /** Check-in not eligible (leave, holiday, off-day). */
  checkInEligibility(
    reason: string,
    userId: string,
  ): AttendanceValidationError {
    return new AttendanceValidationError(
      AttendanceErrorCode.CHECKIN_ELIGIBILITY,
      reason,
      { userId },
    );
  },

  /**
   * Foto absensi ditolak validasi. Bertipe khusus supaya route tahu pesan ini
   * memang ditulis untuk pengguna — galat lain (sharp, filesystem, jaringan)
   * membawa detail internal dan tidak boleh ikut dikirim ke klien.
   */
  photoInvalid(reason: string): AttendanceValidationError {
    return new AttendanceValidationError(
      AttendanceErrorCode.PHOTO_INVALID,
      reason,
    );
  },

  /** User outside geofence. */
  outsideGeofence(userId: string): AttendanceValidationError {
    return new AttendanceValidationError(
      AttendanceErrorCode.OUTSIDE_GEOFENCE,
      "Anda berada di luar area absensi yang diizinkan",
      { userId },
    );
  },

  /** GPS coordinates required but not provided. */
  coordinatesRequired(userId: string): AttendanceValidationError {
    return new AttendanceValidationError(
      AttendanceErrorCode.COORDINATES_REQUIRED,
      "Lokasi GPS wajib diaktifkan untuk absensi (kebijakan STRICT). Aktifkan GPS lalu coba lagi.",
      { userId },
    );
  },

  /** User already checked in today. */
  alreadyCheckedIn(userId: string): AttendanceValidationError {
    return new AttendanceValidationError(
      AttendanceErrorCode.ALREADY_CHECKED_IN,
      "Anda sudah melakukan check-in hari ini",
      { userId },
    );
  },
};

/** Pesan bawaan bila alasan sesi tidak aktif tidak diketahui. */
export const DEFAULT_NO_ACTIVE_SESSION_MESSAGE =
  "Anda belum melakukan check-in atau sudah check-out hari ini";

/**
 * Check-out tanpa sesi aktif. `message` tetap "NO_ACTIVE_SESSION" agar
 * pengecekan lama tetap berlaku; `userMessage` menjelaskan alasannya ke
 * karyawan (mis. sesi kemarin sudah ditutup otomatis → silakan check-in).
 */
export class NoActiveSessionError extends Error {
  constructor(public readonly userMessage: string) {
    super("NO_ACTIVE_SESSION");
    this.name = "NoActiveSessionError";
  }
}

/** Pesan untuk karyawan dari galat NO_ACTIVE_SESSION (baru maupun lama). */
export function getNoActiveSessionMessage(error: unknown): string {
  return error instanceof NoActiveSessionError
    ? error.userMessage
    : DEFAULT_NO_ACTIVE_SESSION_MESSAGE;
}
