import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

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
            where.date = {
                gte: new Date(startDate),
                lte: new Date(endDate),
            };
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

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const { amount, date, category, description } = body;

        if (!amount || !category) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        const expense = await prisma.expense.create({
            data: {
                amount: BigInt(amount),
                date: new Date(date),
                category,
                description,
                userId: session.user.id,
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
