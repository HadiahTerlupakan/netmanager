const DEFAULT_STANDARD_WORK_MINUTES = 8 * 60;
const MINUTES_PER_HOUR = 60;

/** Hitung durasi kerja standar per hari berdasarkan konfigurasi user. */
type WorkingTimeConfig = {
  workingHourMode?: "FIXED" | "SHIFT" | "FLEXIBLE" | null;
  flexibleTargetHour?: number | null;
  startWorkTime?: string | null;
  endWorkTime?: string | null;
  shift?: { startTime?: string | null; endTime?: string | null } | null;
};

/**
 * Get standard work minutes per day based on working hour mode configuration.
 * Note: 22 baris - sudah optimal dengan conditional logic untuk different work modes.
 * Memecah lebih lanjut akan memisahkan business rule yang harus kohesif.
 */
export function getStandardMinutesPerDay(config?: WorkingTimeConfig): number {
  if (!config) {
    return DEFAULT_STANDARD_WORK_MINUTES;
  }

  if (config.workingHourMode === "FLEXIBLE") {
    return getFlexibleWorkMinutes(config.flexibleTargetHour);
  }

  if (config.workingHourMode === "SHIFT") {
    return calculateClockRangeMinutes(
      config.shift?.startTime,
      config.shift?.endTime,
    );
  }

  if (config.workingHourMode === "FIXED") {
    return calculateClockRangeMinutes(config.startWorkTime, config.endWorkTime);
  }

  return DEFAULT_STANDARD_WORK_MINUTES;
}

function getFlexibleWorkMinutes(flexibleTargetHour?: number | null) {
  return (flexibleTargetHour || 8) * MINUTES_PER_HOUR;
}

function calculateClockRangeMinutes(
  startTime?: string | null,
  endTime?: string | null,
): number {
  if (!startTime || !endTime) {
    return DEFAULT_STANDARD_WORK_MINUTES;
  }

  const startMinutes = toClockMinutes(startTime);
  const endMinutes = toClockMinutes(endTime);
  if (startMinutes === null || endMinutes === null) {
    return DEFAULT_STANDARD_WORK_MINUTES;
  }

  if (endMinutes >= startMinutes) {
    return endMinutes - startMinutes;
  }

  return 24 * MINUTES_PER_HOUR - startMinutes + endMinutes;
}

function toClockMinutes(clock: string): number | null {
  const [hourRaw, minuteRaw] = clock.split(":").map(Number);
  const hour = hourRaw ?? 0;
  const minute = minuteRaw ?? 0;

  if (Number.isNaN(hour) || Number.isNaN(minute)) {
    return null;
  }

  return hour * MINUTES_PER_HOUR + minute;
}
