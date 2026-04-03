import { prisma } from "@/lib/prisma";
import { isSuperAdmin } from "@/lib/auth";
import { randomUUID } from "crypto";
import { hasPermission } from "@/lib/rbac";
import { createHandler, apiSuccess, ApiErrors } from "@/lib/api";
import {
    beginExpenseMutation,
    buildExpensePayloadHash,
    completeExpenseMutation,
} from "@/modules/finance/services/expense-idempotency";
import { z } from "zod";

export const dynamic = 'force-dynamic';

const batchExpenseSchema = z.object({
    // Common fields shared by all items
    date: z.string().or(z.date()).transform((val) => new Date(val)),
    siteId: z.string().optional(),
    mixRadiusGroupId: z.string().optional(),
    invoiceNumber: z.string().optional(),
    invoiceFile: z.string().optional(),
    // Per-item fields
    items: z.array(z.object({
        amount: z.union([z.string(), z.number()]).transform((val) => BigInt(val)),
        category: z.string().min(1, "Kategori wajib diisi"),
        expenseCategoryId: z.string().optional(),
        depreciation: z.union([z.string(), z.number()]).optional().transform((val) => val ? BigInt(val) : BigInt(0)),
        usefulLife: z.union([z.string(), z.number()]).optional().transform((val) => val ? Number(val) : 0),
        description: z.string().optional(),
        rabProjectId: z.string().optional(),
        rabItemId: z.string().optional(),
    })).min(1, "Minimal 1 item diperlukan"),
});

export const POST = createHandler({
    auth: true,
    schema: batchExpenseSchema
}, async (req, ctx) => {
    const user = ctx.session!.user;
    const userId = user.id;

    const isSuper = isSuperAdmin(user);
    const hasAccess = isSuper ||
        (await hasPermission("expense:create")) ||
        (await hasPermission("mixradius_expenses:create"));

    if (!hasAccess) {
        return ApiErrors.forbidden("Akses ditolak. Anda memerlukan permission: expense:create ATAU mixradius_expenses:create");
    }

    const idempotencyKey = req.headers.get('x-idempotency-key')?.trim();
    if (!idempotencyKey) {
        return ApiErrors.badRequest('Header x-idempotency-key wajib diisi');
    }

    const {
        date,
        siteId,
        mixRadiusGroupId,
        invoiceNumber,
        invoiceFile,
        items
    } = ctx.validated;

    const payloadHash = buildExpensePayloadHash(ctx.validated);
    const beginResult = beginExpenseMutation({
        action: 'batch-create',
        key: idempotencyKey,
        userId,
        payloadHash,
    });

    if (beginResult.status === 'replay') {
        return apiSuccess(beginResult.response);
    }

    if (beginResult.status === 'hash-mismatch') {
        return ApiErrors.conflict('Idempotency key sudah dipakai untuk payload berbeda');
    }

    if (beginResult.status === 'in-progress') {
        return ApiErrors.conflict('Permintaan serupa sedang diproses');
    }

    let finalSiteId = siteId;
    if ((await hasPermission("expense:site_only")) && !isSuper) {
        const dbUser = await prisma.user.findUnique({
            where: { id: user.id },
            select: { siteId: true }
        });
        const userSiteId = dbUser?.siteId;

        if (!userSiteId) {
            return ApiErrors.forbidden("User terikat site namun belum memiliki site");
        }
        finalSiteId = userSiteId;
    }

    // Create all expense records in a single transaction
    const expenses = await prisma.$transaction(
        items.map((item) =>
            prisma.expense.create({
                data: {
                    id: randomUUID(),
                    amount: item.amount,
                    depreciation: item.depreciation,
                    usefulLife: item.usefulLife,
                    date,
                    category: item.category,
                    ...(item.expenseCategoryId ? { expenseCategoryId: item.expenseCategoryId } : {}),
                    ...(item.description !== undefined ? { description: item.description } : {}),
                    userId,
                    updatedAt: new Date(),
                    ...(finalSiteId ? { siteId: finalSiteId } : {}),
                    ...(mixRadiusGroupId ? { mixRadiusGroupId } : {}),
                    ...(item.rabProjectId ? { rabProjectId: item.rabProjectId } : {}),
                    ...(item.rabItemId ? { rabItemId: item.rabItemId } : {}),
                    ...(invoiceNumber ? { invoiceNumber } : {}),
                    ...(invoiceFile ? { invoiceFile } : {}),
                },
            })
        )
    );

    const response = expenses.map(expense => ({
            ...expense,
            amount: expense.amount.toString(),
            depreciation: expense.depreciation ? expense.depreciation.toString() : '0',
            usefulLife: expense.usefulLife || 0,
        }));

    completeExpenseMutation({
        action: 'batch-create',
        key: idempotencyKey,
        userId,
        payloadHash,
        response,
    });

    return apiSuccess(response, { message: `${expenses.length} pengeluaran berhasil ditambahkan` });
});
