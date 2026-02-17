import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth, isSuperAdmin } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { getMixRadiusService } from '@/modules/integrations/services/MixRadiusService';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    try {
        const user = await verifyAuth(req);
        if (!user) return NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 });

        const isSuper = isSuperAdmin(user);
        const hasAccess = isSuper ||
                         (await hasPermission("expense:read")) ||
                         (await hasPermission("mixradius_expenses:read")) ||
                         (await hasPermission("mixradius_profit_loss:read"));

        if (!hasAccess) {
            return NextResponse.json({ error: "Akses ditolak. Butuh permission: mixradius_profit_loss:read" }, { status: 403 });
        }

        const { searchParams } = new URL(req.url);
        const startDateParam = searchParams.get("startDate");
        const endDateParam = searchParams.get("endDate");
        const siteId = searchParams.get("siteId");

        // --- Date Logic ---
        let startDate = new Date();
        let endDate = new Date();

        if (startDateParam && endDateParam) {
            startDate = new Date(startDateParam);
            endDate = new Date(endDateParam);
            startDate.setHours(0, 0, 0, 0);
            endDate.setHours(23, 59, 59, 999);
        } else {
            const now = new Date();
            startDate = new Date(now.getFullYear(), now.getMonth(), 1); // Awal bulan
            startDate.setHours(0, 0, 0, 0);
            endDate = new Date();
            endDate.setHours(23, 59, 59, 999);
        }

        // --- FETCH DATA ---
        const service = getMixRadiusService();

        // 1. Ambil Pengeluaran dari Database Lokal
        // 2. Ambil Income Summary (Total Akurat - SUMBER UTAMA KARTU ATAS)
        // 3. Ambil Laporan Array Bulanan (Hanya untuk distribusi bulanan agar TRX akurat)
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
            service.fetchIncomeSummary({ // Sumber Kebenaran Utama (Source of Truth)
                startDate: startDateParam || undefined,
                endDate: endDateParam || undefined,
                siteId: siteId || undefined
            }),
            service.fetchProfitReport(siteId) // Ambil array bulanan (trx, income) yang akurat dari JS var
        ]);

        const incomeArray = profitData.income;
        const transactionArray = profitData.transactions;

        // --- PROCESSING DATA ---

        // USE THE SUMMARY VALUES AS THE SOURCE OF TRUTH (Kartu Atas)
        const parseIdr = (str: string) => {
            if (!str) return 0;
            return parseFloat(str.replace(/\./g, '').replace(',', '.') || '0');
        };

        // Total dari Service (dijamin sama dengan Laporan Pendapatan)
        const totalIncome = parseIdr(incomeSummary.totalPlusPpn);
        // Note: incomeSummary.feeSeller sekarang berisi "Estimated Fee Gateway" karena logic di service sudah kita update
        const totalGatewayFees = parseIdr(incomeSummary.feeSeller);
        const totalTransactions = parseInt(incomeSummary.totalTransactions || '0');
        // Tax is not calculated/subtracted in Net Profit formula per user request

        // Distribusi Bulanan (Monthly Breakdown) - Hanya untuk Chart & Tabel
        // Kita hitung proporsional atau hitung ulang hanya untuk tampilan per bulan
        const monthlyMap = new Map<string, { income: number, expense: number, transactions: number, fees: number, sellerFees: number, tax: number }>();
        const trendMap = new Map<string, { income: number, expense: number }>();

        // Use array for monthly distribution logic...
        const year = startDate.getFullYear(); // Tahun dari filter start date

        // 1. Process Income & Transactions (FROM SCRAPED ARRAYS - GUARANTEED ACCURACY)
        // We calculate MONTHLY breakdown for ALL available months in the report (Jan-Dec)
        // regardless of the specific startDate/endDate filter selected by user.
        // The filter only applies to the Summary Cards at the top.
        incomeArray.forEach((val, index) => {
            const trxCount = transactionArray[index] || 0;

            // Skip if no data
            if (val === 0 && trxCount === 0) return;

            const monthIndex = index;
            const monthNum = monthIndex + 1;
            const monthKey = `${year}-${String(monthNum).padStart(2, '0')}`; // YYYY-MM

            // NOTE: We REMOVED the date filter check here so the Table/Chart shows ALL months
            // const monthStart = new Date(year, monthIndex, 1);
            // const monthEnd = new Date(year, monthIndex + 1, 0, 23, 59, 59);
            // const isOverlap = (startDate <= monthEnd) && (endDate >= monthStart);

            // Calculate ESTIMATED Gateway Fee for this month (Proportional)
            // ... (fee logic skipped per previous request)

            const mData = monthlyMap.get(monthKey) || { income: 0, expense: 0, transactions: 0, fees: 0, sellerFees: 0, tax: 0 };
            mData.income += val;
            mData.transactions += trxCount; // Use the ACCURATE count from var trx
            monthlyMap.set(monthKey, mData);

            const dateKey = `${monthKey}-01`;
            const tData = trendMap.get(dateKey) || { income: 0, expense: 0 };
            tData.income += val;
            trendMap.set(dateKey, tData);
        });

        // 2. Process Expenses (Local DB)
        // For expenses, we also want to show ALL expenses for the year in the chart/table
        // But we need to fetch them first.
        // Currently 'expenses' variable is filtered by startDate/endDate.
        // To show full year expenses in table, we should fetch expenses for the whole year.
        // Let's do a separate query for full year expenses or widen the main query?
        // Widening main query is risky for the summary calculation.
        // Better: Fetch full year expenses separately for the chart.

        // Actually, since we are inside the route, let's fetch full year expenses quickly.
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
            const dateStr = exp.date.toISOString().split('T')[0]; // YYYY-MM-DD
            const monthKey = dateStr.substring(0, 7); // YYYY-MM

            // Add to Monthly Map
            const mData = monthlyMap.get(monthKey) || { income: 0, expense: 0, transactions: 0, fees: 0, sellerFees: 0, tax: 0 };
            mData.expense += Number(exp.amount);
            monthlyMap.set(monthKey, mData);

            // Add to Trend Map
            const trendDateKey = `${monthKey}-01`;
            const tData = trendMap.get(trendDateKey) || { income: 0, expense: 0 };
            tData.expense += Number(exp.amount);
            trendMap.set(trendDateKey, tData);
        });

        // --- FORMAT RESULT ---

        const totalExpenseLocal = expenses.reduce((sum, item) => sum + Number(item.amount), 0);

        // Net Profit Calculation (Global)
        // Formula: Total Income - Gateway Fee (Total from Service) - Local Expenses
        const netProfit = totalIncome - totalGatewayFees - totalExpenseLocal;

        // Sort Trend by Date
        const trend = Array.from(trendMap.entries())
            .map(([date, val]) => ({ date, ...val }))
            .sort((a, b) => a.date.localeCompare(b.date));

        // Sort Monthly Breakdown (Newest First)
        const monthlyBreakdown = Array.from(monthlyMap.entries())
            .map(([month, val]) => ({
                month,
                income: val.income,
                expense: val.expense,
                transactions: val.transactions,
                fees: val.fees, // Gateway Fee per month
                sellerFees: 0,
                tax: 0,
                // Net per month
                net: val.income - val.fees - val.expense
            }))
            .sort((a, b) => b.month.localeCompare(a.month));

        // Top Expenses
        const expenseMap = new Map<string, number>();

        // Add Local Expenses
        expenses.forEach(exp => {
            // Priority: Expense Category Name > Description > Generic Category
            let name = exp.expenseCategory?.name || exp.description || exp.category || 'Uncategorized';
            if ((name === 'OPEX' || name === 'CAPEX') && exp.description) name = exp.description;
            expenseMap.set(name, (expenseMap.get(name) || 0) + Number(exp.amount));
        });

        // Add MixRadius Fees as Expenses if > 0
        // REMOVED per user request: Do not show Gateway Fee in Top 5 Expenses list
        // if (totalGatewayFees > 0) expenseMap.set('Biaya Layanan (Gateway Fee)', totalGatewayFees);

        const topExpenses = Array.from(expenseMap.entries())
            .map(([name, amount]) => ({ name, amount }))
            .sort((a, b) => b.amount - a.amount)
            .slice(0, 5);

        return NextResponse.json({
            summary: {
                totalIncome,
                // Total Expense Display: Local Only (User Request)
                totalExpense: totalExpenseLocal,
                netProfit,
                totalTransactions,
                totalFees: totalGatewayFees,
                totalTax: 0 // Hidden
            },
            trend,
            monthlyBreakdown,
            topExpenses
        });

    } catch (error) {
        console.error("[PROFIT_LOSS_GET]", error);
        return NextResponse.json({ error: "Terjadi kesalahan server" }, { status: 500 });
    }
}
