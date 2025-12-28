import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions, verifyAuth } from "@/lib/auth";
import { startOfDay, endOfDay } from "date-fns";
import { hasPermission } from "@/lib/rbac";

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    try {
        const user = await verifyAuth(req as any);
        if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        if (!(await hasPermission("finance:read"))) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const { searchParams } = new URL(req.url);
        const startDateParam = searchParams.get("startDate");
        const endDateParam = searchParams.get("endDate");
        const type = searchParams.get("type") || "daily"; // daily, monthly, range

        let startDate = startOfDay(new Date());
        let endDate = endOfDay(new Date());

        if (startDateParam && endDateParam) {
            const start = new Date(startDateParam);
            const end = new Date(endDateParam);

            if (isNaN(start.getTime()) || isNaN(end.getTime())) {
                return NextResponse.json({ error: "Invalid date format" }, { status: 400 });
            }

            startDate = startOfDay(start);
            endDate = endOfDay(end);
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
        // @ts-ignore
        const expenses = await prisma.expense.findMany({
            where: {
                date: {
                    gte: startDate,
                    lte: endDate,
                }
            }
        });

        // 3. Aggregate Data
        const totalRevenue = payments.reduce((acc: number, curr: any) => acc + Number(curr.amount), 0);
        // @ts-ignore
        const totalExpenses = expenses.reduce((acc: number, curr: any) => acc + Number(curr.amount), 0);
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
            },
            history: getMonthlyBreakdown(payments, expenses, startDate, endDate)
        });

    } catch (error) {
        console.error("[FINANCE_STATS_GET]", error);
        return NextResponse.json({ error: "Internal Error" }, { status: 500 });
    }
}

function getMonthlyBreakdown(payments: any[], expenses: any[], startDate: Date, endDate: Date) {
    const months = [];
    const currentDate = new Date(startDate);

    while (currentDate <= endDate) {
        const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
        const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

        // Filter for this month
        const monthPayments = payments.filter(p => {
            const d = new Date(p.paymentDate);
            return d >= monthStart && d <= monthEnd;
        });

        const monthExpenses = expenses.filter(e => {
            const d = new Date(e.date);
            return d >= monthStart && d <= monthEnd;
        });

        const revenue = monthPayments.reduce((acc, curr) => acc + Number(curr.amount), 0);
        const expense = monthExpenses.reduce((acc, curr) => acc + Number(curr.amount), 0);

        months.push({
            period: monthStart.toISOString(), // Frontend can format this
            transactionCount: monthPayments.length + monthExpenses.length,
            revenue,
            expenses: expense,
            netProfit: revenue - expense,
            // Placeholder for PPN if we want to add it later
            tax: 0
        });

        // Move to next month
        currentDate.setMonth(currentDate.getMonth() + 1);
    }

    return months;
}
