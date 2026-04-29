const DAY_MAP: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
  Minggu: 0,
  Senin: 1,
  Selasa: 2,
  Rabu: 3,
  Kamis: 4,
  Jumat: 5,
  Sabtu: 6,
  "0": 0,
  "1": 1,
  "2": 2,
  "3": 3,
  "4": 4,
  "5": 5,
  "6": 6,
};

export class AttendanceWorkdayService {
  /** Cek apakah workDays user mencakup tanggal target. */
  isWorkDay(workDays: string | null | undefined, targetDate: Date) {
    if (!workDays) return false;
    const days = workDays
      .split(",")
      .map((day) => this.parseDay(day.trim()))
      .filter((day): day is number => day !== undefined);
    return days.includes(targetDate.getDay());
  }

  private parseDay(value: string) {
    const parsed = parseInt(value);
    if (!Number.isNaN(parsed)) return parsed;
    return DAY_MAP[value];
  }
}
