import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { toStartOfDay } from "@/lib/utils/server-datetime";
import { createImmediateInvoice } from "@/modules/finance/services/automatic-billing-payment.helpers";

const JATUH_TEMPO_BARU = new Date("2026-11-28T03:15:00.000Z");

function setup() {
  const createInvoiceForCustomer = vi.fn(async () => ({
    id: "inv-baru",
    totalAmount: 11100n,
  }));
  const pelangganBridge = {
    findByIdWithHargaPaket: vi.fn(async () => ({
      id: "cust-1",
      nama: "TES LAB 02",
      jatuhTempo: JATUH_TEMPO_BARU,
      userId: null,
      usePPN: true,
      tenantId: "tenant-1",
      hargaPaket: { id: "paket-1", harga: 10000 },
    })),
  };
  return {
    createInvoiceForCustomer,
    options: {
      pelangganId: "cust-1",
      pelangganBridge: pelangganBridge as never,
      invoiceCreationService: { createInvoiceForCustomer } as never,
      invoiceRepo: {} as never,
      paymentRepo: {} as never,
    },
  };
}

const jatuhTempoTagihan = (
  fn: ReturnType<typeof setup>["createInvoiceForCustomer"],
) => (fn.mock.calls[0] as unknown as [unknown, Date])[1];

/**
 * "Batalkan & Buat Tagihan Baru" menjanjikan tagihan "sesuai dengan tanggal
 * jatuh tempo yang baru", tetapi tagihannya jatuh tempo hari ini. Setelah
 * dilunasi, jatuh tempo pelanggan dihitung dari hari ini: admin memilih
 * 28 Nov, pelanggan berakhir di 30 Nov (tes-lab-02, 30 Okt).
 */
describe("tagihan pengganti dari edit jatuh tempo", () => {
  it("jatuh tempo pada jatuh tempo pelanggan yang baru", async () => {
    const { options, createInvoiceForCustomer } = setup();

    await createImmediateInvoice({ ...options, jatuhTempoDariPelanggan: true });

    expect(jatuhTempoTagihan(createInvoiceForCustomer)).toEqual(
      toStartOfDay(JATUH_TEMPO_BARU),
    );
  });

  it("tagihan instan lain tetap jatuh tempo hari ini", async () => {
    const { options, createInvoiceForCustomer } = setup();

    await createImmediateInvoice(options);

    expect(jatuhTempoTagihan(createInvoiceForCustomer)).toEqual(
      toStartOfDay(new Date()),
    );
  });
});
