import type {
  AnalyticsInvoiceWithPayments,
  AnalyticsPayment,
  IBillingAnalyticsRepository,
  InvoiceAmountRow,
} from "../domain/ports/IBillingAnalyticsRepository";
import { BillingAnalyticsRepository } from "../repositories/BillingAnalyticsRepository";

function createBillingAnalyticsRepository(): IBillingAnalyticsRepository {
  return new BillingAnalyticsRepository();
}

type PeriodType = "TODAY" | "WEEK" | "MONTH" | "QUARTER" | "YEAR" | "CUSTOM";

const MONTHLY_TREND_MONTHS = 12;
const DAYS_IN_WEEK = 7;
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;
const MONTHS_PER_QUARTER = 3;

interface DateRange {
  start: Date;
  end: Date;
  type: PeriodType;
}

interface AnalyticsPeriodOptions {
  period?: string;
  startDate?: string;
  endDate?: string;
}

/**
 * Service untuk analitik billing.
 *
 * Catatan satuan: seluruh nominal (`totalAmount`, `Payment.amount`) disimpan
 * sebagai BigInt dalam rupiah penuh — bukan sen. Jangan bagi 100 di sini.
 */
export class BillingAnalyticsService {
  constructor(
    private readonly repository: IBillingAnalyticsRepository = createBillingAnalyticsRepository(),
  ) {}

  /** Mengambil analitik billing lengkap untuk satu periode. */
  async getAnalytics(options: AnalyticsPeriodOptions) {
    const dateRange = this.calculateDateRange(options);

    const [invoices, allPayments, topCustomers, monthlyTrend] =
      await Promise.all([
        this.repository.getInvoicesWithPayments(dateRange.start, dateRange.end),
        this.repository.getPayments(dateRange.start, dateRange.end),
        this.repository.getTopCustomersByPayment(
          dateRange.start,
          dateRange.end,
        ),
        this.getMonthlyTrend(),
      ]);

    return {
      summary: this.calculateSummary(invoices, dateRange),
      paymentMethods: this.calculatePaymentMethods(allPayments),
      invoiceStatuses: this.calculateInvoiceStatuses(invoices),
      monthlyTrend,
      topCustomers,
    };
  }

  /** Menentukan rentang tanggal dari periode preset atau rentang kustom. */
  private calculateDateRange(options: AnalyticsPeriodOptions): DateRange {
    const now = new Date();
    const customRange = this.parseCustomRange(options);
    if (customRange) {
      return customRange;
    }

    const period = options.period || "MONTH";

    // CUSTOM tanpa rentang tanggal valid sudah jatuh ke preset di atas, jadi
    // labelnya tidak boleh ikut CUSTOM — response akan menyesatkan konsumen.
    const isPresetPeriod = this.isKnownPeriod(period) && period !== "CUSTOM";

    return {
      start: this.resolvePeriodStart(period, now),
      end: now,
      type: isPresetPeriod ? period : "MONTH",
    };
  }

  /**
   * Memvalidasi rentang kustom. Tanggal tidak valid atau terbalik diabaikan
   * agar fallback ke periode preset, bukan mengirim Invalid Date ke database.
   */
  private parseCustomRange(options: AnalyticsPeriodOptions): DateRange | null {
    if (!options.startDate || !options.endDate) {
      return null;
    }

    const start = new Date(options.startDate);
    const end = new Date(options.endDate);
    const isValidRange =
      !Number.isNaN(start.getTime()) &&
      !Number.isNaN(end.getTime()) &&
      start <= end;

    return isValidRange ? { start, end, type: "CUSTOM" } : null;
  }

  private resolvePeriodStart(period: string, now: Date): Date {
    switch (period) {
      case "TODAY":
        return new Date(now.getFullYear(), now.getMonth(), now.getDate());
      case "WEEK":
        return new Date(now.getTime() - DAYS_IN_WEEK * MILLISECONDS_PER_DAY);
      case "QUARTER": {
        const quarter = Math.floor(now.getMonth() / MONTHS_PER_QUARTER);
        return new Date(now.getFullYear(), quarter * MONTHS_PER_QUARTER, 1);
      }
      case "YEAR":
        return new Date(now.getFullYear(), 0, 1);
      case "MONTH":
      default:
        return new Date(now.getFullYear(), now.getMonth(), 1);
    }
  }

  private isKnownPeriod(period: string): period is PeriodType {
    return ["TODAY", "WEEK", "MONTH", "QUARTER", "YEAR", "CUSTOM"].includes(
      period,
    );
  }

  /** Menghitung ringkasan invoice dan pembayaran untuk periode terpilih. */
  private calculateSummary(
    invoices: AnalyticsInvoiceWithPayments[],
    dateRange: DateRange,
  ) {
    const totalInvoices = invoices.length;
    const totalRevenue = invoices.reduce(
      (sum, invoice) => sum + Number(invoice.totalAmount),
      0,
    );
    const totalPayments = invoices.reduce(
      (sum, invoice) => sum + invoice.payment.length,
      0,
    );
    const totalPaid = invoices.reduce(
      (sum, invoice) =>
        sum +
        invoice.payment.reduce(
          (paidSum: number, payment: AnalyticsPayment) =>
            paidSum + Number(payment.amount),
          0,
        ),
      0,
    );

    return {
      totalInvoices,
      totalRevenue,
      totalPayments,
      totalPaid,
      outstandingAmount: totalRevenue - totalPaid,
      averageInvoiceValue: totalInvoices > 0 ? totalRevenue / totalInvoices : 0,
      period: {
        start: dateRange.start.toISOString(),
        end: dateRange.end.toISOString(),
        type: dateRange.type,
      },
    };
  }

  /** Menghitung statistik pembayaran per metode. */
  private calculatePaymentMethods(payments: AnalyticsPayment[]) {
    const methodStats = payments.reduce(
      (acc, payment) => {
        const method = payment.paymentMethod;
        if (!acc[method]) {
          acc[method] = { method, count: 0, total: 0 };
        }
        acc[method].count += 1;
        acc[method].total += Number(payment.amount);
        return acc;
      },
      {} as Record<string, { method: string; count: number; total: number }>,
    );

    return Object.values(methodStats);
  }

  /** Menghitung statistik invoice per status. */
  private calculateInvoiceStatuses(invoices: AnalyticsInvoiceWithPayments[]) {
    const statusStats = invoices.reduce(
      (acc, invoice) => {
        const status = invoice.status;
        if (!acc[status]) {
          acc[status] = { status, count: 0, total: 0 };
        }
        acc[status].count += 1;
        acc[status].total += Number(invoice.totalAmount);
        return acc;
      },
      {} as Record<string, { status: string; count: number; total: number }>,
    );

    return Object.values(statusStats);
  }

  /** Menghitung tren 12 bulan terakhir lewat satu query rentang penuh. */
  private async getMonthlyTrend(now: Date = new Date()) {
    const rangeStart = new Date(
      now.getFullYear(),
      now.getMonth() - (MONTHLY_TREND_MONTHS - 1),
      1,
    );
    const rangeEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const invoices = await this.repository.getInvoiceAmountsForRange(
      rangeStart,
      rangeEnd,
    );
    const buckets = this.groupInvoiceAmountsByMonth(invoices);

    return Array.from({ length: MONTHLY_TREND_MONTHS }, (_, index) => {
      const monthDate = new Date(
        now.getFullYear(),
        now.getMonth() - (MONTHLY_TREND_MONTHS - 1) + index,
        1,
      );
      const bucket = buckets.get(toMonthKey(monthDate));

      return {
        month: monthDate.toLocaleDateString("id-ID", {
          month: "long",
          year: "numeric",
        }),
        invoices: bucket?.invoices ?? 0,
        revenue: bucket?.revenue ?? 0,
      };
    });
  }

  private groupInvoiceAmountsByMonth(invoices: InvoiceAmountRow[]) {
    const buckets = new Map<string, { invoices: number; revenue: number }>();

    for (const invoice of invoices) {
      const key = toMonthKey(invoice.createdAt);
      const bucket = buckets.get(key) ?? { invoices: 0, revenue: 0 };
      bucket.invoices += 1;
      bucket.revenue += Number(invoice.totalAmount);
      buckets.set(key, bucket);
    }

    return buckets;
  }
}

/** Kunci bucket bulanan `YYYY-MM` di timezone server. */
function toMonthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}
