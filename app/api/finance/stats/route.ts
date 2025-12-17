import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { startOfDay, endOfDay } from "date-fns";

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const startDateParam = searchParams.get("startDate");
        const endDateParam = searchParams.get("endDate");
        const type = searchParams.get("type") || "daily"; // daily, monthly, range

        let startDate = startOfDay(new Date());
        let endDate = endOfDay(new Date());

        if (startDateParam && endDateParam) {
            startDate = startOfDay(new Date(startDateParam));
            endDate = endOfDay(new Date(endDateParam));
        }

        // 1. Fetch Revenue (Payments)
        const payments = await prisma.payment.findMany({
            where: {
                paymentDate: {
                    gte: startDate,
                    lte: endDate,
                }
            }
        });

        // 2. Fetch Expenses
        const expenses = await prisma.expense.findMany({
            where: {
                date: {
                    gte: startDate,
                    lte: endDate,
                }
            }
        });

        // 3. Aggregate Data
        const totalRevenue = payments.reduce((acc, curr) => acc + Number(curr.amount), 0);
        const totalExpenses = expenses.reduce((acc, curr) => acc + Number(curr.amount), 0);
        const netProfit = totalRevenue - totalExpenses;

        // 4. Daily Breakdown (for charts)
        // We can optimize this by grouping if needed, but for now simple iteration is fine for moderate data

        return NextResponse.json({
            totalRevenue,
            totalExpenses,
            netProfit,
            details: {
                paymentCount: payments.length,
                expenseCount: expenses.length
            }
        });

    } catch (error) {
        console.error("[FINANCE_STATS_GET]", error);
        return NextResponse.json({ error: "Internal Error" }, { status: 500 });
    }
}
