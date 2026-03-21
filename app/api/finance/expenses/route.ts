import { prisma } from "@/lib/prisma";
import { isSuperAdmin } from "@/lib/auth";
import { randomUUID } from "crypto";
import { hasPermission } from "@/lib/rbac";
import { createHandler, apiSuccess, ApiErrors } from "@/lib/api";
import {
    beginExpenseMutation,
    buildExpensePayloadHash,
    completeExpenseMutation,
} from "@/modules/finance/expense-idempotency";
import { z } from "zod";

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
    // ctx.session is guaranteed
    const user = ctx.session!.user;

    // Allow SUPER_ADMIN to bypass permission check
    const isSuper = isSuperAdmin(user);

    // Check for either generic expense permission OR mixradius expense permission
    const hasAccess = isSuper ||
        (await hasPermission("expense:read")) ||
        (await hasPermission("mixradius_expenses:read"));

    if (!hasAccess) {
        return ApiErrors.forbidden("Akses ditolak. Anda memerlukan permission: expense:read ATAU mixradius_expenses:read");
    }

    const { searchParams } = req.nextUrl;
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const siteId = searchParams.get("siteId");
    const mixRadiusGroupId = searchParams.get("mixRadiusGroupId");
    const category = searchParams.get("category");
    const expenseCategoryId = searchParams.get("expenseCategoryId");
    const scope = searchParams.get("scope");

    // console.log("[EXPENSES_GET] Fetching expenses...", { startDate, endDate, siteId, mixRadiusGroupId, category, expenseCategoryId, scope });

    // Build where clause
    const where: Record<string, unknown> = {};
    if (startDate && endDate) {
        const start = startDate.includes('T') ? new Date(startDate) : new Date(`${startDate}T00:00:00`);
        const end = endDate.includes('T') ? new Date(endDate) : new Date(`${endDate}T23:59:59.999`);

        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
            return ApiErrors.badRequest("Format tanggal tidak valid");
        }

        where.date = {
            gte: start,
            lte: end,
        };
    }

    if (category) {
        where.category = category;
    }

    if (expenseCategoryId) {
        where.expenseCategoryId = expenseCategoryId;
    }

    if ((await hasPermission("expense:site_only")) && !isSuper) {
        // Need to fetch full user to get siteId if it's not in session
        // Assuming session.user has siteId (ctx.session structure in handler.ts implies standard fields, let's double check if custom fields like siteId are passed)
        // handler.ts only maps basic fields: id, email, name, role.
        // It does NOT map siteId.
        // So I need to fetch the user or rely on what's in 'user' variable if I cast it?
        // Wait, handler.ts:
        // ctx.session = { user: { id, email, name, role } }
        // It does NOT include siteId.
        // I must fetch the user from DB to get siteId, or update handler.ts.
        // Updating handler.ts affects all files.
        // Safer to fetch user here or check if session from `next-auth` (which I removed) had it.
        // The original code used `verifyAuth` which returns the session user object.
        // `createHandler` uses `getServerSession`.
        // If `getServerSession` returns `siteId`, `createHandler` DROPS it because of explicit mapping.
        // This is a limitation of `createHandler` current implementation.
        // I should probably fix `createHandler` later to include `...session.user` to pass through custom fields.
        // For now, I will use `prisma.user.findUnique` to be safe.

        const dbUser = await prisma.user.findUnique({
            where: { id: user.id },
            select: { siteId: true }
        });

        const userSiteId = dbUser?.siteId;

        if (userSiteId) {
            where.siteId = userSiteId;
        } else {
            // If user is restricted but has no site, return empty
            return apiSuccess([]);
        }
    } else if (scope === 'general') {
        // Explicitly fetch expenses with NO site association (Shared/General)
        where.siteId = null;
        where.mixRadiusGroupId = null;
    } else if (mixRadiusGroupId) {
        // Precise filtering by Group ID if provided
        where.mixRadiusGroupId = mixRadiusGroupId;
    } else if (siteId) {
        // Fallback to physical site ID if no specific group requested
        where.siteId = siteId;
    }

    const expenses = await prisma.expense.findMany({
        where,
        orderBy: {
            date: 'desc',
        },
        include: {
            user: {
                select: {
                    name: true,
                }
            },
            site: {
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
            },
            rabProject: {
                select: {
                    id: true,
                    name: true
                }
            },
            rabItem: {
                select: {
                    id: true,
                    name: true
                }
            }
        }
    });

    // console.log(`[EXPENSES_GET] Found ${expenses.length} expenses.`);

    // Convert BigInt to string for JSON serialization
    const serializedExpenses = expenses.map(expense => ({
        ...expense,
        amount: expense.amount.toString(),
        depreciation: expense.depreciation ? expense.depreciation.toString() : '0',
        usefulLife: expense.usefulLife || 0,
    }));

    return apiSuccess(serializedExpenses);
});

export const POST = createHandler({
    auth: true,
    schema: expenseSchema
}, async (req, ctx) => {
    const user = ctx.session!.user;
    const userId = user.id;

    // Allow SUPER_ADMIN to bypass permission check
    const isSuper = isSuperAdmin(user);

    // Check for either generic expense permission OR mixradius expense permission
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

    // Data is already validated and transformed by Zod via createHandler
    const {
        amount,
        depreciation,
        usefulLife,
        date,
        category,
        expenseCategoryId,
        description,
        siteId,
        mixRadiusGroupId,
        rabProjectId,
        rabItemId,
        invoiceNumber,
        invoiceFile
    } = ctx.validated;

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

    let finalSiteId = siteId;
    if ((await hasPermission("expense:site_only")) && !isSuper) {
        // Fetch user again to get siteId (see GET comment)
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

    const expense = await prisma.expense.create({
        data: {
            id: randomUUID(),
            amount,
            depreciation,
            usefulLife,
            date,
            category,
            ...(expenseCategoryId ? { expenseCategoryId } : {}),
            ...(description !== undefined ? { description } : {}),
            userId,
            updatedAt: new Date(),
            ...(finalSiteId ? { siteId: finalSiteId } : {}),
            ...(mixRadiusGroupId ? { mixRadiusGroupId } : {}),
            ...(rabProjectId ? { rabProjectId } : {}),
            ...(rabItemId ? { rabItemId } : {}),
            ...(invoiceNumber ? { invoiceNumber } : {}),
            ...(invoiceFile ? { invoiceFile } : {}),
            ...(ctx.validated.accountId ? { accountId: ctx.validated.accountId } : {}),
        },
    });

    const response = {
        ...expense,
        amount: expense.amount.toString(),
        depreciation: expense.depreciation ? expense.depreciation.toString() : '0',
        usefulLife: expense.usefulLife || 0,
    };

    completeExpenseMutation({
        action: 'create',
        key: idempotencyKey,
        userId,
        payloadHash,
        response,
    });

    return apiSuccess(response);
});
