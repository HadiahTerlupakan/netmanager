import { beforeEach, describe, expect, it, vi } from "vitest";

const palsu = vi.hoisted(() => ({
  findByIdWithHargaPaket: vi.fn(),
  findUnpaidInvoices: vi.fn(),
  findManyForExactDueDate: vi.fn(),
  findRawById: vi.fn(),
  createInvoiceForCustomer: vi.fn(),
  recompute: vi.fn(),
  createPaymentForRoute: vi.fn(),
  acquireLock: vi.fn(),
  release: vi.fn(),
}));

vi.mock("@/lib/distributed-lock", () => ({
  acquireLock: palsu.acquireLock,
}));

vi.mock("@/modules/finance/pelanggan-registry", () => ({
  getPelangganBillingBridge: () => ({
    findByIdWithHargaPaket: palsu.findByIdWithHargaPaket,
  }),
}));

vi.mock("@/modules/finance/repositories/InvoiceRepository", () => ({
  InvoiceRepository: class {
    findUnpaidInvoices = palsu.findUnpaidInvoices;
    findManyForExactDueDate = palsu.findManyForExactDueDate;
    findRawById = palsu.findRawById;
  },
}));

vi.mock("@/modules/finance/services/BillingInvoiceCreationService", () => ({
  BillingInvoiceCreationService: class {
    createInvoiceForCustomer = palsu.createInvoiceForCustomer;
  },
}));

vi.mock("@/modules/finance/services/InvoicePaymentStateService", () => ({
  InvoicePaymentStateService: class {
    recompute = palsu.recompute;
  },
}));

vi.mock("@/modules/finance/services/PaymentRouteService", () => ({
  createPaymentForRoute: palsu.createPaymentForRoute,
}));

import {
  CustomerRenewalError,
  CustomerRenewalService,
} from "@/modules/finance/services/CustomerRenewalService";

const JATUH_TEMPO = new Date(2026, 10, 5);
const JATUH_TEMPO_BARU = new Date(2026, 11, 5);

function pelanggan(harga = 150000) {
  return {
    id: "pel-1",
    nama: "Budi",
    jatuhTempo: JATUH_TEMPO,
    tipe: "REGULER",
    status: "ISOLIR",
    userId: null as string | null,
    usePPN: false,
    tenantId: "tenant-1",
    hargaPaket: {
      id: "paket-1",
      name: "20 Mbps",
      harga,
      usePPN: false,
      ppnPercentage: null as number | null,
    },
  };
}

function invoice(ubahan: Record<string, unknown> = {}) {
  return {
    id: "inv-1",
    status: "SENT",
    dueDate: JATUH_TEMPO,
    totalAmount: 150000n,
    paidAmount: 0n,
    ...ubahan,
  };
}

const INPUT_LUNAS = {
  pelangganId: "pel-1",
  statusBayar: "LUNAS" as const,
  paymentMethod: "BANK_TRANSFER" as const,
  reference: "TRX-77",
  notes: "bayar di loket",
  userId: "admin-1",
};
const INPUT_BELUM_LUNAS = {
  ...INPUT_LUNAS,
  statusBayar: "BELUM_LUNAS" as const,
};

describe("CustomerRenewalService.renewCurrentCycle", () => {
  let service: CustomerRenewalService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new CustomerRenewalService();
    palsu.acquireLock.mockResolvedValue(palsu.release);
    palsu.findByIdWithHargaPaket.mockResolvedValue(pelanggan());
    palsu.findUnpaidInvoices.mockResolvedValue([]);
    palsu.findManyForExactDueDate.mockResolvedValue([]);
    palsu.createPaymentForRoute.mockResolvedValue({ status: "created" });
  });

  it("memakai ulang tagihan terbuka siklus berjalan tanpa menerbitkan yang baru", async () => {
    palsu.findUnpaidInvoices.mockResolvedValue([invoice()]);

    const hasil = await service.renewCurrentCycle(INPUT_BELUM_LUNAS);

    expect(palsu.createInvoiceForCustomer).not.toHaveBeenCalled();
    expect(palsu.createPaymentForRoute).not.toHaveBeenCalled();
    expect(palsu.recompute).not.toHaveBeenCalled();
    expect(hasil).toEqual({
      invoiceId: "inv-1",
      invoiceStatus: "SENT",
      expectedJatuhTempo: null,
    });
  });

  it("memakai ulang tunggakan bertanggal lain alih-alih menagih dua kali", async () => {
    const tunggakan = invoice({
      id: "inv-lama",
      dueDate: new Date(2026, 9, 27),
    });
    palsu.findUnpaidInvoices.mockResolvedValue([tunggakan]);

    const hasil = await service.renewCurrentCycle(INPUT_BELUM_LUNAS);

    expect(palsu.createInvoiceForCustomer).not.toHaveBeenCalled();
    expect(hasil.invoiceId).toBe("inv-lama");
  });

  it("menerbitkan tagihan untuk jatuh tempo berjalan bila belum ada", async () => {
    palsu.createInvoiceForCustomer.mockResolvedValue(
      invoice({ id: "inv-baru" }),
    );

    const hasil = await service.renewCurrentCycle(INPUT_BELUM_LUNAS);

    expect(palsu.createInvoiceForCustomer).toHaveBeenCalledTimes(1);
    const [payload, dueDate] = palsu.createInvoiceForCustomer.mock.calls[0];
    expect(payload).toMatchObject({ id: "pel-1", tenantId: "tenant-1" });
    expect(payload.hargaPaket).toMatchObject({ id: "paket-1", harga: 150000 });
    expect(dueDate).toEqual(JATUH_TEMPO);
    expect(palsu.createPaymentForRoute).not.toHaveBeenCalled();
    expect(hasil).toEqual({
      invoiceId: "inv-baru",
      invoiceStatus: "SENT",
      expectedJatuhTempo: null,
    });
  });

  it("tidak menerbitkan tagihan kedua bila invoice siklus ini sudah lunas", async () => {
    palsu.findManyForExactDueDate.mockResolvedValue([
      invoice({ id: "inv-batal", status: "CANCELLED" }),
      invoice({ id: "inv-lunas", status: "PAID", paidAmount: 150000n }),
    ]);

    const hasil = await service.renewCurrentCycle(INPUT_LUNAS);

    expect(palsu.createInvoiceForCustomer).not.toHaveBeenCalled();
    expect(palsu.createPaymentForRoute).not.toHaveBeenCalled();
    expect(hasil.invoiceId).toBe("inv-lunas");
    expect(hasil.expectedJatuhTempo).toEqual(JATUH_TEMPO_BARU);
  });

  it("LUNAS mencatat payment sebesar sisa tagihan lewat jalur payment yang ada", async () => {
    palsu.findUnpaidInvoices.mockResolvedValue([
      invoice({ status: "PARTIAL_PAID", paidAmount: 50000n }),
    ]);
    palsu.findRawById.mockResolvedValue(
      invoice({ status: "PAID", paidAmount: 150000n }),
    );

    const hasil = await service.renewCurrentCycle(INPUT_LUNAS);

    expect(palsu.createPaymentForRoute).toHaveBeenCalledWith({
      input: {
        invoiceId: "inv-1",
        pelangganId: "pel-1",
        amount: 100000,
        paymentMethod: "BANK_TRANSFER",
        reference: "TRX-77",
        notes: "bayar di loket",
      },
      user: { id: "admin-1" },
    });
    expect(palsu.recompute).not.toHaveBeenCalled();
    expect(hasil).toEqual({
      invoiceId: "inv-1",
      invoiceStatus: "PAID",
      expectedJatuhTempo: JATUH_TEMPO_BARU,
    });
  });

  it("invoice Rp0 dilunasi lewat recompute tanpa payment", async () => {
    palsu.findByIdWithHargaPaket.mockResolvedValue(pelanggan(0));
    palsu.createInvoiceForCustomer.mockResolvedValue(
      invoice({ totalAmount: 0n }),
    );
    palsu.findRawById.mockResolvedValue(
      invoice({ totalAmount: 0n, status: "PAID" }),
    );

    const hasil = await service.renewCurrentCycle(INPUT_LUNAS);

    expect(palsu.createPaymentForRoute).not.toHaveBeenCalled();
    expect(palsu.recompute).toHaveBeenCalledWith("inv-1");
    expect(hasil.invoiceStatus).toBe("PAID");
    expect(hasil.expectedJatuhTempo).toEqual(JATUH_TEMPO_BARU);
  });

  it("menolak pelanggan dismantle", async () => {
    palsu.findByIdWithHargaPaket.mockResolvedValue({
      ...pelanggan(),
      status: "DISMANTLE",
    });

    await expect(service.renewCurrentCycle(INPUT_LUNAS)).rejects.toMatchObject({
      code: "NOT_RENEWABLE",
    });
    expect(palsu.createInvoiceForCustomer).not.toHaveBeenCalled();
  });

  it("menolak tanpa menyentuh tagihan bila perpanjangan lain sedang berjalan", async () => {
    palsu.acquireLock.mockResolvedValue(null);

    await expect(service.renewCurrentCycle(INPUT_LUNAS)).rejects.toMatchObject({
      code: "BUSY",
    });
    expect(palsu.findUnpaidInvoices).not.toHaveBeenCalled();
    expect(palsu.createInvoiceForCustomer).not.toHaveBeenCalled();
    expect(palsu.createPaymentForRoute).not.toHaveBeenCalled();
  });

  it("melepas lock setelah selesai, juga saat gagal", async () => {
    palsu.findByIdWithHargaPaket.mockResolvedValue(null);

    await expect(service.renewCurrentCycle(INPUT_LUNAS)).rejects.toBeInstanceOf(
      CustomerRenewalError,
    );
    expect(palsu.acquireLock).toHaveBeenCalledWith("renewal:pel-1", {
      ttlSeconds: 30,
    });
    expect(palsu.release).toHaveBeenCalledTimes(1);
  });

  it("melapor NOT_FOUND bila pelanggan tidak ada", async () => {
    palsu.findByIdWithHargaPaket.mockResolvedValue(null);

    await expect(service.renewCurrentCycle(INPUT_LUNAS)).rejects.toBeInstanceOf(
      CustomerRenewalError,
    );
  });
});
