import { describe, it, expect, beforeEach, vi } from "vitest";
import { BillingInvoiceCreationService } from "@/modules/finance/services/BillingInvoiceCreationService";
import type { InvoiceRepository } from "@/modules/finance/repositories/InvoiceRepository";
import type { AttendanceSettingsService } from "@/modules/attendance";

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

vi.mock("@/modules/notification", () => ({
  sendCustomerPushNotification: vi.fn(() => Promise.resolve()),
}));

vi.mock("@/modules/finance/utils/customerFinanceNotifications", () => ({
  notifyCustomerFinanceNotification: vi.fn(() => Promise.resolve()),
}));

vi.mock("@/lib/event-bus", () => ({
  eventBus: {
    publish: vi.fn(() => Promise.resolve()),
  },
  EVENT_NAMES: {
    INVOICE_CREATED: "invoice.created",
  },
}));

describe("BillingInvoiceCreationService", () => {
  let service: BillingInvoiceCreationService;
  let mockInvoiceRepo: InvoiceRepository;
  let mockSettingsRepo: AttendanceSettingsService;

  const mockCustomer = {
    id: "customer-1",
    nama: "Test Customer",
    jatuhTempo: new Date("2026-05-31"),
    userId: "user-1",
    usePPN: true,
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

  beforeEach(() => {
    vi.clearAllMocks();

    mockInvoiceRepo = {
      create: vi.fn(),
      findById: vi.fn(),
      update: vi.fn(),
    } as unknown as InvoiceRepository;

    mockSettingsRepo = {
      findByKey: vi.fn(),
    } as unknown as AttendanceSettingsService;

    service = new BillingInvoiceCreationService(
      mockInvoiceRepo,
      mockSettingsRepo,
    );
  });

  describe("createInvoiceForCustomer", () => {
    it("harus membuat invoice dengan PPN 11%", async () => {
      vi.mocked(mockInvoiceRepo.create).mockResolvedValue(mockInvoice);
      vi.mocked(mockSettingsRepo.findByKey).mockResolvedValue({
        key: "GENERAL_NOTIF_APP",
        value: "true",
      } as never);

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

    it("harus mengirim notifikasi ke customer", async () => {
      const { notifyCustomerFinanceNotification } =
        await import("@/modules/finance/utils/customerFinanceNotifications");

      vi.mocked(mockInvoiceRepo.create).mockResolvedValue(mockInvoice);
      vi.mocked(mockSettingsRepo.findByKey).mockResolvedValue({
        key: "GENERAL_NOTIF_APP",
        value: "true",
      } as never);

      const dueDate = new Date("2026-05-31");
      await service.createInvoiceForCustomer(mockCustomer, dueDate);

      expect(notifyCustomerFinanceNotification).toHaveBeenCalledWith({
        userId: "user-1",
        title: "Tagihan Baru Tersedia",
        message: expect.stringContaining("Tagihan bulan ini sebesar"),
        link: "/tagihan",
        sourceType: "INVOICE",
        sourceId: "invoice-1",
        priority: "NORMAL",
      });
    });

    it("harus mengirim push notification jika setting enabled", async () => {
      const { sendCustomerPushNotification } =
        await import("@/modules/notification");

      vi.mocked(mockInvoiceRepo.create).mockResolvedValue(mockInvoice);
      vi.mocked(mockSettingsRepo.findByKey).mockResolvedValue({
        key: "GENERAL_NOTIF_APP",
        value: "true",
      } as never);

      await service.createInvoiceForCustomer(mockCustomer, new Date());

      expect(sendCustomerPushNotification).toHaveBeenCalledWith(
        "customer-1",
        "Tagihan Baru Tersedia",
        expect.any(String),
        {
          type: "INVOICE_GENERATED",
          invoiceId: "invoice-1",
          url: "/(customer)/tagihan",
        },
      );
    });

    it("harus skip push notification jika setting disabled", async () => {
      const { sendCustomerPushNotification } =
        await import("@/modules/notification");

      vi.mocked(mockInvoiceRepo.create).mockResolvedValue(mockInvoice);
      vi.mocked(mockSettingsRepo.findByKey).mockResolvedValue({
        key: "GENERAL_NOTIF_APP",
        value: "false",
      } as never);

      await service.createInvoiceForCustomer(mockCustomer, new Date());

      expect(sendCustomerPushNotification).not.toHaveBeenCalled();
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

    it("harus handle error saat notification gagal tanpa throw", async () => {
      const { notifyCustomerFinanceNotification } =
        await import("@/modules/finance/utils/customerFinanceNotifications");
      const { logger } = await import("@/lib/logger");

      vi.mocked(mockInvoiceRepo.create).mockResolvedValue(mockInvoice);
      vi.mocked(notifyCustomerFinanceNotification).mockRejectedValue(
        new Error("Notification failed"),
      );

      // Should not throw
      await expect(
        service.createInvoiceForCustomer(mockCustomer, new Date()),
      ).resolves.toBeDefined();

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining("Failed to send notification"),
        expect.any(Error),
      );
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
  });
});
