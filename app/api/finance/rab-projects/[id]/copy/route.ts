import { prisma } from "@/lib/prisma";
import { isSuperAdmin } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { createHandler, apiSuccess, ApiErrors } from "@/lib/api";

export const POST = createHandler({ auth: true }, async (req, ctx) => {
    const user = ctx.session!.user;
    const { id } = ctx.params;

    const isSuper = isSuperAdmin(user);
    const hasAccess = isSuper ||
        (await hasPermission("expense:create")) ||
        (await hasPermission("mixradius_expenses:create"));

    if (!hasAccess) {
        return ApiErrors.forbidden("Akses ditolak. Anda memerlukan permission: expense:create ATAU mixradius_expenses:create");
    }

    interface RabItem {
        id: string;
        name: string;
        description: string | null;
        category: import('@prisma/client').RabItemCategory;
        quantity: number;
        unitPrice: bigint;
        totalPrice: bigint;
        expenseType: import('@prisma/client').RabExpenseType;
    }

    interface RabProjectWithItems {
        id: string;
        name: string;
        description: string | null;
        siteId: string | null;
        mixRadiusGroupId: string | null;
        projectedRevenue: bigint;
        projectedOpex: bigint;
        targetSubscribers: number | null;
        arpu: bigint | null;
        growthType: 'LINEAR' | 'PERCENTAGE' | 'CUSTOM';
        paymentType: 'PREPAID' | 'POSTPAID';
        growthSettings: unknown;
        startDate: Date | null;
        investmentDurationMonths: number;
        investmentRecoveryType: 'PERCENTAGE' | 'FIXED';
        investmentRecoveryValue: number;
        investorProfitSharePercent: number;
        nplTolerancePercent: number;
        items: RabItem[];
        status: 'DRAFT' | 'ACTIVE' | 'PENDING' | 'COMPLETED' | 'CANCELLED';
    }

    // 1. Fetch source project with items
    const sourceProjectRaw = await prisma.rabProject.findUnique({
        where: { id },
        include: { items: true }
    });

    if (!sourceProjectRaw) {
        return ApiErrors.notFound("RAB Proyek tidak ditemukan");
    }

    const sourceProject = sourceProjectRaw as unknown as RabProjectWithItems;

    // 2. Create duplicated project
    const duplicatedProject = await prisma.rabProject.create({
        data: {
            name: `(Copy) ${sourceProject.name}`,
            description: sourceProject.description,
            siteId: sourceProject.siteId,
            mixRadiusGroupId: sourceProject.mixRadiusGroupId,
            projectedRevenue: sourceProject.projectedRevenue,
            projectedOpex: sourceProject.projectedOpex,
            targetSubscribers: sourceProject.targetSubscribers,
            arpu: sourceProject.arpu,
            growthType: sourceProject.growthType,
            paymentType: sourceProject.paymentType,
            // @ts-expect-error - Prisma JSON types require explicit casting or special handling
            growthSettings: sourceProject.growthSettings || undefined,
            startDate: sourceProject.startDate,
            investmentDurationMonths: sourceProject.investmentDurationMonths,
            investmentRecoveryType: sourceProject.investmentRecoveryType,
            investmentRecoveryValue: sourceProject.investmentRecoveryValue,
            investorProfitSharePercent: sourceProject.investorProfitSharePercent,
            nplTolerancePercent: sourceProject.nplTolerancePercent,
            status: 'DRAFT',
            createdBy: user.id,
            items: {
                create: sourceProject.items.map((item: RabItem) => ({
                    name: item.name,
                    description: item.description,
                    quantity: item.quantity,
                    unitPrice: item.unitPrice,
                    totalPrice: item.totalPrice,
                    category: item.category,
                    expenseType: item.expenseType
                }))
            }
        },
        include: {
            items: true
        }
    });

    // 3. Serialize BigInt
    const duplicatedProjectTyped = duplicatedProject as unknown as RabProjectWithItems;
    const serialized = {
        ...duplicatedProjectTyped,
        projectedRevenue: duplicatedProjectTyped.projectedRevenue.toString(),
        projectedOpex: duplicatedProjectTyped.projectedOpex.toString(),
        arpu: duplicatedProjectTyped.arpu?.toString() || null,
        items: duplicatedProjectTyped.items.map((i: RabItem) => ({
            ...i,
            unitPrice: i.unitPrice.toString(),
            totalPrice: i.totalPrice.toString()
        }))
    };

    return apiSuccess(serialized, { status: 201 });
});
