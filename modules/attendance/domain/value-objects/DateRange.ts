export class DateRange {
  public readonly startDate: Date
  public readonly endDate: Date

  constructor(startDate: Date, endDate: Date) {
    if (startDate > endDate) {
      throw new Error('startDate must be before or equal to endDate')
    }
    this.startDate = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate())
    this.endDate = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate(), 23, 59, 59, 999)
  }

  contains(date: Date): boolean {
    return date >= this.startDate && date <= this.endDate
  }

  daysCount(): number {
    const diffMs = this.endDate.getTime() - this.startDate.getTime()
    return Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1
  }

  *eachDay(): Generator<Date> {
    const current = new Date(this.startDate)
    while (current <= this.endDate) {
      yield new Date(current)
      current.setDate(current.getDate() + 1)
    }
  }

  toString(): string {
    return `${this.startDate.toISOString().split('T')[0]}..${this.endDate.toISOString().split('T')[0]}`
  }

  static fromStrings(start: string, end: string): DateRange {
    return new DateRange(new Date(start), new Date(end))
  }
}
