import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { randomUUID } from "crypto";

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const startDate = searchParams.get("startDate");
        const endDate = searchParams.get("endDate");

        console.log("[EXPENSES_GET] Fetching expenses...", { startDate, endDate });

        // Build where clause
        const where: any = {};
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

        // @ts-ignore
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
    } catch (error: any) {
        console.error("[EXPENSES_GET] Error:", error);
        // Important: Return empty array on error to prevent frontend breakage, OR explicit error structure
        // But since we want to debug, let's return error object with details
        return NextResponse.json({
            error: "Internal Error",
            details: error?.message || String(error)
        }, { status: 500 });
    }
}

import { z } from "zod";

const expenseSchema = z.object({
    amount: z.union([z.string(), z.number()]).transform((val) => BigInt(val)),
    date: z.string().or(z.date()).transform((val) => new Date(val)),
    category: z.string().min(1, "Category is required"),
    description: z.string().optional(),
});

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !session.user?.email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();

        const validation = expenseSchema.safeParse(body);
        if (!validation.success) {
            return NextResponse.json({ error: "Invalid input", details: validation.error.format() }, { status: 400 });
        }

        const { amount, date, category, description } = validation.data;

        // @ts-ignore
        const expense = await prisma.expense.create({
            data: {
                id: randomUUID(),
                amount,
                date,
                category,
                description,
                userId: session.user.id,
                updatedAt: new Date(),
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
