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
                accountName: 'asc'
            }
        })

        return accounts.map(this.toPublic)
    }

    async create(data: BankAccountCreateData): Promise<{ id: string }> {
        const account = await this.prisma.bankAccount.create({
            data: {
                accountName: data.accountName,
                bankName: data.bankName,
                accountNumber: data.accountNumber,
                accountType: data.accountType || 'CHECKING',
                balance: data.balance ? BigInt(data.balance) : BigInt(0),
                currency: data.currency || 'IDR',
                description: data.description || null,
                isActive: data.isActive ?? true
            }
        })

        return { id: account.id }
    }

    async update(id: string, data: BankAccountUpdateData): Promise<void> {
        const updateData: any = {}

        if (data.accountName !== undefined) updateData.accountName = data.accountName
        if (data.bankName !== undefined) updateData.bankName = data.bankName
        if (data.accountNumber !== undefined) updateData.accountNumber = data.accountNumber
        if (data.accountType !== undefined) updateData.accountType = data.accountType
        if (data.balance !== undefined) updateData.balance = BigInt(data.balance)
        if (data.currency !== undefined) updateData.currency = data.currency
        if (data.description !== undefined) updateData.description = data.description
        if (data.isActive !== undefined) updateData.isActive = data.isActive

        await this.prisma.bankAccount.update({
            where: { id },
            data: updateData
        })
    }

    async updateBalance(id: string, newBalance: bigint): Promise<void> {
        await this.prisma.bankAccount.update({
            where: { id },
            data: { balance: newBalance }
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
            accountName: account.accountName,
            bankName: account.bankName,
            accountNumber: account.accountNumber,
            accountType: account.accountType,
            balance: account.balance,
            currency: account.currency,
            description: account.description,
            isActive: account.isActive,
            createdAt: account.createdAt,
            updatedAt: account.updatedAt
        }
    }
}
