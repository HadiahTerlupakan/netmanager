import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";

export const dynamic = 'force-dynamic';

export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = await verifyAuth(req);
        if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        // Check permissions
        const isSuperAdmin = user.role === 'SUPER_ADMIN' || user.role === 'Super Admin';
        if (!isSuperAdmin && !(await hasPermission("expense:delete"))) {
             return NextResponse.json({ error: "Forbidden: You don't have permission to delete categories" }, { status: 403 });
        }

        const { id } = await params;

        if (!id) {
            return NextResponse.json({ error: "ID required" }, { status: 400 });
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
            return NextResponse.json({ error: "Category not found" }, { status: 404 });
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

        return NextResponse.json({ message: "Category deleted successfully" });
    } catch (error) {
        console.error("[EXPENSE_CATEGORY_DELETE]", error);
        return NextResponse.json({ error: "Internal Error" }, { status: 500 });
    }
}
