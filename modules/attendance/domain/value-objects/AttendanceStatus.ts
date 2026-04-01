// Pure domain enum - mirrors Prisma enum but independent
export enum AttendanceStatusEnum {
  ON_TIME = 'ON_TIME',
  LATE = 'LATE',
  ABSENT = 'ABSENT',
  SICK = 'SICK',
  PERMIT = 'PERMIT',
  DAY_OFF = 'DAY_OFF',
  ALPHA = 'ALPHA',
  NO_CHECKOUT = 'NO_CHECKOUT',
}

export class AttendanceStatus {
  constructor(public readonly value: AttendanceStatusEnum) {}

  static fromString(value: string): AttendanceStatus {
    const status = Object.values(AttendanceStatusEnum).find(v => v === value)
    if (!status) {
      throw new Error(`Invalid attendance status: ${value}`)
    }
    return new AttendanceStatus(status)
  }

  static onTime(): AttendanceStatus { return new AttendanceStatus(AttendanceStatusEnum.ON_TIME) }
  static late(): AttendanceStatus { return new AttendanceStatus(AttendanceStatusEnum.LATE) }
  static absent(): AttendanceStatus { return new AttendanceStatus(AttendanceStatusEnum.ABSENT) }
  static noCheckout(): AttendanceStatus { return new AttendanceStatus(AttendanceStatusEnum.NO_CHECKOUT) }
  static dayOff(): AttendanceStatus { return new AttendanceStatus(AttendanceStatusEnum.DAY_OFF) }

  isPresent(): boolean {
    return this.value === AttendanceStatusEnum.ON_TIME || this.value === AttendanceStatusEnum.LATE
  }

  isAbsent(): boolean {
    return this.value === AttendanceStatusEnum.ABSENT || this.value === AttendanceStatusEnum.ALPHA
  }

  equals(other: AttendanceStatus): boolean {
    return this.value === other.value
  }

  toString(): string {
    return this.value
  }
}
