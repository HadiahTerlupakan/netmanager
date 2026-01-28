import { BillingAnalyticsRepository } from '../repositories/BillingAnalyticsRepository'
import type { InvoiceWithPayments } from '../repositories/BillingAnalyticsRepository'
import type { Payment } from '@prisma/client'

type PeriodType = 'TODAY' | 'WEEK' | 'MONTH' | 'QUARTER' | 'YEAR' | 'CUSTOM'

interface DateRange {
    start: Date
    end: Date
    type: PeriodType
}

/**
 * Service for billing analytics business logic
 */
export class BillingAnalyticsService {
    private repository: BillingAnalyticsRepository

    constructor() {
        this.repository = new BillingAnalyticsRepository()
    }

    /**
     * Get complete billing analytics
     */
    async getAnalytics(options: {
        period?: string
        startDate?: string
        endDate?: string
    }) {
        const dateRange = this.calculateDateRange(options)

        // Parallel fetching for better performance
        const [invoices, allPayments, topCustomers] = await Promise.all([
            this.repository.getInvoicesWithPayments(dateRange.start, dateRange.end),
            this.repository.getPayments(dateRange.start, dateRange.end),
            this.repository.getTopCustomersByPayment(dateRange.start, dateRange.end),
        ])

        // Calculate all metrics
        const summary = this.calculateSummary(invoices, dateRange)
        const paymentMethods = this.calculatePaymentMethods(allPayments)
        const invoiceStatuses = this.calculateInvoiceStatuses(invoices)
        const monthlyTrend = await this.getMonthlyTrend()

        return {
            summary,
            paymentMethods,
            invoiceStatuses,
            monthlyTrend,
            topCustomers,
        }
    }

    /**
     * Calculate date range based on period
     */
    private calculateDateRange(options: {
        period?: string
        startDate?: string
        endDate?: string
    }): DateRange {
        const now = new Date()
        let dateStart: Date
        const dateEnd: Date = now

        if (options.startDate && options.endDate) {
            return {
                start: new Date(options.startDate),
                end: new Date(options.endDate),
                type: 'CUSTOM',
            }
        }

        const period = options.period || 'MONTH'

        switch (period) {
            case 'TODAY':
                dateStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
                break
            case 'WEEK':
                dateStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
                break
            case 'MONTH':
                dateStart = new Date(now.getFullYear(), now.getMonth(), 1)
                break
            case 'QUARTER':
                const quarter = Math.floor(now.getMonth() / 3)
                dateStart = new Date(now.getFullYear(), quarter * 3, 1)
                break
            case 'YEAR':
                dateStart = new Date(now.getFullYear(), 0, 1)
                break
            default:
                dateStart = new Date(now.getFullYear(), now.getMonth(), 1)
        }

        return {
            start: dateStart,
            end: dateEnd,
            type: period as PeriodType,
        }
    }

    /**
     * Calculate summary statistics
     */
    private calculateSummary(invoices: InvoiceWithPayments[], dateRange: DateRange) {
        const totalInvoices = invoices.length
        const totalRevenue = invoices.reduce((sum, inv) => sum + Number(inv.totalAmount) / 100, 0)
        const totalPayments = invoices.reduce((sum, inv) => sum + inv.payment.length, 0)
        const totalPaid = invoices.reduce((sum, inv) => {
            const paid = inv.payment.reduce((pSum, p) => pSum + Number(p.amount) / 100, 0)
            return sum + paid
        }, 0)
        const outstandingAmount = totalRevenue - totalPaid
        const averageInvoiceValue = totalInvoices > 0 ? totalRevenue / totalInvoices : 0

        return {
            totalInvoices,
            totalRevenue,
            totalPayments,
            totalPaid,
            outstandingAmount,
            averageInvoiceValue,
            period: {
                start: dateRange.start.toISOString(),
                end: dateRange.end.toISOString(),
                type: dateRange.type,
            },
        }
    }

    /**
     * Calculate payment method statistics
     */
    private calculatePaymentMethods(payments: Payment[]) {
        const methodStats = payments.reduce((acc, payment) => {
            const method = payment.paymentMethod
            if (!acc[method]) {
                acc[method] = { method, count: 0, total: 0 }
            }
            acc[method].count += 1
            acc[method].total += Number(payment.amount) / 100
            return acc
        }, {} as Record<string, { method: string; count: number; total: number }>)

        return Object.values(methodStats)
    }

    /**
     * Calculate invoice status statistics
     */
    private calculateInvoiceStatuses(invoices: InvoiceWithPayments[]) {
        const statusStats = invoices.reduce((acc, invoice) => {
            const status = invoice.status
            if (!acc[status]) {
                acc[status] = { status, count: 0, total: 0 }
            }
            acc[status].count += 1
            acc[status].total += Number(invoice.totalAmount) / 100
            return acc
        }, {} as Record<string, { status: string; count: number; total: number }>)

        return Object.values(statusStats)
    }

    /**
     * Get monthly trend (last 12 months)
     */
    private async getMonthlyTrend() {
        const now = new Date()
        const monthlyTrend = []

        for (let i = 11; i >= 0; i--) {
            const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1)
            const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0)

            const monthInvoices = await this.repository.getInvoicesForMonth(monthDate, monthEnd)
            const monthRevenue = monthInvoices.reduce((sum, inv) => sum + Number(inv.totalAmount) / 100, 0)
            const monthName = monthDate.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })

            monthlyTrend.push({
                month: monthName,
                invoices: monthInvoices.length,
                revenue: monthRevenue,
            })
        }

        return monthlyTrend
    }
}
