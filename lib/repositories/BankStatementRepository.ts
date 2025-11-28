import { PrismaClient } from '@prisma/client'
import type {
    IBankStatementRepository,
    BankStatementPublic,
    BankStatementCreateData
} from './IBankStatementRepository'

export class BankStatementRepository implements IBankStatementRepository {
    constructor(private prisma: PrismaClient) { }

    async findAll(bankAccountId?: string, limit = 100): Promise<BankStatementPublic[]> {
        const statements = await this.prisma.bankStatement.findMany({
            where: bankAccountId ? { bankAccountId } : undefined,
            orderBy: {
                transactionDate: 'desc'
            },
            take: limit
        })

        return statements.map(this.toPublic)
    }

    async findUnreconciled(bankAccountId?: string): Promise<BankStatementPublic[]> {
        const statements = await this.prisma.bankStatement.findMany({
            where: {
                bankAccountId: bankAccountId || undefined,
                isReconciled: false
            },
            orderBy: {
                transactionDate: 'desc'
            }
        })

        return statements.map(this.toPublic)
    }

    async createMany(statements: BankStatementCreateData[]): Promise<{ count: number }> {
        const result = await this.prisma.bankStatement.createMany({
            data: statements.map((stmt) => ({
                bankAccountId: stmt.bankAccountId,
                transactionDate: new Date(stmt.transactionDate),
                description: stmt.description,
                reference: stmt.reference || null,
                debit: BigInt(stmt.debit),
                credit: BigInt(stmt.credit),
                balance: BigInt(stmt.balance),
                isReconciled: false
            })),
            skipDuplicates: true // Avoid duplicate imports
        })

        return { count: result.count }
    }

    async markReconciled(id: string): Promise<void> {
        await this.prisma.bankStatement.update({
            where: { id },
            data: {
                isReconciled: true,
                reconciledAt: new Date()
            }
        })
    }

    private toPublic(statement: any): BankStatementPublic {
        return {
            id: statement.id,
            bankAccountId: statement.bankAccountId,
            transactionDate: statement.transactionDate,
            description: statement.description,
            reference: statement.reference,
            debit: statement.debit,
            credit: statement.credit,
            balance: statement.balance,
            isReconciled: statement.isReconciled,
            reconciledAt: statement.reconciledAt,
            createdAt: statement.createdAt,
            updatedAt: statement.updatedAt
        }
    }
}
