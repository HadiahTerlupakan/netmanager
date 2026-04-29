import { toStartOfDay } from "@/lib/utils/server-datetime";

const WEEKDAY_NAMES = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

/** Ambil key tanggal UTC untuk lock reminder harian. */
export function getDateKey(date: Date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

/** Ambil key tanggal lokal sesuai timezone tenant. */
export function getDateKeyInTimezone(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** Ambil bucket jam lebih untuk reminder flexible. */
export function getFlexibleHourBucket(excessHours: number): number {
  return Math.floor(excessHours);
}

/** Ubah string HH:mm menjadi Date pada tanggal pembanding. */
export function parseTimeToDate(
  timeStr: string,
  date: Date = new Date(),
): Date {
  const parts = timeStr.split(":").map(Number);
  const hours = parts[0] ?? 0;
  const minutes = parts[1] ?? 0;
  const result = new Date(date);
  result.setHours(hours, minutes, 0, 0);
  return result;
}

/** Ubah string HH:mm menjadi Date pada tanggal lokal timezone tenant. */
export function parseTimeToDateInTimezone(
  timeStr: string,
  date: Date,
  timezone: string,
): Date {
  const parts = timeStr.split(":").map(Number);
  const hours = parts[0] ?? 0;
  const minutes = parts[1] ?? 0;
  const startOfLocalDay = toStartOfDay(
    getDateKeyInTimezone(date, timezone),
    timezone,
  );
  return new Date(
    startOfLocalDay.getTime() + hours * 60 * 60 * 1000 + minutes * 60 * 1000,
  );
}

/** Cek apakah waktu saat ini berada dalam jendela reminder. */
export function isInReminderWindow(
  workTime: string,
  reminderMinutes: number = 30,
  currentTime: Date = new Date(),
  windowMinutes: number = 30,
): boolean {
  const workDate = parseTimeToDate(workTime, currentTime);
  const reminderStart = new Date(
    workDate.getTime() + reminderMinutes * 60 * 1000,
  );
  const reminderEnd = new Date(
    reminderStart.getTime() + windowMinutes * 60 * 1000,
  );
  return currentTime >= reminderStart && currentTime <= reminderEnd;
}

/** Ambil nama hari kerja dalam format MON/TUE sesuai timezone opsional. */
export function getDayName(date: Date = new Date(), timezone?: string): string {
  if (timezone) {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      weekday: "short",
    })
      .format(date)
      .slice(0, 3)
      .toUpperCase();
  }
  return WEEKDAY_NAMES[date.getDay()] ?? "SUN";
}

/** Cek apakah tanggal termasuk jadwal kerja user. */
export function isWorkDay(
  workDays: string | null,
  date: Date = new Date(),
  timezone?: string,
): boolean {
  if (!workDays) return true;
  const dayName = getDayName(date, timezone);
  const workDayList = workDays
    .toUpperCase()
    .split(",")
    .map((day) => day.trim());
  return workDayList.includes(dayName);
}
