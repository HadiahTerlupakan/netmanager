import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { updateCoaSchema } from "@/lib/validations/coa";
import { COASubType } from "@prisma/client";

export async function PUT(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = await verifyAuth(req);
        if (!user) return NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 });

        if (!(await hasPermission("finance:coa:update", user))) {
            return NextResponse.json({ error: "Anda tidak memiliki izin" }, { status: 403 });
        }

        const { id } = await params;
        const body = await req.json();
        const validation = updateCoaSchema.safeParse(body);

        if (!validation.success) {
            return NextResponse.json({ error: validation.error.flatten() }, { status: 400 });
        }

        // Map data to ensure types match Prisma expectations
        const updateData: Record<string, unknown> = { ...validation.data };

        if (updateData.subType) {
            updateData.subType = updateData.subType as COASubType;
        }

        const coa = await prisma.chartOfAccount.update({
            where: { id },
            data: updateData
        });

        // Log activity
        try {
            const { logger } = await import("@/lib/logger");
            await logger.logActivity({
                action: "UPDATE",
                subject: "COA",
                userId: user.id,
                details: { id: coa.id, code: coa.code, name: coa.name, changes: body }
            });
        } catch (e) {
            console.error("Failed to log activity", e);
        }

        return NextResponse.json(coa);
    } catch (error) {
        console.error("[COA_PUT]", error);
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

        if (!(await hasPermission("finance:coa:delete", user))) {
            return NextResponse.json({ error: "Anda tidak memiliki izin" }, { status: 403 });
        }

        const { id } = await params;

        // Check if used in transactions
        const transactionCount = await prisma.transaction.count({
            where: {
                coaId: id
            }
        });

        if (transactionCount > 0) {
            return NextResponse.json({ error: "Akun tidak dapat dihapus karena sudah digunakan dalam transaksi" }, { status: 400 });
        }

        // Soft delete or hard delete? Let's check schema. isActive is present.
        // Usually COA is soft deleted if used, but hard deleted if unused.
        // But here we block delete if used. So hard delete is fine.

        await prisma.chartOfAccount.delete({
            where: { id }
        });

        // Log activity
        try {
            const { logger } = await import("@/lib/logger");
            await logger.logActivity({
                action: "DELETE",
                subject: "COA",
                userId: user.id,
                details: { id }
            });
        } catch (e) {
            console.error("Failed to log activity", e);
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("[COA_DELETE]", error);
        return NextResponse.json({ error: "Terjadi kesalahan server" }, { status: 500 });
    }
}
