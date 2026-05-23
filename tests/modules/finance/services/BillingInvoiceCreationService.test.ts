import { describe, it, expect, beforeEach, vi } from "vitest";
import { BillingInvoiceCreationService } from "@/modules/finance/services/BillingInvoiceCreationService";
import type { InvoiceRepository } from "@/modules/finance/repositories/InvoiceRepository";
import { prismaMock } from "../../../setup";

// Mock dependencies
vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    logActivity: vi.fn(() => Promise.resolve()),
    logActivitySafe: vi.fn(),
    logAuth: vi.fn(),
    apiRequest: vi.fn(),
    dbOperation: vi.fn(),
  },
}));

vi.mock("@/lib/event-bus", () => ({
  eventBus: {
    publish: vi.fn(() => Promise.resolve()),
  },
  EVENT_NAMES: {
    INVOICE_CREATED: "invoice.created",
  },
}));

const mockSyncInvoiceBillingSchedules = vi.hoisted(() =>
  vi.fn(() => Promise.resolve()),
);
const mockCancelInvoiceBillingSchedules = vi.hoisted(() =>
  vi.fn(() => Promise.resolve()),
);

vi.mock("@/modules/finance/services/billingScheduleLifecycle", () => ({
  syncInvoiceBillingSchedules: mockSyncInvoiceBillingSchedules,
  cancelInvoiceBillingSchedules: mockCancelInvoiceBillingSchedules,
}));

describe("BillingInvoiceCreationService", () => {
  let service: BillingInvoiceCreationService;
  let mockInvoiceRepo: InvoiceRepository;

  const mockCustomer = {
    id: "customer-1",
    nama: "Test Customer",
    jatuhTempo: new Date("2026-05-31"),
    userId: "user-1",
    usePPN: true,
    tenantId: null as string | null,
    hargaPaket: {
      id: "paket-1",
      name: "Paket Premium",
      harga: 500000,
      usePPN: true,
      ppnPercentage: 11,
    },
  };

  const mockInvoice = {
    id: "invoice-1",
    invoiceNumber: "INV/2026/05/05-ABC123DEF456",
    pelangganId: "customer-1",
    issueDate: new Date("2026-05-05"),
    dueDate: new Date("2026-05-31"),
    status: "SENT" as const,
    subtotal: 500000n,
    taxAmount: 55000n,
    discountAmount: 0n,
    totalAmount: 555000n,
    paidAmount: 0n,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  /** Helper untuk mengatur saldo kredit pelanggan dalam mock prisma. */
  const setSaldoKredit = (saldo: bigint) => {
    prismaMock.$queryRaw.mockResolvedValue([{ saldoKreditRupiah: saldo }]);
    prismaMock.pelanggan.update.mockResolvedValue({});
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockSyncInvoiceBillingSchedules.mockClear();
    mockCancelInvoiceBillingSchedules.mockClear();

    mockInvoiceRepo = {
      create: vi.fn(),
      findById: vi.fn(),
      update: vi.fn(),
    } as unknown as InvoiceRepository;

    service = new BillingInvoiceCreationService(mockInvoiceRepo);

    // Re-mock $transaction (global beforeEach di setup.ts reset semua mock)
    prismaMock.$transaction.mockImplementation(
      async (callback: (tx: unknown) => Promise<unknown>) => {
        if (typeof callback === "function") return callback(prismaMock);
        return callback;
      },
    );

    // Default: tidak ada saldo kredit (empty array = pelanggan tidak ditemukan atau saldo 0)
    prismaMock.$queryRaw.mockResolvedValue([]);
    prismaMock.pelanggan.update.mockResolvedValue({});
  });

  describe("createInvoiceForCustomer", () => {
    it("harus membuat invoice dengan PPN 11%", async () => {
      vi.mocked(mockInvoiceRepo.create).mockResolvedValue(mockInvoice);

      const dueDate = new Date("2026-05-31");
      const result = await service.createInvoiceForCustomer(
        mockCustomer,
        dueDate,
      );

      expect(result).toEqual(mockInvoice);
      expect(mockInvoiceRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          pelangganId: "customer-1",
          status: "SENT",
          subtotal: 500000n,
          taxAmount: 55000n, // 11% dari 500000
          discountAmount: 0n,
          totalAmount: 555000n,
          dueDate,
          invoiceItem: {
            create: [
              expect.objectContaining({
                description: "Berlangganan Internet Paket Paket Premium",
                quantity: 1,
                unitPrice: 500000n,
                totalPrice: 500000n,
                itemType: "SERVICE",
              }),
            ],
          },
        }),
      );
    });

    it("harus membuat invoice tanpa PPN jika customer tidak usePPN", async () => {
      const customerNoPPN = {
        ...mockCustomer,
        usePPN: false,
        hargaPaket: {
          ...mockCustomer.hargaPaket,
          usePPN: false,
        },
      };

      vi.mocked(mockInvoiceRepo.create).mockResolvedValue({
        ...mockInvoice,
        taxAmount: 0n,
        totalAmount: 500000n,
      });

      await service.createInvoiceForCustomer(customerNoPPN, new Date());

      expect(mockInvoiceRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          taxAmount: 0n,
          totalAmount: 500000n,
        }),
      );
    });

    it("harus generate invoice number dengan format yang benar", async () => {
      vi.mocked(mockInvoiceRepo.create).mockResolvedValue(mockInvoice);

      await service.createInvoiceForCustomer(mockCustomer, new Date());

      const createCall = vi.mocked(mockInvoiceRepo.create).mock.calls[0][0];
      const invoiceNumber = createCall.invoiceNumber as string;

      // Format: INV/YYYY/MM/DD-XXXXXXXXXXXX
      expect(invoiceNumber).toMatch(/^INV\/\d{4}\/\d{2}\/\d{2}-[A-Z0-9]{12}$/);
    });

    it("harus log activity untuk invoice creation", async () => {
      const { logger } = await import("@/lib/logger");

      vi.mocked(mockInvoiceRepo.create).mockResolvedValue(mockInvoice);

      await service.createInvoiceForCustomer(mockCustomer, new Date());

      expect(logger.logActivity).toHaveBeenCalledWith({
        action: "CREATE",
        subject: "Invoice (Auto)",
        details: expect.objectContaining({
          id: "invoice-1",
          invoiceNumber: mockInvoice.invoiceNumber,
          customer: "Test Customer",
          actor: "SYSTEM_CRON",
          creditApplied: "0",
        }),
      });
    });

    it("harus publish INVOICE_CREATED event", async () => {
      const { eventBus } = await import("@/lib/event-bus");

      vi.mocked(mockInvoiceRepo.create).mockResolvedValue(mockInvoice);

      const dueDate = new Date("2026-05-31");
      await service.createInvoiceForCustomer(mockCustomer, dueDate);

      expect(eventBus.publish).toHaveBeenCalledWith("invoice.created", {
        invoiceId: "invoice-1",
        pelangganId: "customer-1",
        amount: 555000,
        dueDate: dueDate.toISOString(),
      });
    });

    it("harus sinkronkan billing schedule setelah invoice berhasil dibuat", async () => {
      vi.mocked(mockInvoiceRepo.create).mockResolvedValue(mockInvoice);

      await service.createInvoiceForCustomer(
        mockCustomer,
        new Date("2026-05-31"),
      );

      expect(mockSyncInvoiceBillingSchedules).toHaveBeenCalledWith(mockInvoice);
    });

    it("harus calculate PPN dengan custom percentage", async () => {
      const customerCustomPPN = {
        ...mockCustomer,
        hargaPaket: {
          ...mockCustomer.hargaPaket,
          ppnPercentage: 12,
        },
      };

      vi.mocked(mockInvoiceRepo.create).mockResolvedValue({
        ...mockInvoice,
        taxAmount: 60000n, // 12% dari 500000
        totalAmount: 560000n,
      });

      await service.createInvoiceForCustomer(customerCustomPPN, new Date());

      expect(mockInvoiceRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          taxAmount: 60000n,
          totalAmount: 560000n,
        }),
      );
    });

    describe("saldo kredit konsumsi", () => {
      it("apply discount sebesar saldo kalau saldo < total", async () => {
        setSaldoKredit(30_000n);
        vi.mocked(mockInvoiceRepo.create).mockResolvedValue(mockInvoice);

        await service.createInvoiceForCustomer(mockCustomer, new Date());

        // Verify pelanggan.update dipanggil di dalam $transaction (decrement)
        expect(prismaMock.pelanggan.update).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { id: "customer-1" },
            data: { saldoKreditRupiah: { decrement: 30_000n } },
          }),
        );
        expect(mockInvoiceRepo.create).toHaveBeenCalledWith(
          expect.objectContaining({
            subtotal: 500_000n,
            taxAmount: 55_000n,
            discountAmount: 30_000n,
            totalAmount: 525_000n, // 555000 - 30000
            notes: "Saldo kredit terpakai: Rp 30000",
          }),
        );
      });

      it("cap discount = total kalau saldo > total", async () => {
        setSaldoKredit(1_000_000n);
        vi.mocked(mockInvoiceRepo.create).mockResolvedValue(mockInvoice);

        await service.createInvoiceForCustomer(mockCustomer, new Date());

        expect(prismaMock.pelanggan.update).toHaveBeenCalledWith(
          expect.objectContaining({
            data: { saldoKreditRupiah: { decrement: 555_000n } },
          }),
        );
        expect(mockInvoiceRepo.create).toHaveBeenCalledWith(
          expect.objectContaining({
            discountAmount: 555_000n,
            totalAmount: 0n,
          }),
        );
      });

      it("skip discount kalau saldo = 0", async () => {
        // Default: $queryRaw return [] (no saldo)
        vi.mocked(mockInvoiceRepo.create).mockResolvedValue(mockInvoice);

        await service.createInvoiceForCustomer(mockCustomer, new Date());

        expect(mockInvoiceRepo.create).toHaveBeenCalledWith(
          expect.objectContaining({
            discountAmount: 0n,
            totalAmount: 555_000n,
          }),
        );
      });

      it("kembalikan saldo via increment kalau create invoice gagal", async () => {
        setSaldoKredit(40_000n);
        const createError = new Error("DB error");
        vi.mocked(mockInvoiceRepo.create).mockRejectedValue(createError);

        await expect(
          service.createInvoiceForCustomer(mockCustomer, new Date()),
        ).rejects.toThrow("DB error");

        // Compensating action — saldo dikembalikan (panggilan kedua ke update)
        expect(prismaMock.pelanggan.update).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { id: "customer-1" },
            data: { saldoKreditRupiah: { increment: 40_000n } },
          }),
        );
      });
    });
  });
});
