// Bank Account Repository Interface

export interface BankAccountPublic {
    id: string
    accountName: string
    bankName: string
    accountNumber: string
    accountType: string // CHECKING, SAVINGS, E_WALLET
    balance: bigint | string
    currency: string
    description: string | null
    isActive: boolean
    createdAt: Date
    updatedAt: Date
}

export interface BankAccountCreateData {
    accountName: string
    bankName: string
    accountNumber: string
    accountType?: string
    balance?: bigint | number | string
    currency?: string
    description?: string
    isActive?: boolean
}

export interface BankAccountUpdateData {
    accountName?: string
    bankName?: string
    accountNumber?: string
    accountType?: string
    balance?: bigint | number | string
    currency?: string
    description?: string
    isActive?: boolean
}

export interface IBankAccountRepository {
    findAll(): Promise<BankAccountPublic[]>
    findById(id: string): Promise<BankAccountPublic | null>
    findActive(): Promise<BankAccountPublic[]>
    create(data: BankAccountCreateData): Promise<{ id: string }>
    update(id: string, data: BankAccountUpdateData): Promise<void>
    updateBalance(id: string, newBalance: bigint): Promise<void>
    delete(id: string): Promise<void>
}
