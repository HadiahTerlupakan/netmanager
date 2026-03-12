export type RABRevisionVarianceLabel = 'UNTUNG' | 'RUGI' | 'SESUAI'

export interface RABRevisionApprovalUser {
  id: string
  name?: string | null
  email?: string | null
  role?: { name?: string | null } | null
}

export interface RABRevisionApproval {
  id: string
  userId: string
  status: string
  notes?: string | null
  createdAt: string
  user?: RABRevisionApprovalUser | null
}

export interface RABRevisionItem {
  id: string
  rabRevisionId: string
  rabItemId?: string | null
  name: string
  description?: string | null
  quantity: number
  unitPrice: string
  totalPrice: string
  category: string
  expenseType: 'CAPEX' | 'OPEX'
  expenseCategoryId?: string | null
  wbsId?: string | null
  sortOrder: number
}

export interface RABRevisionRecord {
  id: string
  rabProjectId: string
  revisionNumber: number
  status: string
  reason?: string | null
  notes?: string | null
  createdById: string
  submittedById?: string | null
  submittedAt?: string | null
  approvedById?: string | null
  approvedAt?: string | null
  rejectedById?: string | null
  rejectedAt?: string | null
  totalCapex: string
  totalOpex: string
  createdAt: string
  updatedAt: string
  items: RABRevisionItem[]
  approvals: RABRevisionApproval[]
}

export interface RABRevisionVarianceItem {
  rabItemId?: string | null
  revisionItemId: string
  name: string
  finalTotal: string
  actualTotal: string
  variance: string
  varianceLabel: RABRevisionVarianceLabel
}

export interface RABRevisionProfitLossSummary {
  originalSummary: {
    capex: string
    opex: string
    total: string
  }
  finalRevisionSummary: {
    id: string
    capex: string
    opex: string
    total: string
  } | null
  actualSummary: {
    capex: string
    opex: string
    total: string
  }
  varianceSummary: {
    capexVariance: string
    opexVariance: string
    netVariance: string
    capexLabel: RABRevisionVarianceLabel
    opexLabel: RABRevisionVarianceLabel
    netLabel: RABRevisionVarianceLabel
  }
  itemVariances: RABRevisionVarianceItem[]
  unmappedRealization: string
}
