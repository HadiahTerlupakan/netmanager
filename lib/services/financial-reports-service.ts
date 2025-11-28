// Financial Reports Service - P&L and Cash Flow

import { PrismaClient, TagihanStatus, TipePengeluaran } from '@prisma/client'

export interface ProfitLossReport {
    period: {
        startDate: Date
        endDate: Date
        month: number
        year: number
    }
    revenue: {
        total: bigint
        breakdown: {
            subscriptions: bigint // From Tagihan
            manualIncome: bigint // From Pemasukan
        }
    }
    expenses: {
        total: bigint
        opex: bigint
        capex: bigint
        breakdown: Array<{
            category: string
            amount: bigint
            type: 'OPEX' | 'CAPEX'
        }>
    }
    grossProfit: bigint
    netProfit: bigint
    profitMargin: number // Percentage
}

export interface CashFlowStatement {
    period: {
        startDate: Date
        endDate: Date
    }
    operatingActivities: {
        cashFromCustomers: bigint // Tagihan LUNAS
        cashToSuppliers: bigint // OPEX payments
        netOperating: bigint
    }
    investingActivities: {
        equipmentPurchases: bigint // CAPEX
        netInvesting: bigint
    }
    financingActivities: {
        loansReceived: bigint // Manual entries
        loanRepayments: bigint
        netFinancing: bigint
    }
    netCashFlow: bigint
    openingCash: bigint
    closingCash: bigint
}

export class FinancialReportsService {
    constructor(private prisma: PrismaClient) { }

    /**
     * Generate Profit & Loss statement for a given period
     */
    async generateProfitLoss(month: number, year: number): Promise<ProfitLossReport> {
        // Calculate period boundaries
        const startDate = new Date(year, month - 1, 1)
        const endDate = new Date(year, month, 0, 23, 59, 59)

        // 1. Calculate Revenue
        // Revenue from paid invoices (Tagihan LUNAS)
        const paidInvoices = await this.prisma.tagihan.findMany({
            where: {
                status: TagihanStatus.LUNAS,
                tanggalBayar: {
                    gte: startDate,
                    lte: endDate
                }
            },
            select: {
                total: true
            }
        })

        const subscriptionRevenue = paidInvoices.reduce((sum, inv) => {
            const amount = typeof inv.total === 'bigint' ? inv.total : BigInt(inv.total)
            return sum + amount
        }, BigInt(0))

        // Manual income (Pemasukan)
        const manualIncomes = await this.prisma.pemasukan.findMany({
            where: {
                tanggal: {
                    gte: startDate,
                    lte: endDate
                }
            },
            select: {
                jumlah: true
            }
        })

        const manualIncome = manualIncomes.reduce((sum, inc) => {
            const amount = typeof inc.jumlah === 'bigint' ? inc.jumlah : BigInt(inc.jumlah)
            return sum + amount
        }, BigInt(0))

        const totalRevenue = subscriptionRevenue + manualIncome

        // 2. Calculate Expenses
        const expenses = await this.prisma.pengeluaran.findMany({
            where: {
                tanggal: {
                    gte: startDate,
                    lte: endDate
                }
            },
            select: {
                kategori: true,
                jumlah: true,
                tipePengeluaran: true
            }
        })

        let opex = BigInt(0)
        let capex = BigInt(0)
        const categoryMap = new Map<string, { amount: bigint; type: 'OPEX' | 'CAPEX' }>()

        for (const expense of expenses) {
            const amount = typeof expense.jumlah === 'bigint' ? expense.jumlah : BigInt(expense.jumlah)

            if (expense.tipePengeluaran === TipePengeluaran.OPEX) {
                opex += amount
            } else {
                capex += amount
            }

            // Group by category
            const existing = categoryMap.get(expense.kategori) || {
                amount: BigInt(0),
                type: expense.tipePengeluaran
            }
            categoryMap.set(expense.kategori, {
                amount: existing.amount + amount,
                type: expense.tipePengeluaran
            })
        }

        const totalExpenses = opex + capex

        // Convert category map to array
        const expenseBreakdown = Array.from(categoryMap.entries()).map(([category, data]) => ({
            category,
            amount: data.amount,
            type: data.type
        }))

        // 3. Calculate Profit
        const grossProfit = totalRevenue - opex // Gross = Revenue - OPEX only
        const netProfit = totalRevenue - totalExpenses // Net = Revenue - All Expenses
        const profitMargin = totalRevenue > 0
            ? (Number(netProfit) / Number(totalRevenue)) * 100
            : 0

        return {
            period: {
                startDate,
                endDate,
                month,
                year
            },
            revenue: {
                total: totalRevenue,
                breakdown: {
                    subscriptions: subscriptionRevenue,
                    manualIncome
                }
            },
            expenses: {
                total: totalExpenses,
                opex,
                capex,
                breakdown: expenseBreakdown
            },
            grossProfit,
            netProfit,
            profitMargin
        }
    }

    /**
     * Generate Cash Flow statement for a given period
     */
    async generateCashFlow(month: number, year: number): Promise<CashFlowStatement> {
        const startDate = new Date(year, month - 1, 1)
        const endDate = new Date(year, month, 0, 23, 59, 59)

        // 1. Operating Activities
        // Cash received from customers (Tagihan LUNAS)
        const paidInvoices = await this.prisma.tagihan.findMany({
            where: {
                status: TagihanStatus.LUNAS,
                tanggalBayar: {
                    gte: startDate,
                    lte: endDate
                }
            },
            select: {
                total: true
            }
        })

        const cashFromCustomers = paidInvoices.reduce((sum, inv) => {
            const amount = typeof inv.total === 'bigint' ? inv.total : BigInt(inv.total)
            return sum + amount
        }, BigInt(0))

        // Cash paid for operations (OPEX only)
        const opexExpenses = await this.prisma.pengeluaran.findMany({
            where: {
                tanggal: {
                    gte: startDate,
                    lte: endDate
                },
                tipePengeluaran: TipePengeluaran.OPEX
            },
            select: {
                jumlah: true
            }
        })

        const cashToSuppliers = opexExpenses.reduce((sum, exp) => {
            const amount = typeof exp.jumlah === 'bigint' ? exp.jumlah : BigInt(exp.jumlah)
            return sum + amount
        }, BigInt(0))

        const netOperating = cashFromCustomers - cashToSuppliers

        // 2. Investing Activities (CAPEX)
        const capexExpenses = await this.prisma.pengeluaran.findMany({
            where: {
                tanggal: {
                    gte: startDate,
                    lte: endDate
                },
                tipePengeluaran: TipePengeluaran.CAPEX
            },
            select: {
                jumlah: true
            }
        })

        const equipmentPurchases = capexExpenses.reduce((sum, exp) => {
            const amount = typeof exp.jumlah === 'bigint' ? exp.jumlah : BigInt(exp.jumlah)
            return sum + amount
        }, BigInt(0))

        const netInvesting = BigInt(0) - equipmentPurchases // Negative because it's cash out

        // 3. Financing Activities
        // For now, get from Pemasukan with kategori "INVESTASI" or "PINJAMAN"
        const financingIn = await this.prisma.pemasukan.findMany({
            where: {
                tanggal: {
                    gte: startDate,
                    lte: endDate
                },
                kategori: {
                    in: ['INVESTASI', 'PINJAMAN']
                }
            },
            select: {
                jumlah: true
            }
        })

        const loansReceived = financingIn.reduce((sum, inc) => {
            const amount = typeof inc.jumlah === 'bigint' ? inc.jumlah : BigInt(inc.jumlah)
            return sum + amount
        }, BigInt(0))

        // For now, no loan repayments tracked separately
        const loanRepayments = BigInt(0)
        const netFinancing = loansReceived - loanRepayments

        // 4. Calculate net cash flow
        const netCashFlow = netOperating + netInvesting + netFinancing

        // Get opening cash (from previous month's closing or manual entry)
        // For now, we'll calculate based on all historical data
        const prevMonth = month === 1 ? 12 : month - 1
        const prevYear = month === 1 ? year - 1 : year

        const openingCash = await this.calculateCashBalance(prevMonth, prevYear)
        const closingCash = openingCash + netCashFlow

        return {
            period: {
                startDate,
                endDate
            },
            operatingActivities: {
                cashFromCustomers,
                cashToSuppliers,
                netOperating
            },
            investingActivities: {
                equipmentPurchases,
                netInvesting
            },
            financingActivities: {
                loansReceived,
                loanRepayments,
                netFinancing
            },
            netCashFlow,
            openingCash,
            closingCash
        }
    }

    /**
     * Calculate cumulative cash balance up to a given month
     */
    private async calculateCashBalance(month: number, year: number): Promise<bigint> {
        const endDate = new Date(year, month, 0, 23, 59, 59)

        // All cash in from paid invoices
        const allPaidInvoices = await this.prisma.tagihan.findMany({
            where: {
                status: TagihanStatus.LUNAS,
                tanggalBayar: {
                    lte: endDate
                }
            },
            select: {
                total: true
            }
        })

        const totalCashIn = allPaidInvoices.reduce((sum, inv) => {
            const amount = typeof inv.total === 'bigint' ? inv.total : BigInt(inv.total)
            return sum + amount
        }, BigInt(0))

        // All cash out from expenses
        const allExpenses = await this.prisma.pengeluaran.findMany({
            where: {
                tanggal: {
                    lte: endDate
                }
            },
            select: {
                jumlah: true
            }
        })

        const totalCashOut = allExpenses.reduce((sum, exp) => {
            const amount = typeof exp.jumlah === 'bigint' ? exp.jumlah : BigInt(exp.jumlah)
            return sum + amount
        }, BigInt(0))

        return totalCashIn - totalCashOut
    }

    /**
     * Get month-over-month comparison
     */
    async getMonthComparison(currentMonth: number, currentYear: number) {
        const current = await this.generateProfitLoss(currentMonth, currentYear)

        // Get previous month
        let prevMonth = currentMonth - 1
        let prevYear = currentYear
        if (prevMonth === 0) {
            prevMonth = 12
            prevYear -= 1
        }

        const previous = await this.generateProfitLoss(prevMonth, prevYear)

        // Calculate changes
        const revenueChange = current.revenue.total - previous.revenue.total
        const revenueChangePercent = previous.revenue.total > 0
            ? (Number(revenueChange) / Number(previous.revenue.total)) * 100
            : 0

        const profitChange = current.netProfit - previous.netProfit
        const profitChangePercent = previous.netProfit > 0
            ? (Number(profitChange) / Number(previous.netProfit)) * 100
            : 0

        return {
            current,
            previous,
            changes: {
                revenue: {
                    amount: revenueChange,
                    percentage: revenueChangePercent
                },
                profit: {
                    amount: profitChange,
                    percentage: profitChangePercent
                }
            }
        }
    }
}
