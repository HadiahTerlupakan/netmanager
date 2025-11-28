// Bank Statement Repository Interface

export interface BankStatementPublic {
    id: string
    bankAccountId: string
    transactionDate: Date
    description: string
    reference: string | null
    debit: bigint | string // Money out
    credit: bigint | string // Money in
    balance: bigint | string
    isReconciled: boolean
    reconciledAt: Date | null
    createdAt: Date
    updatedAt: Date
}

export interface BankStatementCreateData {
    bankAccountId: string
    transactionDate: Date | string
    description: string
    reference?: string | null
    debit: bigint | number | string
    credit: bigint | number | string
    balance: bigint | number | string
}

export interface IBankStatementRepository {
    findAll(bankAccountId?: string, limit?: number): Promise<BankStatementPublic[]>
    findUnreconciled(bankAccountId?: string): Promise<BankStatementPublic[]>
    createMany(statements: BankStatementCreateData[]): Promise<{ count: number }>
    markReconciled(id: string): Promise<void>
}
