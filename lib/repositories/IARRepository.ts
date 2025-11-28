// Accounts Receivable Repository Interface

export interface OutstandingInvoice {
    id: string
    pelangganId: string
    pelangganNama: string
    pelangganEmail: string | null
    pelangganNoTelp: string | null
    noTagihan: string
    periodeBulan: number
    periodeTahun: number
    total: bigint | string
    jatuhTempo: Date
    daysOverdue: number // Calculated field
    agingBucket: 'CURRENT' | 'OVERDUE_30' | 'OVERDUE_60' | 'OVERDUE_90_PLUS'
    paketName: string
    area: string | null
}

export interface AgingReport {
    current: bigint // 0-30 days
    overdue30: bigint // 31-60 days
    overdue60: bigint // 61-90 days
    overdue90: bigint // 90+ days
    totalOutstanding: bigint
    totalCustomers: number
}

export interface AgingBreakdown {
    bucketName: string
    amount: bigint
    count: number
    percentage: number
}

export interface IARRepository {
    // Outstanding Invoices
    findOutstanding(filters?: {
        area?: string
        paketId?: string
        agingBucket?: string
        limit?: number
        offset?: number
    }): Promise<{ data: OutstandingInvoice[]; total: number }>

    // Aging Report
    calculateAgingReport(): Promise<AgingReport>

    // Aging Snapshot (for historical tracking)
    createAgingSnapshot(): Promise<{ id: string }>
    findAgingSnapshots(limit?: number): Promise<any[]>

    // Collection rate calculation
    calculateCollectionRate(month: number, year: number): Promise<{
        totalInvoices: number
        paidOnTime: number
        paidLate: number
        unpaid: number
        collectionRate: number // percentage
        avgDaysToPay: number
    }>
}
