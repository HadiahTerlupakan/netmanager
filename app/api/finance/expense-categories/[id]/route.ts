import { prisma } from "@/lib/prisma";
import { isSuperAdmin } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { logger } from "@/lib/logger";
import * as z from "zod";
import { createHandler, apiSuccess, ApiErrors } from "@/lib/api";

export const dynamic = 'force-dynamic';

const updateCategorySchema = z.object({
    name: z.string().min(1, "Nama kategori wajib diisi"),
    type: z.string().refine(val => ['CAPEX', 'OPEX'].includes(val), "Tipe kategori tidak valid"),
    parentId: z.string().optional().nullable(),
});

export const PUT = createHandler({
    auth: true,
    schema: updateCategorySchema
}, async (req, ctx) => {
    const user = ctx.session!.user;
    const { id } = ctx.params;

    const isSuper = isSuperAdmin(user);
    const hasAccess = isSuper ||
                     (await hasPermission("expense:update")) ||
                     (await hasPermission("mixradius_expenses:update"));

    if (!hasAccess) {
         return ApiErrors.forbidden("Akses ditolak.");
    }

    const { name, type, parentId } = ctx.validated;

    // Prevent circular dependency (parent cannot be itself)
    if (parentId === id) {
        return ApiErrors.badRequest("Kategori tidak bisa menjadi induk bagi dirinya sendiri");
    }

    const category = await prisma.expenseCategory.update({
        where: { id },
        data: {
            name,
            type,
            parentId: parentId || null
        }
    });

    await logger.logActivity({
        action: 'UPDATE',
        subject: 'ExpenseCategory',
        details: { id: category.id, name: category.name, type: category.type, parentId },
        userId: user.id
    });

    return apiSuccess(category);
});

export const DELETE = createHandler({ auth: true }, async (req, ctx) => {
    const user = ctx.session!.user;
    const { id } = ctx.params;

    if (!id) return ApiErrors.badRequest("ID kategori wajib diisi");

    // Check permissions
    const isSuper = isSuperAdmin(user);
    const hasAccess = isSuper ||
                     (await hasPermission("expense:delete")) ||
                     (await hasPermission("mixradius_expenses:delete"));

    if (!hasAccess) {
         return ApiErrors.forbidden("Akses ditolak. Anda memerlukan permission: expense:delete ATAU mixradius_expenses:delete");
    }

    // 1. Check if category exists
    const category = await prisma.expenseCategory.findUnique({
        where: { id },
        include: {
            _count: {
                select: { expenses: true }
            }
        }
    });

    if (!category) {
        return ApiErrors.notFound("Kategori pengeluaran");
    }

    // 2. Check if category is in use
    if (category._count.expenses > 0) {
        return ApiErrors.badRequest("Tidak bisa dihapus. Kategori ini sedang digunakan oleh data pengeluaran.");
    }

    // 3. Delete
    await prisma.expenseCategory.delete({
        where: { id }
    });

    await logger.logActivity({
        action: 'DELETE',
        subject: 'ExpenseCategory',
        details: { id },
        userId: user.id
    });

    return apiSuccess({ message: "Kategori pengeluaran berhasil dihapus" });
});
