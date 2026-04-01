export enum LeaveTypeEnum {
  SAKIT = 'SAKIT',
  CUTI = 'CUTI',
  IZIN = 'IZIN',
  LAINNYA = 'LAINNYA',
  TUKAR_LIBUR = 'TUKAR_LIBUR',
}

export enum LeaveStatusEnum {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export interface LeaveProps {
  id: string
  userId: string
  type: LeaveTypeEnum
  startDate: Date
  endDate: Date
  reason: string
  attachmentUrl: string | null
  attachments: string[]
  status: LeaveStatusEnum
  approvedBy: string | null
  rejectionReason: string | null
  replacementDate: Date | null
  tenantId: string | null
  createdAt: Date
  updatedAt: Date
}

export class Leave {
  private props: LeaveProps

  constructor(props: LeaveProps) {
    this.props = props
  }

  get id(): string { return this.props.id }
  get userId(): string { return this.props.userId }
  get type(): LeaveTypeEnum { return this.props.type }
  get startDate(): Date { return this.props.startDate }
  get endDate(): Date { return this.props.endDate }
  get reason(): string { return this.props.reason }
  get attachmentUrl(): string | null { return this.props.attachmentUrl }
  get attachments(): string[] { return this.props.attachments }
  get status(): LeaveStatusEnum { return this.props.status }
  get approvedBy(): string | null { return this.props.approvedBy }
  get rejectionReason(): string | null { return this.props.rejectionReason }
  get replacementDate(): Date | null { return this.props.replacementDate }
  get tenantId(): string | null { return this.props.tenantId }
  get createdAt(): Date { return this.props.createdAt }
  get updatedAt(): Date { return this.props.updatedAt }

  isApproved(): boolean {
    return this.props.status === LeaveStatusEnum.APPROVED
  }

  isPending(): boolean {
    return this.props.status === LeaveStatusEnum.PENDING
  }

  coversDate(date: Date): boolean {
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate())
    const start = new Date(this.props.startDate.getFullYear(), this.props.startDate.getMonth(), this.props.startDate.getDate())
    const end = new Date(this.props.endDate.getFullYear(), this.props.endDate.getMonth(), this.props.endDate.getDate())
    return d >= start && d <= end
  }

  getDaysCount(): number {
    const diffMs = this.props.endDate.getTime() - this.props.startDate.getTime()
    return Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1
  }
}
