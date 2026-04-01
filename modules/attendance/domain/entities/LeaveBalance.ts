import { LeaveTypeEnum } from './Leave'

export interface LeaveBalanceProps {
  id: string
  userId: string
  year: number
  leaveType: LeaveTypeEnum
  quota: number
  used: number
  tenantId: string | null
  createdAt: Date
  updatedAt: Date
}

export class LeaveBalance {
  private props: LeaveBalanceProps

  constructor(props: LeaveBalanceProps) {
    this.props = props
  }

  get id(): string { return this.props.id }
  get userId(): string { return this.props.userId }
  get year(): number { return this.props.year }
  get leaveType(): LeaveTypeEnum { return this.props.leaveType }
  get quota(): number { return this.props.quota }
  get used(): number { return this.props.used }
  get tenantId(): string | null { return this.props.tenantId }
  get createdAt(): Date { return this.props.createdAt }
  get updatedAt(): Date { return this.props.updatedAt }

  get remaining(): number {
    return Math.max(0, this.props.quota - this.props.used)
  }

  hasEnough(required: number): boolean {
    return this.remaining >= required
  }

  canIncrement(days: number): boolean {
    return this.props.used + days <= this.props.quota
  }
}
