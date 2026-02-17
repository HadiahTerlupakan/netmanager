import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth, isSuperAdmin } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { logger } from "@/lib/logger";

import { z } from "zod";

export const dynamic = 'force-dynamic';

const updateCategorySchema = z.object({
    name: z.string().min(1, "Nama kategori wajib diisi"),
    type: z.string().refine(val => ['CAPEX', 'OPEX'].includes(val), "Tipe kategori tidak valid"),
    parentId: z.string().optional().nullable(),
});

export async function PUT(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = await verifyAuth(req);
        if (!user) return NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 });

        const isSuper = isSuperAdmin(user);
        const hasAccess = isSuper ||
                         (await hasPermission("expense:update")) ||
                         (await hasPermission("mixradius_expenses:update"));

        if (!hasAccess) {
             return NextResponse.json({
                 success: false,
                 error: "Akses ditolak.",
                 code: "FORBIDDEN"
             }, { status: 403 });
        }

        const { id } = await params;
        const body = await req.json();
        const validation = updateCategorySchema.safeParse(body);

        if (!validation.success) {
            return NextResponse.json({ error: "Input tidak valid", details: validation.error.format() }, { status: 400 });
        }

        const { name, type, parentId } = validation.data;

        // Prevent circular dependency (parent cannot be itself)
        if (parentId === id) {
            return NextResponse.json({ error: "Kategori tidak bisa menjadi induk bagi dirinya sendiri" }, { status: 400 });
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

        return NextResponse.json(category);
    } catch (error) {
        console.error("[EXPENSE_CATEGORY_PUT]", error);
        return NextResponse.json({ error: "Terjadi kesalahan server" }, { status: 500 });
    }
}

export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = await verifyAuth(req);
        if (!user) return NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 });

        // Check permissions
        const isSuper = isSuperAdmin(user);
        const hasAccess = isSuper ||
                         (await hasPermission("expense:delete")) ||
                         (await hasPermission("mixradius_expenses:delete"));

        if (!hasAccess) {
             return NextResponse.json({
                 success: false,
                 error: "Akses ditolak. Anda memerlukan permission: expense:delete ATAU mixradius_expenses:delete",
                 code: "FORBIDDEN"
             }, { status: 403 });
        }

        const { id } = await params;

        if (!id) {
            return NextResponse.json({ error: "ID kategori wajib diisi" }, { status: 400 });
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
            return NextResponse.json({ error: "Kategori pengeluaran tidak ditemukan" }, { status: 404 });
        }

        // 2. Check if category is in use
        if (category._count.expenses > 0) {
            return NextResponse.json({
                error: "Tidak bisa dihapus. Kategori ini sedang digunakan oleh data pengeluaran."
            }, { status: 400 });
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

        return NextResponse.json({ message: "Kategori pengeluaran berhasil dihapus" });
    } catch (error) {
        console.error("[EXPENSE_CATEGORY_DELETE]", error);
        return NextResponse.json({ error: "Terjadi kesalahan server" }, { status: 500 });
    }
}
