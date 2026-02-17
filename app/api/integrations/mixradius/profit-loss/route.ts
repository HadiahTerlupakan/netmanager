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
                         (await hasPermission("mixradius_expenses:read"));

        if (!hasAccess) {
            return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
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
        // 2. Ambil Laporan Laba Rugi (Array 12 Bulan) dari MixRadius Scraper
        const [expenses, incomeArray] = await Promise.all([
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
                select: { amount: true, date: true, category: true }
            }),
            service.fetchProfitReport(siteId) // MENGAMBIL DATA DARI METODE SCRAPING BARU
        ]);

        // --- PROCESSING DATA ---

        const monthlyMap = new Map<string, { income: number, expense: number }>();
        const trendMap = new Map<string, { income: number, expense: number }>();
        let totalIncome = 0;

        const year = startDate.getFullYear(); // Tahun dari filter start date

        // 1. Process Income (MixRadius Array [Jan, Feb, ...])
        // Array index 0 = Januari, 1 = Februari, dst.
        incomeArray.forEach((val, index) => {
            // val adalah income untuk bulan tersebut (misal Jan: 302jt)
            if (val === 0) return;

            const monthIndex = index;
            const monthNum = monthIndex + 1;
            const monthKey = `${year}-${String(monthNum).padStart(2, '0')}`; // YYYY-MM

            // Cek apakah bulan ini masuk dalam range yang dipilih user
            // Kita buat tanggal representatif: Tgl 1 bulan tersebut
            const monthStart = new Date(year, monthIndex, 1);
            const monthEnd = new Date(year, monthIndex + 1, 0, 23, 59, 59); // Akhir bulan

            // Logika overlap: Jika periode filter beririsan dengan bulan ini
            const isOverlap = (startDate <= monthEnd) && (endDate >= monthStart);

            if (isOverlap) {
                totalIncome += val;

                // Update Monthly Breakdown
                const mData = monthlyMap.get(monthKey) || { income: 0, expense: 0 };
                mData.income += val;
                monthlyMap.set(monthKey, mData);

                // Update Trend (Kita plot di tanggal 1 setiap bulan agar grafik rapi bulanan)
                const dateKey = `${monthKey}-01`;
                const tData = trendMap.get(dateKey) || { income: 0, expense: 0 };
                tData.income += val;
                trendMap.set(dateKey, tData);
            }
        });

        // 2. Process Expenses (Local DB)
        expenses.forEach(exp => {
            const dateStr = exp.date.toISOString().split('T')[0]; // YYYY-MM-DD
            const monthKey = dateStr.substring(0, 7); // YYYY-MM

            // Add to Monthly Map
            const mData = monthlyMap.get(monthKey) || { income: 0, expense: 0 };
            mData.expense += Number(exp.amount);
            monthlyMap.set(monthKey, mData);

            // Add to Trend Map
            // PENTING: Untuk grafik trend, agar sebanding dengan income yang bulanan,
            // kita masukkan expense ke tanggal 1 bulan tersebut juga.
            const trendDateKey = `${monthKey}-01`;
            const tData = trendMap.get(trendDateKey) || { income: 0, expense: 0 };
            tData.expense += Number(exp.amount);
            trendMap.set(trendDateKey, tData);
        });

        // --- FORMAT RESULT ---

        const totalExpense = expenses.reduce((sum, item) => sum + Number(item.amount), 0);
        const netProfit = totalIncome - totalExpense;

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
                net: val.income - val.expense
            }))
            .sort((a, b) => b.month.localeCompare(a.month));

        // Top Expenses
        const expenseCategoryMap = new Map<string, number>();
        expenses.forEach(exp => {
            const cat = exp.category || 'Uncategorized';
            expenseCategoryMap.set(cat, (expenseCategoryMap.get(cat) || 0) + Number(exp.amount));
        });
        const topExpenses = Array.from(expenseCategoryMap.entries())
            .map(([name, amount]) => ({ name, amount }))
            .sort((a, b) => b.amount - a.amount)
            .slice(0, 5);

        return NextResponse.json({
            summary: {
                totalIncome,
                totalExpense,
                netProfit
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