import { prisma } from '@/lib/prisma'
import type { PrismaClient, Prisma, ExpenseCategory, Expense } from '@prisma/client'

export class FinanceSettingsRepository {
    constructor(private client: PrismaClient = prisma) {}

    async findByKey(key: string): Promise<{ key: string; value: string } | null> {
        return this.client.settings.findFirst({
            where: { key },
            select: { key: true, value: true }
        })
    }

    async findManyByKeys(keys: string[]): Promise<Map<string, string>> {
        const settings = await this.client.settings.findMany({
            where: { key: { in: keys } },
            select: { key: true, value: true }
        })
        return new Map(settings.map(s => [s.key, s.value]))
    }

    async findDepreciationExpenseCategory(tenantId: string): Promise<ExpenseCategory | null> {
        return this.client.expenseCategory.findFirst({
            where: {
                tenantId,
                OR: [
                    { name: { contains: 'penyusutan', mode: 'insensitive' } },
                    { name: { contains: 'depreciation', mode: 'insensitive' } }
                ]
            }
        })
    }

    async createExpense(data: Prisma.ExpenseCreateInput): Promise<Expense> {
        return this.client.expense.create({ data })
    }
}
