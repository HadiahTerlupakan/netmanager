import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions, verifyAuth, isSuperAdmin } from "@/lib/auth";
import { randomUUID } from "crypto";
import { hasPermission } from "@/lib/rbac";

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    try {
        const user = await verifyAuth(req);
        if (!user) return NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 });

        // Allow SUPER_ADMIN to bypass permission check
        const isSuper = isSuperAdmin(user);

        // Check for either generic expense permission OR mixradius expense permission
        const hasAccess = isSuper ||
                         (await hasPermission("expense:read")) ||
                         (await hasPermission("mixradius_expenses:read"));

        if (!hasAccess) {
            return NextResponse.json({
                success: false,
                error: "Akses ditolak. Anda memerlukan permission: expense:read ATAU mixradius_expenses:read",
                code: "FORBIDDEN"
            }, { status: 403 });
        }

        const { searchParams } = new URL(req.url);
        const startDate = searchParams.get("startDate");
        const endDate = searchParams.get("endDate");
        const siteId = searchParams.get("siteId");
        const mixRadiusGroupId = searchParams.get("mixRadiusGroupId");
        const category = searchParams.get("category");
        const expenseCategoryId = searchParams.get("expenseCategoryId");
        const scope = searchParams.get("scope");

        console.log("[EXPENSES_GET] Fetching expenses...", { startDate, endDate, siteId, mixRadiusGroupId, category, expenseCategoryId, scope });

        // Build where clause
        const where: Record<string, unknown> = {};
        if (startDate && endDate) {
            const start = new Date(startDate);
            const end = new Date(endDate);

            if (isNaN(start.getTime()) || isNaN(end.getTime())) {
                return NextResponse.json({ error: "Format tanggal tidak valid" }, { status: 400 });
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
            const userSiteId = (user as { siteId?: string }).siteId;
            if (userSiteId) {
                where.siteId = userSiteId;
            } else {
                 // If user is restricted but has no site, return empty
                 return NextResponse.json([]);
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
                mixRadiusGroup: {
                    select: {
                        id: true,
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

        console.log(`[EXPENSES_GET] Found ${expenses.length} expenses.`);
        if (expenses.length > 0) {
            console.log("[DEBUG_GET] First expense structure:", JSON.stringify(expenses[0], (key, value) =>
                typeof value === 'bigint' ? value.toString() : value, 2));
        }

        // Convert BigInt to string for JSON serialization
        const serializedExpenses = expenses.map(expense => ({
            ...expense,
            amount: expense.amount.toString(),
            depreciation: expense.depreciation ? expense.depreciation.toString() : '0',
            usefulLife: expense.usefulLife || 0,
        }));

        return NextResponse.json(serializedExpenses);
    } catch (error: unknown) {
        const err = error instanceof Error ? error : new Error('Terjadi kesalahan')
        console.error("[EXPENSES_GET] Prisma Error Details:", JSON.stringify(error, null, 2));
        console.error("[EXPENSES_GET] Error Message:", err.message);
        
        // Check if it's a validation error specifically
        if (err.message.includes("Unknown field")) {
            console.log("[DEBUG] Diagnosis: Prisma Client out of sync with schema.prisma");
        }

        // Important: Return empty array on error to prevent frontend breakage, OR explicit error structure
        // But since we want to debug, let's return error object with details
        return NextResponse.json({
            error: "Terjadi kesalahan server",
            details: process.env.NODE_ENV === 'development' ? (err.message || String(err)) : undefined
        }, { status: 500 });
    }
}

import { z } from "zod";

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
});

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !session.user?.email || !session.user?.id) {
            return NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 });
        }

        const userId = session.user.id;

        // Allow SUPER_ADMIN to bypass permission check
        const isSuper = isSuperAdmin(session.user as { role?: string | null; isSuperAdmin?: boolean });

        // Check for either generic expense permission OR mixradius expense permission
        const hasAccess = isSuper ||
                         (await hasPermission("expense:create")) ||
                         (await hasPermission("mixradius_expenses:create"));

        if (!hasAccess) {
            return NextResponse.json({
                success: false,
                error: "Akses ditolak. Anda memerlukan permission: expense:create ATAU mixradius_expenses:create",
                code: "FORBIDDEN"
            }, { status: 403 });
        }

        const body = await req.json();

        const validation = expenseSchema.safeParse(body);
        if (!validation.success) {
            return NextResponse.json({ error: "Input tidak valid", details: validation.error.format() }, { status: 400 });
        }

        const {
            amount,
            depreciation,
            usefulLife,
            date,
            category,
            expenseCategoryId,
            description,
            siteId,
            mixRadiusGroupId
        } = validation.data;

        let finalSiteId = siteId;
        if ((await hasPermission("expense:site_only")) && !isSuper) {
             const userSiteId = (session.user as { siteId?: string }).siteId;
             if (!userSiteId) {
                 return NextResponse.json({ error: "User terikat site namun belum memiliki site" }, { status: 403 });
             }
             finalSiteId = userSiteId;
        }

        // Simpan record Expense (Stand-alone mode)
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
            },
        });

        return NextResponse.json({
            ...expense,
            amount: expense.amount.toString(),
            depreciation: expense.depreciation ? expense.depreciation.toString() : '0',
            usefulLife: expense.usefulLife || 0,
        });
    } catch (error) {
        console.error("[EXPENSES_POST]", error);
        return NextResponse.json({ error: "Terjadi kesalahan server" }, { status: 500 });
    }
}
