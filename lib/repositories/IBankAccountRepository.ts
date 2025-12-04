// Bank Account Repository Interface

export interface BankAccountPublic {
    id: string
    namaBank: string
    nomorRekening: string
    namaPemilik: string
    saldoAwal: bigint | string
    saldoSaatIni: bigint | string
    mataUang: string
    isActive: boolean
    createdAt: Date
    updatedAt: Date
    createdBy?: string | null
    updatedBy?: string | null
}

export interface BankAccountCreateData {
    namaBank: string
    nomorRekening: string
    namaPemilik: string
    saldoAwal?: bigint | number | string
    saldoSaatIni?: bigint | number | string
    mataUang?: string
    isActive?: boolean
    createdBy?: string
}

export interface BankAccountUpdateData {
    namaBank?: string
    nomorRekening?: string
    namaPemilik?: string
    saldoAwal?: bigint | number | string
    saldoSaatIni?: bigint | number | string
    mataUang?: string
    isActive?: boolean
    updatedBy?: string
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
