import { prismaBilling } from '@/lib/prisma-billing'
import type { Prisma } from '@prisma/client-billing'

export class PaymentRepository {
    async findManyByDateRange(startDate: Date, endDate: Date) {
        return prismaBilling.payment.findMany({
            where: {
                paymentDate: {
                    gte: startDate,
                    lte: endDate,
                },
            },
        })
    }

    async findMany(where: Prisma.PaymentWhereInput, select?: Prisma.PaymentSelect) {
        return prismaBilling.payment.findMany({
            where,
            ...(select ? { select } : {})
        })
    }

    async count(where: Prisma.PaymentWhereInput) {
        return prismaBilling.payment.count({ where })
    }

    async create(data: Prisma.PaymentUncheckedCreateInput) {
        return prismaBilling.payment.create({ data })
    }

    async updateManyInTransaction(tx: typeof prismaBilling, where: Prisma.PaymentWhereInput, data: Prisma.PaymentUpdateManyArgs['data']) {
        return tx.payment.updateMany({ where, data })
    }
}
