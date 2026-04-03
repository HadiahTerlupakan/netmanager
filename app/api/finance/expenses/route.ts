import { FinanceService } from "@/modules/finance/services/FinanceService";
import { isSuperAdmin } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { createHandler, apiSuccess, ApiErrors } from "@/lib/api";
import { logAuditActivity } from "@/lib/middleware/request-logger";
import {
    beginExpenseMutation,
    buildExpensePayloadHash,
    completeExpenseMutation,
} from "@/modules/finance/services/expense-idempotency";
import { z } from "zod";
import { getUserService } from "@/modules/users/services/UserService";

export const dynamic = 'force-dynamic';

const expenseSchema = z.object({
    amount: z.union([z.string(), z.number()]).transform((val) => BigInt(val)),
    depreciation: z.union([z.string(), z.number()]).optional().transform((val) => val ? BigInt(val) : BigInt(0)),
    usefulLife: z.union([z.string(), z.number()]).optional().transform((val) => val ? Number(val) : 0),
    date: z.string().or(z.date()).transform((val) => new Date(val)),
    category: z.string().min(1, "Kategori wajib diisi"),
    expenseCategoryId: z.string().optional(),
    description: z.string().optional(),
    siteId: z.string().optional(),
    mixRadiusGroupId: z.string().optional(),
    rabProjectId: z.string().optional(),
    rabItemId: z.string().optional(),
    invoiceNumber: z.string().optional(),
    invoiceFile: z.string().optional(),
    accountId: z.string().optional(),
});

export const GET = createHandler({ auth: true }, async (req, ctx) => {
    const user = ctx.session!.user;
    const isSuper = isSuperAdmin(user);

    const hasAccess = isSuper ||
        (await hasPermission("expense:read")) ||
        (await hasPermission("mixradius_expenses:read"));

    if (!hasAccess) {
        return ApiErrors.forbidden("Akses ditolak. Anda memerlukan permission: expense:read ATAU mixradius_expenses:read");
    }

    const { searchParams } = req.nextUrl;
    const startDateParam = searchParams.get("startDate");
    const endDateParam = searchParams.get("endDate");
    const siteId = searchParams.get("siteId");
    const mixRadiusGroupId = searchParams.get("mixRadiusGroupId");
    const category = searchParams.get("category");
    const expenseCategoryId = searchParams.get("expenseCategoryId");
    const scope = searchParams.get("scope");

    let startDate: Date | undefined;
    let endDate: Date | undefined;

    if (startDateParam && endDateParam) {
        startDate = startDateParam.includes('T') ? new Date(startDateParam) : new Date(`${startDateParam}T00:00:00`);
        endDate = endDateParam.includes('T') ? new Date(endDateParam) : new Date(`${endDateParam}T23:59:59.999`);

        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
            return ApiErrors.badRequest("Format tanggal tidak valid");
        }
    }

    let restrictedSiteId: string | undefined;
    if ((await hasPermission("expense:site_only")) && !isSuper) {
        const userService = getUserService();
        const dbUser = await userService.getUser(user.id);
        restrictedSiteId = dbUser?.siteId || undefined;
        if (!restrictedSiteId) return apiSuccess([]);
    }

    const financeService = new FinanceService();
    const expenses = await financeService.getExpenses({
        startDate,
        endDate,
        siteId,
        mixRadiusGroupId,
        category,
        expenseCategoryId,
        scope,
        restrictedSiteId
    });

    return apiSuccess(expenses);
});

export const POST = createHandler({
    auth: true,
    schema: expenseSchema
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

    const payloadHash = buildExpensePayloadHash(ctx.validated);
    const beginResult = beginExpenseMutation({
        action: 'create',
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
let finalSiteId = ctx.validated.siteId;
if ((await hasPermission("expense:site_only")) && !isSuper) {
    const userService = getUserService();
    const dbUser = await userService.getUser(user.id);
    const userSiteId = dbUser?.siteId;

    if (!userSiteId) {
        return ApiErrors.forbidden("User terikat site namun belum memiliki site");
    }
    finalSiteId = userSiteId;
}


    const financeService = new FinanceService();
    const response = await financeService.createExpense({
        ...ctx.validated,
        siteId: finalSiteId
    } as Parameters<typeof financeService.createExpense>[0], userId);

    completeExpenseMutation({
        action: 'create',
        key: idempotencyKey,
        userId,
        payloadHash,
        response,
    });

    await logAuditActivity(req, { status: 201 } as unknown as import('next/server').NextResponse, userId, user.tenantId, ctx.validated);

    return apiSuccess(response, { status: 201 });
});
