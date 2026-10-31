import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  CycleInvoiceRepriceService,
  type CycleInvoiceRepriceDeps,
} from "@/modules/finance/services/CycleInvoiceRepriceService";

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const PELANGGAN = "pel-1";
const PAKET_LAMA = {
  id: "paket-10m",
  name: "10 Mbps",
  harga: 150000,
  usePPN: false,
  ppnPercentage: null as number | null,
};
const PAKET_BARU = {
  id: "paket-20m",
  name: "20 Mbps",
  harga: 250000,
  usePPN: false,
  ppnPercentage: null as number | null,
};
const JATUH_TEMPO = new Date("2026-10-31T17:00:00.000Z");
const NOW = new Date("2026-10-28T03:00:00.000Z");

const customer = {
  id: PELANGGAN,
  nama: "Pelanggan",
  jatuhTempo: JATUH_TEMPO,
  userId: null as string | null,
  usePPN: false,
  tenantId: "tenant-1",
  hargaPaket: PAKET_LAMA,
};

function cycleInvoice(overrides: Record<string, unknown> = {}) {
  return {
    id: "inv-lama",
    status: "SENT",
    dueDate: JATUH_TEMPO,
    subtotal: 150000n,
    discountAmount: 0n,
    totalAmount: 150000n,
    paidAmount: 0n,
    tenantId: "tenant-1",
    payment: [] as Array<{ gatewayStatus: string | null; expiresAt: Date }>,
    ...overrides,
  };
}

function buildDeps() {
  const deps = {
    findCycleInvoices: vi.fn().mockResolvedValue([cycleInvoice()]),
    findBillingPackage: vi.fn().mockResolvedValue(PAKET_LAMA),
    loadCustomer: vi.fn().mockResolvedValue(customer),
    invoiceCreation: {
      withCyclePackage: vi
        .fn()
        .mockImplementation(async (c: typeof customer) => ({
          ...c,
          hargaPaket: PAKET_BARU,
        })),
      createInvoiceForCustomer: vi.fn().mockResolvedValue({
        id: "inv-baru",
        dueDate: JATUH_TEMPO,
        totalAmount: 250000n,
      }),
    },
    cancelInvoice: vi.fn().mockResolvedValue(undefined),
    refundSaldoKredit: vi.fn().mockResolvedValue(undefined),
    runExclusively: vi.fn(async (_id: string, task: () => Promise<unknown>) =>
      task(),
    ),
    now: () => NOW,
  };
  return deps;
}

function newService(
  deps: ReturnType<typeof buildDeps>,
  overrides: Partial<CycleInvoiceRepriceDeps> = {},
) {
  return new CycleInvoiceRepriceService({
    ...(deps as unknown as CycleInvoiceRepriceDeps),
    ...overrides,
  });
}

const input = {
  pelangganId: PELANGGAN,
  cycleDate: JATUH_TEMPO,
  previousPackageId: PAKET_LAMA.id,
};

describe("CycleInvoiceRepriceService.syncCycleInvoice", () => {
  let deps: ReturnType<typeof buildDeps>;

  beforeEach(() => {
    vi.clearAllMocks();
    deps = buildDeps();
  });

  it("belum ada tagihan siklus: tidak ada yang diganti", async () => {
    deps.findCycleInvoices.mockResolvedValue([]);

    const result = await newService(deps).syncCycleInvoice(input);

    expect(result).toEqual({ status: "NOT_ISSUED" });
    expect(deps.cancelInvoice).not.toHaveBeenCalled();
  });

  it("tagihan belum dibayar diganti dengan tagihan dari paket yang berlaku", async () => {
    const result = await newService(deps).syncCycleInvoice(input);

    expect(deps.cancelInvoice).toHaveBeenCalledWith({
      id: "inv-lama",
      tenantId: "tenant-1",
    });
    expect(deps.invoiceCreation.createInvoiceForCustomer).toHaveBeenCalledWith(
      customer,
      JATUH_TEMPO,
    );
    expect(result).toEqual({
      status: "REPRICED",
      invoiceId: "inv-baru",
      replacedInvoiceId: "inv-lama",
      dueDate: JATUH_TEMPO,
      totalAmount: 250000n,
    });
  });

  it("pembatalan dan penerbitan ulang berjalan di bawah kunci checkout pelanggan", async () => {
    deps.runExclusively.mockImplementation(async () => undefined as never);

    await newService(deps).syncCycleInvoice(input);

    expect(deps.runExclusively).toHaveBeenCalledWith(
      PELANGGAN,
      expect.any(Function),
    );
    expect(deps.findCycleInvoices).not.toHaveBeenCalled();
    expect(deps.cancelInvoice).not.toHaveBeenCalled();
  });

  it("saldo kredit yang terpakai tagihan lama dikembalikan sebelum tagihan baru memakainya lagi", async () => {
    deps.findCycleInvoices.mockResolvedValue([
      cycleInvoice({ discountAmount: 40000n, totalAmount: 110000n }),
    ]);
    const urutan: string[] = [];
    deps.refundSaldoKredit.mockImplementation(async () => {
      urutan.push("refund");
    });
    deps.invoiceCreation.createInvoiceForCustomer.mockImplementation(
      async () => {
        urutan.push("create");
        return { id: "inv-baru", dueDate: JATUH_TEMPO, totalAmount: 210000n };
      },
    );

    await newService(deps).syncCycleInvoice(input);

    expect(deps.refundSaldoKredit).toHaveBeenCalledWith(PELANGGAN, 40000n);
    expect(urutan).toEqual(["refund", "create"]);
  });

  it("checkout aktif: tagihan dibiarkan utuh", async () => {
    deps.findCycleInvoices.mockResolvedValue([
      cycleInvoice({
        payment: [
          {
            gatewayStatus: "PENDING",
            expiresAt: new Date(NOW.getTime() + 60_000),
          },
        ],
      }),
    ]);

    const result = await newService(deps).syncCycleInvoice(input);

    expect(result).toEqual({
      status: "KEPT",
      reason: "ACTIVE_CHECKOUT",
      invoiceId: "inv-lama",
      dueDate: JATUH_TEMPO,
      totalAmount: 150000n,
    });
    expect(deps.cancelInvoice).not.toHaveBeenCalled();
    expect(deps.refundSaldoKredit).not.toHaveBeenCalled();
    expect(
      deps.invoiceCreation.createInvoiceForCustomer,
    ).not.toHaveBeenCalled();
  });

  it("sebagian dibayar: tagihan dibiarkan utuh", async () => {
    deps.findCycleInvoices.mockResolvedValue([
      cycleInvoice({ status: "PARTIAL_PAID", paidAmount: 50000n }),
    ]);

    const result = await newService(deps).syncCycleInvoice(input);

    expect(result).toMatchObject({ status: "KEPT", reason: "NOT_UNPAID" });
    expect(deps.cancelInvoice).not.toHaveBeenCalled();
  });

  // Subtotal yang tidak sama dengan harga paket sebelumnya berarti tagihan
  // sudah diubah tangan (item tambahan, harga khusus); menggantinya akan
  // menghapus perubahan itu.
  it("tagihan yang nominalnya sudah diubah manual dibiarkan", async () => {
    deps.findCycleInvoices.mockResolvedValue([
      cycleInvoice({ subtotal: 175000n }),
    ]);

    const result = await newService(deps).syncCycleInvoice(input);

    expect(result).toMatchObject({ status: "KEPT", reason: "PRICE_EDITED" });
    expect(deps.cancelInvoice).not.toHaveBeenCalled();
  });

  it("lebih dari satu tagihan siklus: tidak menebak mana yang diganti", async () => {
    deps.findCycleInvoices.mockResolvedValue([
      cycleInvoice(),
      cycleInvoice({ id: "inv-lain" }),
    ]);

    const result = await newService(deps).syncCycleInvoice(input);

    expect(result).toMatchObject({
      status: "KEPT",
      reason: "MULTIPLE_INVOICES",
    });
    expect(deps.cancelInvoice).not.toHaveBeenCalled();
  });

  it("paket yang berlaku sama dengan paket tagihan: tidak diganti", async () => {
    deps.invoiceCreation.withCyclePackage.mockImplementation(
      async (c: typeof customer) => c,
    );

    const result = await newService(deps).syncCycleInvoice(input);

    expect(result).toEqual({
      status: "UNCHANGED",
      invoiceId: "inv-lama",
      dueDate: JATUH_TEMPO,
      totalAmount: 150000n,
    });
    expect(deps.cancelInvoice).not.toHaveBeenCalled();
  });

  // Jadwal yang dibatalkan setelah tagihannya ditahan (mis. checkout aktif)
  // tidak pernah mengubah tagihan; pembatalan tidak boleh melaporkannya
  // sebagai tagihan yang diubah manual.
  it("tagihan yang sudah seharga paket yang berlaku tidak diganti", async () => {
    deps.findCycleInvoices.mockResolvedValue([
      cycleInvoice({ subtotal: 250000n, totalAmount: 250000n }),
    ]);

    const result = await newService(deps).syncCycleInvoice(input);

    expect(result).toMatchObject({
      status: "UNCHANGED",
      invoiceId: "inv-lama",
    });
    expect(deps.cancelInvoice).not.toHaveBeenCalled();
  });

  it("mencari tagihan dengan jatuh tempo di hari siklus itu", async () => {
    const { toEndOfDay, toStartOfDay } =
      await import("@/lib/utils/server-datetime");

    await newService(deps).syncCycleInvoice(input);

    expect(deps.findCycleInvoices).toHaveBeenCalledWith(
      PELANGGAN,
      toStartOfDay(JATUH_TEMPO),
      toEndOfDay(JATUH_TEMPO),
    );
  });
});
