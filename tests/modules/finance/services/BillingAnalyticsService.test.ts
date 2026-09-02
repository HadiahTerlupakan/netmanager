import { describe, expect, it } from "vitest";
import { BillingAnalyticsService } from "@/modules/finance/services/BillingAnalyticsService";
import type {
  AnalyticsInvoiceWithPayments,
  AnalyticsPayment,
  IBillingAnalyticsRepository,
  InvoiceAmountRow,
  TopCustomerPayment,
} from "@/modules/finance/domain/ports/IBillingAnalyticsRepository";

function createRepository(
  overrides: Partial<{
    invoices: AnalyticsInvoiceWithPayments[];
    payments: AnalyticsPayment[];
    amounts: InvoiceAmountRow[];
    topCustomers: TopCustomerPayment[];
  }> = {},
): IBillingAnalyticsRepository {
  return {
    getInvoicesWithPayments: async () => overrides.invoices ?? [],
    getPayments: async () => overrides.payments ?? [],
    getInvoiceAmountsForRange: async () => overrides.amounts ?? [],
    getTopCustomersByPayment: async () => overrides.topCustomers ?? [],
  };
}

describe("BillingAnalyticsService — satuan nominal", () => {
  // Regresi: service ini dulu membagi setiap nominal dengan 100 karena
  // mengira uang disimpan dalam sen. HargaPaket.harga bertipe Int rupiah
  // penuh dan Invoice.totalAmount menyimpannya apa adanya, jadi pembagian itu
  // membuat SELURUH angka analitik tampil 100x lebih kecil.
  it("melaporkan rupiah penuh, bukan sen", async () => {
    const service = new BillingAnalyticsService(
      createRepository({
        invoices: [
          {
            status: "PAID",
            totalAmount: 150000n,
            payment: [{ amount: 150000n, paymentMethod: "CASH" }],
          },
        ],
        payments: [{ amount: 150000n, paymentMethod: "CASH" }],
      }),
    );

    const result = await service.getAnalytics({ period: "MONTH" });

    expect(result.summary.totalRevenue).toBe(150000);
    expect(result.summary.totalPaid).toBe(150000);
    expect(result.summary.averageInvoiceValue).toBe(150000);
    expect(result.summary.outstandingAmount).toBe(0);
    expect(result.paymentMethods[0]?.total).toBe(150000);
    expect(result.invoiceStatuses[0]?.total).toBe(150000);
  });

  it("menghitung outstanding dari selisih tagihan dan pembayaran", async () => {
    const service = new BillingAnalyticsService(
      createRepository({
        invoices: [
          {
            status: "PARTIAL_PAID",
            totalAmount: 200000n,
            payment: [{ amount: 75000n, paymentMethod: "TRANSFER" }],
          },
        ],
      }),
    );

    const result = await service.getAnalytics({ period: "MONTH" });

    expect(result.summary.outstandingAmount).toBe(125000);
  });

  it("tidak membagi nol dengan jumlah invoice kosong", async () => {
    const service = new BillingAnalyticsService(createRepository());

    const result = await service.getAnalytics({ period: "MONTH" });

    expect(result.summary.averageInvoiceValue).toBe(0);
  });
});

describe("BillingAnalyticsService — tren bulanan", () => {
  it("mengembalikan 12 bucket bulanan", async () => {
    const service = new BillingAnalyticsService(createRepository());

    const result = await service.getAnalytics({ period: "MONTH" });

    expect(result.monthlyTrend).toHaveLength(12);
  });

  // Regresi: implementasi lama memakai rentang per bulan dengan `lt` pada
  // tanggal terakhir bulan itu, sehingga invoice pada HARI TERAKHIR setiap
  // bulan tidak pernah masuk hitungan tren.
  it("memasukkan invoice hari pertama dan hari terakhir bulan ke bucket sama", async () => {
    const now = new Date();
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 9, 0);
    const lastOfMonth = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
      23,
      30,
    );

    const service = new BillingAnalyticsService(
      createRepository({
        amounts: [
          { createdAt: firstOfMonth, totalAmount: 10000n },
          { createdAt: lastOfMonth, totalAmount: 25000n },
        ],
      }),
    );

    const result = await service.getAnalytics({ period: "MONTH" });
    const currentBucket = result.monthlyTrend[11];

    expect(currentBucket?.invoices).toBe(2);
    expect(currentBucket?.revenue).toBe(35000);
  });
});

describe("BillingAnalyticsService — rentang tanggal", () => {
  it("memakai rentang kustom yang valid", async () => {
    const service = new BillingAnalyticsService(createRepository());

    const result = await service.getAnalytics({
      startDate: "2026-01-01",
      endDate: "2026-03-31",
    });

    expect(result.summary.period.type).toBe("CUSTOM");
  });

  it.each([
    ["tanggal tidak valid", "bukan-tanggal", "juga-bukan"],
    ["rentang terbalik", "2026-03-31", "2026-01-01"],
  ])("jatuh ke preset saat %s", async (_label, startDate, endDate) => {
    const service = new BillingAnalyticsService(createRepository());

    const result = await service.getAnalytics({ startDate, endDate });

    expect(result.summary.period.type).toBe("MONTH");
    expect(Number.isNaN(new Date(result.summary.period.start).getTime())).toBe(
      false,
    );
  });

  it("tidak melabeli CUSTOM saat rentang tanggal tidak diberikan", async () => {
    const service = new BillingAnalyticsService(createRepository());

    const result = await service.getAnalytics({ period: "CUSTOM" });

    expect(result.summary.period.type).toBe("MONTH");
  });
});
