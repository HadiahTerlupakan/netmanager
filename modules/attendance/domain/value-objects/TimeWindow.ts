/**
 * Represents a schedule time window (e.g., 09:00 - 17:00)
 */
export class TimeWindow {
  constructor(
    public readonly startHour: number,
    public readonly startMinute: number,
    public readonly endHour: number,
    public readonly endMinute: number,
  ) {
    if (startHour < 0 || startHour > 23 || endHour < 0 || endHour > 23) {
      throw new Error('Hours must be between 0 and 23')
    }
    if (startMinute < 0 || startMinute > 59 || endMinute < 0 || endMinute > 59) {
      throw new Error('Minutes must be between 0 and 59')
    }
  }

  get startMinutesFromMidnight(): number {
    return this.startHour * 60 + this.startMinute
  }

  get endMinutesFromMidnight(): number {
    return this.endHour * 60 + this.endMinute
  }

  get durationMinutes(): number {
    return this.endMinutesFromMidnight - this.startMinutesFromMidnight
  }

  isTimeWithin(hour: number, minute: number): boolean {
    const minutes = hour * 60 + minute
    return minutes >= this.startMinutesFromMidnight && minutes <= this.endMinutesFromMidnight
  }

  isBeforeStart(hour: number, minute: number): boolean {
    return hour * 60 + minute < this.startMinutesFromMidnight
  }

  isAfterEnd(hour: number, minute: number): boolean {
    return hour * 60 + minute > this.endMinutesFromMidnight
  }

  static fromHHmm(start: string, end: string): TimeWindow {
    const [sh, sm] = start.split(':').map(Number)
    const [eh, em] = end.split(':').map(Number)
    return new TimeWindow(sh, sm, eh, em)
  }
}
