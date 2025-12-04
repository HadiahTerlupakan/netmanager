import { PrismaClient } from '@prisma/client'
import type {
    IBankAccountRepository,
    BankAccountPublic,
    BankAccountCreateData,
    BankAccountUpdateData
} from './IBankAccountRepository'

export class BankAccountRepository implements IBankAccountRepository {
    constructor(private prisma: PrismaClient) { }

    async findAll(): Promise<BankAccountPublic[]> {
        const accounts = await this.prisma.bankAccount.findMany({
            orderBy: {
                createdAt: 'desc'
            }
        })

        return accounts.map(this.toPublic)
    }

    async findById(id: string): Promise<BankAccountPublic | null> {
        const account = await this.prisma.bankAccount.findUnique({
            where: { id }
        })

        return account ? this.toPublic(account) : null
    }

    async findActive(): Promise<BankAccountPublic[]> {
        const accounts = await this.prisma.bankAccount.findMany({
            where: {
                isActive: true
            },
            orderBy: {
                createdAt: 'asc'
            }
        })

        return accounts.map(this.toPublic)
    }

    async create(data: BankAccountCreateData): Promise<{ id: string }> {
        const account = await this.prisma.bankAccount.create({
            data: {
                namaBank: data.namaBank,
                nomorRekening: data.nomorRekening,
                namaPemilik: data.namaPemilik,
                saldoAwal: data.saldoAwal ? BigInt(data.saldoAwal.toString()) : BigInt(0),
                saldoSaatIni: data.saldoSaatIni ? BigInt(data.saldoSaatIni.toString()) : BigInt(0),
                mataUang: data.mataUang || 'IDR',
                isActive: data.isActive ?? true,
                createdBy: data.createdBy
            }
        })

        return { id: account.id }
    }

    async update(id: string, data: BankAccountUpdateData): Promise<void> {
        const updateData: any = {}

        if (data.namaBank !== undefined) updateData.namaBank = data.namaBank
        if (data.nomorRekening !== undefined) updateData.nomorRekening = data.nomorRekening
        if (data.namaPemilik !== undefined) updateData.namaPemilik = data.namaPemilik
        if (data.saldoAwal !== undefined) updateData.saldoAwal = BigInt(data.saldoAwal.toString())
        if (data.saldoSaatIni !== undefined) updateData.saldoSaatIni = BigInt(data.saldoSaatIni.toString())
        if (data.mataUang !== undefined) updateData.mataUang = data.mataUang
        if (data.isActive !== undefined) updateData.isActive = data.isActive
        if (data.updatedBy !== undefined) updateData.updatedBy = data.updatedBy

        await this.prisma.bankAccount.update({
            where: { id },
            data: updateData
        })
    }

    async updateBalance(id: string, newBalance: bigint): Promise<void> {
        await this.prisma.bankAccount.update({
            where: { id },
            data: { saldoSaatIni: newBalance }
        })
    }

    async delete(id: string): Promise<void> {
        await this.prisma.bankAccount.delete({
            where: { id }
        })
    }

    private toPublic(account: any): BankAccountPublic {
        return {
            id: account.id,
            namaBank: account.namaBank,
            nomorRekening: account.nomorRekening,
            namaPemilik: account.namaPemilik,
            saldoAwal: account.saldoAwal,
            saldoSaatIni: account.saldoSaatIni,
            mataUang: account.mataUang,
            isActive: account.isActive,
            createdAt: account.createdAt,
            updatedAt: account.updatedAt,
            createdBy: account.createdBy,
            updatedBy: account.updatedBy
        }
    }
}
