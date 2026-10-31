import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// Pembatalan schedule dimuat dinamis dan menarik graf modul finance lengkap
// (±1.300 berkas). Di sini cukup dipastikan ia dipanggil per invoice.
const palsu = vi.hoisted(() => ({
  cancelInvoiceBillingSchedules: vi.fn().mockResolvedValue(undefined),
  reverseCancelledInvoiceJournals: vi.fn().mockResolvedValue(1),
  refundSaldoKredit: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/modules/finance/services/billingScheduleLifecycle", () => ({
  cancelInvoiceBillingSchedules: palsu.cancelInvoiceBillingSchedules,
}));
vi.mock("@/modules/accounting", () => ({
  reverseCancelledInvoiceJournals: palsu.reverseCancelledInvoiceJournals,
}));
vi.mock("@/modules/finance/services/FinanceRepositoryFacade", () => ({
  FinanceRepositoryFacade: { refundSaldoKredit: palsu.refundSaldoKredit },
}));

import { cancelReplacedInvoice } from "@/modules/finance/services/outstanding-invoice.helpers";

function repoYangMembatalkan(
  cancelled: {
    notes?: string | null;
    discountAmount?: bigint;
  } | null,
) {
  return {
    cancelIfUnpaid: vi.fn().mockResolvedValue(
      cancelled && {
        id: "inv-1",
        pelangganId: "cust-1",
        status: "CANCELLED",
        notes: null,
        discountAmount: 0n,
        ...cancelled,
      },
    ),
  };
}

const batalkan = (repo: ReturnType<typeof repoYangMembatalkan>) =>
  cancelReplacedInvoice({
    invoiceRepo: repo as never,
    invoice: { id: "inv-1", tenantId: "t1" },
  });

describe("cancelReplacedInvoice", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("membatalkan hanya bila tagihan masih belum dibayar, lalu jadwal dan jurnalnya", async () => {
    const repo = repoYangMembatalkan({});

    await expect(batalkan(repo)).resolves.toBe(true);

    expect(repo.cancelIfUnpaid).toHaveBeenCalledWith(
      "inv-1",
      ["DRAFT", "SENT", "OVERDUE"],
      expect.any(Date),
    );
    expect(palsu.cancelInvoiceBillingSchedules).toHaveBeenCalledWith("inv-1");
    // Dulu tagihan yang diganti tetap tercatat sebagai piutang dan pendapatan.
    expect(palsu.reverseCancelledInvoiceJournals).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: "t1", invoiceId: "inv-1" }),
    );
  });

  // Saldo yang sudah memotong tagihan lama hilang bila tidak dikembalikan:
  // tagihan pengganti menagih penuh dan saldonya sudah nol.
  it("mengembalikan saldo kredit yang dipakai tagihan itu, bukan diskon lain", async () => {
    const repo = repoYangMembatalkan({
      notes: "Saldo kredit terpakai: Rp 30000",
      discountAmount: 50000n,
    });

    await batalkan(repo);

    expect(palsu.refundSaldoKredit).toHaveBeenCalledWith("cust-1", 30000n);
  });

  it("tagihan dengan diskon admin tanpa saldo tidak mengembalikan apa pun", async () => {
    const repo = repoYangMembatalkan({
      notes: "Diskon pemasangan",
      discountAmount: 50000n,
    });

    await batalkan(repo);

    expect(palsu.refundSaldoKredit).not.toHaveBeenCalled();
  });

  // Webhook bisa melunasinya tepat di antara pemeriksaan dan pembatalan.
  it("tagihan yang sudah tidak bisa dibatalkan dibiarkan apa adanya", async () => {
    const repo = repoYangMembatalkan(null);

    await expect(batalkan(repo)).resolves.toBe(false);

    expect(palsu.cancelInvoiceBillingSchedules).not.toHaveBeenCalled();
    expect(palsu.refundSaldoKredit).not.toHaveBeenCalled();
    expect(palsu.reverseCancelledInvoiceJournals).not.toHaveBeenCalled();
  });
});
