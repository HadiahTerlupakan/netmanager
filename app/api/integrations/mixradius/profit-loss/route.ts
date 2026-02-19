import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isSuperAdmin } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { getMixRadiusService } from '@/modules/integrations/services/MixRadiusService';
import { createHandler, ApiErrors } from "@/lib/api";

export const dynamic = 'force-dynamic';

export const GET = createHandler({ auth: true }, async (req, ctx) => {
    const user = ctx.session!.user;
    const isSuper = isSuperAdmin(user);
    
    // Check permission - need access to expense OR mixradius_profit_loss
    const hasAccess = isSuper ||
                     (await hasPermission("expense:read")) ||
                     (await hasPermission("mixradius_expenses:read")) ||
                     (await hasPermission("mixradius_profit_loss:read"));

    if (!hasAccess) {
        return ApiErrors.forbidden("Akses ditolak. Butuh permission: mixradius_profit_loss:read");
    }

    const { searchParams } = req.nextUrl;
    const startDateParam = searchParams.get("startDate");
    const endDateParam = searchParams.get("endDate");
    const siteId = searchParams.get("siteId");

    let startDate = new Date();
    let endDate = new Date();

    if (startDateParam && endDateParam) {
        startDate = new Date(startDateParam);
        endDate = new Date(endDateParam);
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);
    } else {
        const now = new Date();
        startDate = new Date(now.getFullYear(), now.getMonth(), 1); 
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date();
        endDate.setHours(23, 59, 59, 999);
    }

    const service = getMixRadiusService();

    const [expenses, incomeSummary, profitData] = await Promise.all([
        prisma.expense.findMany({
            where: {
                date: { gte: startDate, lte: endDate },
                ...(siteId ? {
                    OR: [
                        { siteId: siteId },
                        { mixRadiusGroupId: siteId }
                    ]
                } : {})
            },
            select: {
                amount: true,
                date: true,
                category: true,
                description: true,
                expenseCategory: {
                    select: { name: true }
                }
            }
        }),
        service.fetchIncomeSummary({
            startDate: startDateParam || undefined,
            endDate: endDateParam || undefined,
            siteId: siteId || undefined
        }),
        service.fetchProfitReport(siteId)
    ]);

    const incomeArray = profitData.income;
    const transactionArray = profitData.transactions;

    const parseIdr = (str: string) => {
        if (!str) return 0;
        return parseFloat(str.replace(/\./g, '').replace(',', '.') || '0');
    };

    const totalIncome = parseIdr(incomeSummary.totalPlusPpn);
    const totalGatewayFees = parseIdr(incomeSummary.feeSeller);
    const totalTransactions = parseInt(incomeSummary.totalTransactions || '0');

    const monthlyMap = new Map<string, { income: number, expense: number, transactions: number, fees: number, sellerFees: number, tax: number }>();
    const trendMap = new Map<string, { income: number, expense: number }>();

    const year = startDate.getFullYear();

    incomeArray.forEach((val, index) => {
        const trxCount = transactionArray[index] || 0;
        if (val === 0 && trxCount === 0) return;

        const monthIndex = index;
        const monthNum = monthIndex + 1;
        const monthKey = `${year}-${String(monthNum).padStart(2, '0')}`;

        const mData = monthlyMap.get(monthKey) || { income: 0, expense: 0, transactions: 0, fees: 0, sellerFees: 0, tax: 0 };
        mData.income += val;
        mData.transactions += trxCount;
        monthlyMap.set(monthKey, mData);

        const dateKey = `${monthKey}-01`;
        const tData = trendMap.get(dateKey) || { income: 0, expense: 0 };
        tData.income += val;
        trendMap.set(dateKey, tData);
    });

    const startOfYear = new Date(year, 0, 1);
    const endOfYear = new Date(year, 11, 31, 23, 59, 59);

    const fullYearExpenses = await prisma.expense.findMany({
        where: {
            date: { gte: startOfYear, lte: endOfYear },
            ...(siteId ? {
                OR: [
                    { siteId: siteId },
                    { mixRadiusGroupId: siteId }
                ]
            } : {})
        },
        select: { amount: true, date: true }
    });

    fullYearExpenses.forEach(exp => {
        const dateStr = exp.date.toISOString().split('T')[0];
        const monthKey = dateStr.substring(0, 7);

        const mData = monthlyMap.get(monthKey) || { income: 0, expense: 0, transactions: 0, fees: 0, sellerFees: 0, tax: 0 };
        mData.expense += Number(exp.amount);
        monthlyMap.set(monthKey, mData);

        const trendDateKey = `${monthKey}-01`;
        const tData = trendMap.get(trendDateKey) || { income: 0, expense: 0 };
        tData.expense += Number(exp.amount);
        trendMap.set(trendDateKey, tData);
    });

    const totalExpenseLocal = expenses.reduce((sum, item) => sum + Number(item.amount), 0);
    const netProfit = totalIncome - totalGatewayFees - totalExpenseLocal;

    const trend = Array.from(trendMap.entries())
        .map(([date, val]) => ({ date, ...val }))
        .sort((a, b) => a.date.localeCompare(b.date));

    const monthlyBreakdown = Array.from(monthlyMap.entries())
        .map(([month, val]) => ({
            month,
            income: val.income,
            expense: val.expense,
            transactions: val.transactions,
            fees: val.fees,
            sellerFees: 0,
            tax: 0,
            net: val.income - val.fees - val.expense
        }))
        .sort((a, b) => b.month.localeCompare(a.month));

    const expenseMap = new Map<string, number>();

    expenses.forEach(exp => {
        let name = exp.expenseCategory?.name || exp.description || exp.category || 'Uncategorized';
        if ((name === 'OPEX' || name === 'CAPEX') && exp.description) name = exp.description;
        expenseMap.set(name, (expenseMap.get(name) || 0) + Number(exp.amount));
    });

    const topExpenses = Array.from(expenseMap.entries())
        .map(([name, amount]) => ({ name, amount }))
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 5);

    return NextResponse.json({
        summary: {
            totalIncome,
            totalExpense: totalExpenseLocal,
            netProfit,
            totalTransactions,
            totalFees: totalGatewayFees,
            totalTax: 0
        },
        trend,
        monthlyBreakdown,
        topExpenses
    });
})
