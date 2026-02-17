import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { createCoaSchema } from "@/lib/validations/coa";
import { COASubType, Prisma } from "@prisma/client";

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    try {
        const user = await verifyAuth(req);
        if (!user) return NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 });

        const { searchParams } = new URL(req.url);
        const type = searchParams.get("type"); // Optional filter by type (ASSET, EXPENSE, etc)

        const where: Prisma.ChartOfAccountWhereInput = {
            isActive: true
        };

        if (type) {
            where.type = type;
        }

        const coa = await prisma.chartOfAccount.findMany({
            where,
            orderBy: {
                code: 'asc'
            }
        });

        return NextResponse.json(coa);
    } catch (error) {
        console.error("[COA_GET]", error);
        return NextResponse.json({ error: "Terjadi kesalahan server" }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const user = await verifyAuth(req);
        if (!user) return NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 });

        if (!(await hasPermission("finance:coa:create", user))) {
            return NextResponse.json({ error: "Anda tidak memiliki izin" }, { status: 403 });
        }

        const body = await req.json();
        const validation = createCoaSchema.safeParse(body);

        if (!validation.success) {
            return NextResponse.json({ error: validation.error.flatten() }, { status: 400 });
        }

        const { code, name, type, subType, normalBalance, parentId, description, isHeader, allowPosting } = validation.data;

        // Calculate level based on parent
        let level = 1;
        if (parentId) {
            const parent = await prisma.chartOfAccount.findUnique({
                where: { id: parentId },
                select: { level: true }
            });
            if (parent) {
                level = parent.level + 1;
            }
        }

        // Check if code already exists
        const existing = await prisma.chartOfAccount.findUnique({
            where: { code }
        });

        if (existing) {
            return NextResponse.json({ error: "Kode akun sudah digunakan" }, { status: 409 });
        }

        const coa = await prisma.chartOfAccount.create({
            data: {
                code,
                name,
                type,
                subType: subType ? (subType as COASubType) : null,
                normalBalance,
                parentId,
                description,
                isHeader,
                allowPosting,
                level,
                isActive: true
            }
        });

        // Log activity
        try {
            const { logger } = await import("@/lib/logger");
            await logger.logActivity({
                action: "CREATE",
                subject: "COA",
                userId: user.id,
                details: { id: coa.id, code: coa.code, name: coa.name }
            });
        } catch (e) {
            console.error("Failed to log activity", e);
        }

        return NextResponse.json(coa, { status: 201 });
    } catch (error) {
        console.error("[COA_POST]", error);
        return NextResponse.json({ error: "Terjadi kesalahan server" }, { status: 500 });
    }
}
