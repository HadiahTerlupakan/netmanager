import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { apiSuccess, ApiErrors, ErrorCodes, apiError } from "@/lib/api-response";

export const dynamic = 'force-dynamic';

import { z } from "zod";

const expenseSchema = z.object({
    amount: z.union([z.string(), z.number()]).transform((val) => BigInt(val)),
    date: z.string().or(z.date()).transform((val) => new Date(val)),
    category: z.string().min(1, "Category is required"),
    description: z.string().optional(),
});

export async function PUT(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !session.user?.email) {
            return ApiErrors.unauthorized('Session tidak valid')
        }

        const { id } = await params;
        if (!id) return apiError('ID tidak ditemukan', ErrorCodes.VALIDATION_ERROR, { status: 400 })

        const body = await req.json();
        const validation = expenseSchema.safeParse(body);

        if (!validation.success) {
            return apiError('Validasi gagal', ErrorCodes.VALIDATION_ERROR, { 
                status: 400, 
                details: { errors: validation.error.format() } 
            })
        }

        const { amount, date, category, description } = validation.data;


        const expense = await prisma.expense.update({
            where: {
                id: id,
            },
            data: {
                amount,
                date,
                category,
                ...(description !== undefined ? { description } : {}),
            },
            include: {
                user: {
                    select: {
                        name: true
                    }
                }
            }
        });

        return apiSuccess({
            ...expense,
            amount: expense.amount.toString(),
        }, { message: 'Expense berhasil diperbarui' })
    } catch (error) {
        console.error("[EXPENSE_PUT]", error);
        return ApiErrors.internalError('Gagal memperbarui expense')
    }
}

export async function DELETE(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !session.user?.email) {
            return ApiErrors.unauthorized('Session tidak valid')
        }

        const { id } = await params;
        if (!id) return apiError('ID tidak ditemukan', ErrorCodes.VALIDATION_ERROR, { status: 400 })

        // Prisma delete type issue
        const expense = await prisma.expense.delete({
            where: {
                id: id,
            },
        });

        return apiSuccess({
            ...expense,
            amount: expense.amount.toString(),
        }, { message: 'Expense berhasil dihapus' })
    } catch (error) {
        console.error("[EXPENSE_DELETE]", error);
        return ApiErrors.internalError('Gagal menghapus expense')
    }
}
