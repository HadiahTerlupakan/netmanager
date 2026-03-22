import { prismaBilling } from "@/lib/prisma-billing";
import { apiSuccess, ApiErrors, createHandler } from "@/lib/api";

export const GET = createHandler({ auth: true }, async (req, ctx) => {
    const status = ctx.query.status || 'PENDING';
    const page = parseInt(ctx.query.page as string || '1');
    const limit = parseInt(ctx.query.limit as string || '10');
    const skip = (page - 1) * limit;

    const whereCondition: { status?: 'PENDING' | 'RESOLVED' | 'IGNORED' } = {};

    if (status !== 'ALL') {
        whereCondition.status = status as 'PENDING' | 'RESOLVED' | 'IGNORED';
    }

    const [total, mutations] = await Promise.all([
        prismaBilling.unmatchedMutation.count({ where: whereCondition }),
        prismaBilling.unmatchedMutation.findMany({
            where: whereCondition,
            orderBy: { date: 'desc' },
            skip,
            take: limit,
        })
    ]);

    return apiSuccess(mutations, {
        meta: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit)
        }
    });
});

export const POST = createHandler({ auth: true }, async (req, ctx) => {
    const body = await req.json();
    const { mutationId, invoiceId, action } = body;
    // action can be 'RESOLVE' or 'IGNORE'

    if (!mutationId || !action) {
        return ApiErrors.badRequest("Missing required fields (mutationId, action)");
    }

    const mutation = await prismaBilling.unmatchedMutation.findUnique({
        where: { id: mutationId }
    });

    if (!mutation) {
        return ApiErrors.notFound("Mutation not found");
    }

    if (action === 'IGNORE') {
        const updated = await prismaBilling.unmatchedMutation.update({
            where: { id: mutationId },
            data: {
                status: 'IGNORED',
                resolvedAt: new Date(),
                resolvedById: ctx.session!.user.id
            }
        });
        return apiSuccess({ mutation: updated });
    }

    if (action === 'RESOLVE') {
        if (!invoiceId) {
            return ApiErrors.badRequest("Invoice ID required for resolving");
        }

        // Find invoice
        const invoice = await prismaBilling.invoice.findUnique({
            where: { id: invoiceId }
        });

        if (!invoice) return ApiErrors.notFound("Invoice not found");

        // Create Payment
        const payment = await prismaBilling.payment.create({
            data: {
                id: `PAY-${Date.now()}`,
                amount: BigInt(mutation.amount.toString()),
                paymentDate: mutation.date,
                paymentMethod: 'BANK_TRANSFER',
                notes: `Resolved from unmatched mutation ${mutation.transactionId}`,
                verifiedBy: ctx.session!.user.id || 'SYSTEM',
                verifiedAt: new Date(),
                transactionId: mutation.transactionId || undefined,
                gatewayStatus: 'PAID',
                gatewayProvider: mutation.provider,
                pelangganId: invoice.pelangganId,
                invoice: { connect: { id: invoice.id } },
                unmatchedMutation: { connect: { id: mutation.id } },
                updatedAt: new Date()
            }
        });

        // Update mutation status
        const updated = await prismaBilling.unmatchedMutation.update({
            where: { id: mutationId },
            data: {
                status: 'RESOLVED',
                matchedInvoiceId: invoice.id,
                resolvedAt: new Date(),
                resolvedById: ctx.session!.user.id
            }
        });

        return apiSuccess({ payment, mutation: updated });
    }

    return ApiErrors.badRequest("Invalid action");
});
