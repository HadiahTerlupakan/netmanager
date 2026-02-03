import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions, verifyAuth } from "@/lib/auth";
import { randomUUID } from "crypto";
import { hasPermission } from "@/lib/rbac";

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    try {
        const user = await verifyAuth(req);
        if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        // Allow SUPER_ADMIN to bypass permission check
        const isSuperAdmin = user.role === 'SUPER_ADMIN' || user.role === 'Super Admin';

        if (!isSuperAdmin && !(await hasPermission("expense:read"))) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const { searchParams } = new URL(req.url);
        const startDate = searchParams.get("startDate");
        const endDate = searchParams.get("endDate");
        const siteId = searchParams.get("siteId");
        const category = searchParams.get("category");

        console.log("[EXPENSES_GET] Fetching expenses...", { startDate, endDate, siteId, category });

        // Build where clause
        const where: Record<string, unknown> = {};
        if (startDate && endDate) {
            const start = new Date(startDate);
            const end = new Date(endDate);

            if (isNaN(start.getTime()) || isNaN(end.getTime())) {
                return NextResponse.json({ error: "Invalid date format" }, { status: 400 });
            }

            where.date = {
                gte: start,
                lte: end,
            };
        }

        if (category) {
            where.category = category;
        }

        if ((await hasPermission("expense:site_only")) && user.role !== 'SUPER_ADMIN') {
            const userSiteId = (user as { siteId?: string }).siteId;
            if (userSiteId) {
                where.siteId = userSiteId;
            } else {
                 // If user is restricted but has no site, return empty
                 return NextResponse.json([]);
            }
        } else if (siteId) {
             // If not restricted, allow filtering by specific site
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
                }
            }
        });

        console.log(`[EXPENSES_GET] Found ${expenses.length} expenses.`);

        // Convert BigInt to string for JSON serialization
        const serializedExpenses = expenses.map(expense => ({
            ...expense,
            amount: expense.amount.toString(),
        }));

        return NextResponse.json(serializedExpenses);
    } catch (error: unknown) {
        const err = error instanceof Error ? error : new Error('Unknown error')
        console.error("[EXPENSES_GET] Error:", err);
        // Important: Return empty array on error to prevent frontend breakage, OR explicit error structure
        // But since we want to debug, let's return error object with details
        return NextResponse.json({
            error: "Internal Error",
            details: err.message || String(err)
        }, { status: 500 });
    }
}

import { z } from "zod";

const expenseSchema = z.object({
    amount: z.union([z.string(), z.number()]).transform((val) => BigInt(val)),
    date: z.string().or(z.date()).transform((val) => new Date(val)),
    category: z.string().min(1, "Category is required"),
    description: z.string().optional(),
    siteId: z.string().optional(),
    mixRadiusGroupId: z.string().optional(),
});

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !session.user?.email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Allow SUPER_ADMIN to bypass permission check
        const userRole = (session.user as { role?: string }).role;
        const isSuperAdmin = userRole === 'SUPER_ADMIN' || userRole === 'Super Admin';

        if (!isSuperAdmin && !(await hasPermission("expense:create"))) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const body = await req.json();

        const validation = expenseSchema.safeParse(body);
        if (!validation.success) {
            return NextResponse.json({ error: "Invalid input", details: validation.error.format() }, { status: 400 });
        }

        const { amount, date, category, description, siteId, mixRadiusGroupId } = validation.data;

        let finalSiteId = siteId;
        if ((await hasPermission("expense:site_only")) && session.user.role !== 'SUPER_ADMIN') {
             const userSiteId = (session.user as { siteId?: string }).siteId;
             if (!userSiteId) {
                 return NextResponse.json({ error: "User restricted but has no site" }, { status: 403 });
             }
             finalSiteId = userSiteId;
        }


        const expense = await prisma.expense.create({
            data: {
                id: randomUUID(),
                amount,
                date,
                category,
                ...(description !== undefined ? { description } : {}),
                ...(session.user.id ? { userId: session.user.id } : {}),
                updatedAt: new Date(),
                ...(finalSiteId ? { siteId: finalSiteId } : {}),
                ...(mixRadiusGroupId ? { mixRadiusGroupId } : {}),
            },
        });

        return NextResponse.json({
            ...expense,
            amount: expense.amount.toString(),
        });
    } catch (error) {
        console.error("[EXPENSES_POST]", error);
        return NextResponse.json({ error: "Internal Error" }, { status: 500 });
    }
}
