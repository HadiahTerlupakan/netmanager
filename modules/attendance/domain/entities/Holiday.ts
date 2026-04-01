export interface HolidayProps {
  id: string
  date: Date
  description: string
  isNational: boolean
  tenantId: string | null
  createdAt: Date
  updatedAt: Date
}

export class Holiday {
  private props: HolidayProps

  constructor(props: HolidayProps) {
    this.props = props
  }

  get id(): string { return this.props.id }
  get date(): Date { return this.props.date }
  get description(): string { return this.props.description }
  get isNational(): boolean { return this.props.isNational }
  get tenantId(): string | null { return this.props.tenantId }
  get createdAt(): Date { return this.props.createdAt }
  get updatedAt(): Date { return this.props.updatedAt }

  isSameDate(date: Date): boolean {
    return (
      this.props.date.getFullYear() === date.getFullYear() &&
      this.props.date.getMonth() === date.getMonth() &&
      this.props.date.getDate() === date.getDate()
    )
  }
}
