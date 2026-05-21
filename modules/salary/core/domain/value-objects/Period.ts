export class Period {
  private constructor(
    public readonly start: Date,
    public readonly end: Date,
  ) {}

  static of(start: Date, end: Date): Period {
    if (start > end) {
      throw new Error("Period start date must be before or equal to end date");
    }
    return new Period(start, end);
  }

  get totalDays(): number {
    const diffMs = this.end.getTime() - this.start.getTime();
    return Math.ceil(diffMs / (1000 * 60 * 60 * 24)) + 1;
  }

  contains(date: Date): boolean {
    return date >= this.start && date <= this.end;
  }

  overlapDays(other: Period): number {
    const overlapStart = new Date(
      Math.max(this.start.getTime(), other.start.getTime()),
    );
    const overlapEnd = new Date(
      Math.min(this.end.getTime(), other.end.getTime()),
    );
    if (overlapStart > overlapEnd) return 0;
    return (
      Math.ceil(
        (overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60 * 60 * 24),
      ) + 1
    );
  }
}
