import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { apiSuccess, ApiErrors, ErrorCodes, apiError } from "@/lib/api-response";
import { hasPermission } from "@/lib/rbac";

export const dynamic = 'force-dynamic';

import { z } from "zod";

const expenseSchema = z.object({
    amount: z.union([z.string(), z.number()]).transform((val) => BigInt(val)),
    date: z.string().or(z.date()).transform((val) => new Date(val)),
    category: z.string().min(1, "Category is required"),
    expenseCategoryId: z.string().optional(),
    description: z.string().optional(),
    siteId: z.string().optional(),
    mixRadiusGroupId: z.string().optional(),
    categoryId: z.string().optional(),
    accountId: z.string().optional(),
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

        // Allow SUPER_ADMIN to bypass permission check
        const userRole = (session.user as { role?: string }).role;
        const isSuperAdmin = userRole === 'SUPER_ADMIN' || userRole === 'Super Admin';

        const hasAccess = isSuperAdmin ||
                         (await hasPermission("expense:update")) ||
                         (await hasPermission("mixradius_expenses:update"));

        if (!hasAccess) {
            return ApiErrors.forbidden('Akses ditolak. Anda memerlukan permission: expense:update ATAU mixradius_expenses:update');
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

        const { amount, date, category, expenseCategoryId, description, siteId, mixRadiusGroupId, categoryId, accountId } = validation.data;

        // Build where clause to prevent IDOR
        const where: Prisma.ExpenseWhereUniqueInput = { id };

        // Only restrict by site if user has expense:site_only permission
        const isSiteRestricted = !isSuperAdmin && (await hasPermission("expense:site_only"));
        if (isSiteRestricted) {
             const userSiteId = (session.user as { siteId?: string }).siteId;
             if (userSiteId) {
                 where.siteId = userSiteId;
             } else {
                 // User restricted but has no site -> cannot edit anything
                 return ApiErrors.forbidden('Akses terbatas: Site tidak ditemukan di profil anda');
             }
        }

        // Additional check: If user passes a NEW siteId, make sure they are allowed to move it there?
        // For now, let's just assume if they have expense:update, they can change the site,
        // BUT if they are site_only, we must override the input siteId to their own siteId
        // to prevent them from moving an expense OUT of their site (or INTO another site).

        const updateData: Prisma.ExpenseUpdateInput = {
            amount,
            date,
            category,
            ...(expenseCategoryId !== undefined ? { expenseCategory: expenseCategoryId ? { connect: { id: expenseCategoryId } } : { disconnect: true } } : {}),
            ...(description !== undefined ? { description } : {}),
            ...(mixRadiusGroupId !== undefined ? { mixRadiusGroup: mixRadiusGroupId ? { connect: { id: mixRadiusGroupId } } : { disconnect: true } } : {}),
            ...(categoryId !== undefined ? { transactionCategory: categoryId ? { connect: { id: categoryId } } : { disconnect: true } } : {}),
            ...(accountId !== undefined ? { financialAccount: accountId ? { connect: { id: accountId } } : { disconnect: true } } : {}),
        };

        if (isSiteRestricted) {
            const userSiteId = (session.user as { siteId?: string }).siteId;
            // Force siteId to be user's siteId
            updateData.site = userSiteId ? { connect: { id: userSiteId } } : undefined;
        } else if (siteId !== undefined) {
            // Admin or user with permission can change siteId freely
            updateData.site = siteId ? { connect: { id: siteId } } : { disconnect: true };
        }

        // First check if expense exists and user has access (implicitly checked by update where clause, but good for explicit error)
        // Actually prisma.update will throw RecordNotFound if where clause fails.

        const expense = await prisma.expense.update({
            where,
            data: updateData,
            include: {
                user: {
                    select: {
                        name: true
                    }
                },
                expenseCategory: {
                    select: {
                        id: true,
                        name: true,
                        type: true
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
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
             return apiError('Pengeluaran tidak ditemukan atau anda tidak memiliki akses', ErrorCodes.NOT_FOUND, { status: 404 });
        }
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

        // Allow SUPER_ADMIN to bypass permission check
        const userRole = (session.user as { role?: string }).role;
        const isSuperAdmin = userRole === 'SUPER_ADMIN' || userRole === 'Super Admin';

        const hasAccess = isSuperAdmin ||
                         (await hasPermission("expense:delete")) ||
                         (await hasPermission("mixradius_expenses:delete"));

        if (!hasAccess) {
            return ApiErrors.forbidden('Akses ditolak. Anda memerlukan permission: expense:delete ATAU mixradius_expenses:delete');
        }

        const { id } = await params;
        if (!id) return apiError('ID tidak ditemukan', ErrorCodes.VALIDATION_ERROR, { status: 400 })

        // Build where clause to prevent IDOR
        const where: Prisma.ExpenseWhereUniqueInput = { id };

        // Only restrict by site if user has expense:site_only permission
        const isSiteRestricted = !isSuperAdmin && (await hasPermission("expense:site_only"));
        if (isSiteRestricted) {
             const userSiteId = (session.user as { siteId?: string }).siteId;
             if (userSiteId) {
                 where.siteId = userSiteId;
             } else {
                 return ApiErrors.forbidden('Akses terbatas: Site tidak ditemukan di profil anda');
             }
        }

        // Check if expense exists first
        const existingExpense = await prisma.expense.findUnique({ where });
        if (!existingExpense) {
            return apiError('Pengeluaran tidak ditemukan atau anda tidak memiliki akses', ErrorCodes.NOT_FOUND, { status: 404 });
        }

        const expense = await prisma.expense.delete({
            where,
        });

        return apiSuccess({
            ...expense,
            amount: expense.amount.toString(),
        }, { message: 'Expense berhasil dihapus' })
    } catch (error) {
        console.error("[EXPENSE_DELETE]", error);
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
             return apiError('Pengeluaran tidak ditemukan atau anda tidak memiliki akses', ErrorCodes.NOT_FOUND, { status: 404 });
        }
        return ApiErrors.internalError('Gagal menghapus expense')
    }
}
