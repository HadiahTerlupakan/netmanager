import { beforeEach, describe, expect, it, vi } from "vitest";

const mockNotifyPackageUpgradeRequested = vi.hoisted(() => vi.fn());
const mockNotifyPackageUpgradeCancelled = vi.hoisted(() => vi.fn());

vi.mock("@/modules/notification", () => ({
  notifyPackageUpgradeRequested: (...args: unknown[]) =>
    mockNotifyPackageUpgradeRequested(...args),
  notifyPackageUpgradeCancelled: (...args: unknown[]) =>
    mockNotifyPackageUpgradeCancelled(...args),
}));
import type { IPelangganRepository } from "@/modules/pelanggan/domain/ports/IPelangganRepository";
import {
  CustomerPackageUpgradeError,
  CustomerPackageUpgradeService,
} from "@/modules/pelanggan/services/CustomerPackageUpgradeService";

const CUSTOMER_ID = "cust-1";
const CURRENT_PACKAGE_ID = "pkg-current";
const TARGET_PACKAGE_ID = "pkg-target";
const CUSTOMER_SITE_ID = "site-jakarta";
const CURRENT_PRICE = 150_000;
const NEXT_DUE_DATE = new Date("2026-10-09T00:00:00.000Z");

function buildCustomer(overrides: Record<string, unknown> = {}) {
  return {
    id: CUSTOMER_ID,
    nama: "Test Customer",
    tenantId: "tenant-1",
    status: "AKTIF",
    siteId: CUSTOMER_SITE_ID,
    jatuhTempo: NEXT_DUE_DATE,
    hargaPaketId: CURRENT_PACKAGE_ID,
    pendingPackageId: null as string | null,
    pendingPackageApplyAt: null as Date | null,
    hargaPaket: { id: CURRENT_PACKAGE_ID, name: "Basic", harga: CURRENT_PRICE },
    ...overrides,
  };
}

function buildDependencies(options: {
  customer?: Record<string, unknown>;
  candidate?: Record<string, unknown> | null;
}) {
  const applyPackageChange = vi.fn().mockResolvedValue({
    applied: false,
    prorateAmount: 0n,
    scheduledFor: NEXT_DUE_DATE,
    cycleInvoice: { status: "NOT_ISSUED" },
  });
  const syncCycleInvoiceAfterCancel = vi
    .fn()
    .mockResolvedValue({ status: "NOT_ISSUED" });
  // Clears the request in one write, only while it is still the customer's.
  const cancelCustomerRequestedPackage = vi.fn().mockResolvedValue(true);
  const repository = {
    cancelCustomerRequestedPackage,
    findByIdWithPackage: vi
      .fn()
      .mockResolvedValue(options.customer ?? buildCustomer()),
    findUpgradeCandidate: vi
      .fn()
      .mockResolvedValue(
        options.candidate === undefined
          ? { id: TARGET_PACKAGE_ID, name: "Standard", harga: 250_000 }
          : options.candidate,
      ),
  } as unknown as IPelangganRepository;

  const service = new CustomerPackageUpgradeService(repository, {
    applyPackageChange,
    syncCycleInvoiceAfterCancel,
  } as never);

  return {
    service,
    repository,
    applyPackageChange,
    syncCycleInvoiceAfterCancel,
    cancelCustomerRequestedPackage,
  };
}

async function expectUpgradeError(
  promise: Promise<unknown>,
  code: string,
): Promise<void> {
  await expect(promise).rejects.toBeInstanceOf(CustomerPackageUpgradeError);
  await promise.catch((error) => {
    expect((error as CustomerPackageUpgradeError).code).toBe(code);
  });
}

describe("CustomerPackageUpgradeService.requestUpgrade", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNotifyPackageUpgradeRequested.mockResolvedValue(undefined);
    mockNotifyPackageUpgradeCancelled.mockResolvedValue(undefined);
  });

  it("schedules the package change for the next billing cycle", async () => {
    const { service, repository, applyPackageChange } = buildDependencies({});

    const result = await service.requestUpgrade(CUSTOMER_ID, TARGET_PACKAGE_ID);

    expect(repository.findUpgradeCandidate).toHaveBeenCalledWith(
      TARGET_PACKAGE_ID,
      { minPrice: CURRENT_PRICE, siteId: CUSTOMER_SITE_ID },
    );
    expect(applyPackageChange).toHaveBeenCalledWith({
      pelangganId: CUSTOMER_ID,
      oldHargaPaketId: CURRENT_PACKAGE_ID,
      newHargaPaketId: TARGET_PACKAGE_ID,
      prorateOption: "NONE",
      downgradeAdjustment: "NONE",
      upgradeApplyTime: "NEXT_CYCLE",
      requestedByCustomer: true,
    });
    expect(result).toEqual({
      scheduledFor: NEXT_DUE_DATE,
      package: { id: TARGET_PACKAGE_ID, nama: "Standard", harga: 250_000 },
      cycleInvoice: { status: "NOT_ISSUED_YET" },
    });
  });

  // Portal menampilkan harga paket baru mulai siklus berikutnya; responsnya
  // harus mengatakan apa yang terjadi pada tagihan siklus itu supaya angka di
  // portal dan di tagihan tidak bertentangan.
  describe("tagihan siklus pertama paket baru", () => {
    it.each([
      [
        "terbit ulang dengan harga paket baru",
        {
          status: "REPRICED",
          invoiceId: "inv-baru",
          replacedInvoiceId: "inv-lama",
          dueDate: NEXT_DUE_DATE,
          totalAmount: 277_500n,
        },
        {
          status: "REISSUED",
          invoiceId: "inv-baru",
          dueDate: NEXT_DUE_DATE,
          totalAmount: 277_500,
        },
      ],
      [
        "sudah dibayar/checkout aktif: tetap harga lama",
        {
          status: "KEPT",
          reason: "ACTIVE_CHECKOUT",
          invoiceId: "inv-lama",
          dueDate: NEXT_DUE_DATE,
          totalAmount: 166_500n,
        },
        {
          status: "KEPT",
          invoiceId: "inv-lama",
          dueDate: NEXT_DUE_DATE,
          totalAmount: 166_500,
        },
      ],
      [
        "sudah seharga paket baru",
        {
          status: "UNCHANGED",
          invoiceId: "inv-lama",
          dueDate: NEXT_DUE_DATE,
          totalAmount: 277_500n,
        },
        {
          status: "UNCHANGED",
          invoiceId: "inv-lama",
          dueDate: NEXT_DUE_DATE,
          totalAmount: 277_500,
        },
      ],
      ["penyelarasan gagal", { status: "FAILED" }, { status: "UNKNOWN" }],
    ])("%s", async (_label, cycleInvoice, expected) => {
      const { service, applyPackageChange } = buildDependencies({});
      applyPackageChange.mockResolvedValue({
        applied: false,
        prorateAmount: 0n,
        scheduledFor: NEXT_DUE_DATE,
        cycleInvoice,
      });

      const result = await service.requestUpgrade(
        CUSTOMER_ID,
        TARGET_PACKAGE_ID,
      );

      expect(result.cycleInvoice).toEqual(expected);
    });
  });

  it("rejects a package that is not a valid upgrade option", async () => {
    const { service, applyPackageChange } = buildDependencies({
      candidate: null,
    });

    await expectUpgradeError(
      service.requestUpgrade(CUSTOMER_ID, TARGET_PACKAGE_ID),
      "PACKAGE_NOT_AVAILABLE",
    );
    expect(applyPackageChange).not.toHaveBeenCalled();
  });

  it("rejects when an upgrade is already pending", async () => {
    const { service, applyPackageChange } = buildDependencies({
      customer: buildCustomer({
        pendingPackageId: "pkg-other",
        pendingPackageApplyAt: NEXT_DUE_DATE,
      }),
    });

    await expectUpgradeError(
      service.requestUpgrade(CUSTOMER_ID, TARGET_PACKAGE_ID),
      "UPGRADE_ALREADY_PENDING",
    );
    expect(applyPackageChange).not.toHaveBeenCalled();
  });

  it("rejects when the customer service is not active", async () => {
    const { service, applyPackageChange } = buildDependencies({
      customer: buildCustomer({ status: "ISOLIR" }),
    });

    await expectUpgradeError(
      service.requestUpgrade(CUSTOMER_ID, TARGET_PACKAGE_ID),
      "CUSTOMER_NOT_ACTIVE",
    );
    expect(applyPackageChange).not.toHaveBeenCalled();
  });

  it("notifies the staff who can act on the request", async () => {
    const { service } = buildDependencies({});

    await service.requestUpgrade(CUSTOMER_ID, TARGET_PACKAGE_ID);

    expect(mockNotifyPackageUpgradeRequested).toHaveBeenCalledWith({
      customerId: CUSTOMER_ID,
      customerName: "Test Customer",
      currentPackageName: "Basic",
      targetPackageName: "Standard",
      applyAt: NEXT_DUE_DATE,
      siteId: CUSTOMER_SITE_ID,
      tenantId: "tenant-1",
    });
  });

  it("still succeeds when the notification fails", async () => {
    mockNotifyPackageUpgradeRequested.mockRejectedValueOnce(
      new Error("smtp down"),
    );
    const { service } = buildDependencies({});

    const result = await service.requestUpgrade(CUSTOMER_ID, TARGET_PACKAGE_ID);

    expect(result.scheduledFor).toEqual(NEXT_DUE_DATE);
  });
});

describe("CustomerPackageUpgradeService.cancelUpgrade", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNotifyPackageUpgradeCancelled.mockResolvedValue(undefined);
  });

  it("clears the pending upgrade and notifies staff", async () => {
    const { service, cancelCustomerRequestedPackage } = buildDependencies({
      customer: buildCustomer({
        pendingPackageId: TARGET_PACKAGE_ID,
        pendingPackageApplyAt: NEXT_DUE_DATE,
        pendingPackageByCustomer: true,
        pendingPackage: { id: TARGET_PACKAGE_ID, name: "Standard" },
      }),
    });

    const result = await service.cancelUpgrade(CUSTOMER_ID);

    expect(cancelCustomerRequestedPackage).toHaveBeenCalledWith(CUSTOMER_ID);
    expect(result).toEqual({ cancelled: true });
    expect(mockNotifyPackageUpgradeCancelled).toHaveBeenCalledWith({
      customerId: CUSTOMER_ID,
      customerName: "Test Customer",
      targetPackageName: "Standard",
      siteId: CUSTOMER_SITE_ID,
      tenantId: "tenant-1",
    });
  });

  it("returns the cycle invoice to the current package after clearing", async () => {
    const {
      service,
      cancelCustomerRequestedPackage,
      syncCycleInvoiceAfterCancel,
    } = buildDependencies({
      customer: buildCustomer({
        pendingPackageId: TARGET_PACKAGE_ID,
        pendingPackageApplyAt: NEXT_DUE_DATE,
        pendingPackageByCustomer: true,
        pendingPackage: { id: TARGET_PACKAGE_ID, name: "Standard" },
      }),
    });
    const urutan: string[] = [];
    cancelCustomerRequestedPackage.mockImplementation(async () => {
      urutan.push("cancel");
      return true;
    });
    syncCycleInvoiceAfterCancel.mockImplementation(async () => {
      urutan.push("sync");
      return { status: "REPRICED" };
    });

    await service.cancelUpgrade(CUSTOMER_ID);

    expect(syncCycleInvoiceAfterCancel).toHaveBeenCalledWith({
      pelangganId: CUSTOMER_ID,
      cancelledPackageId: TARGET_PACKAGE_ID,
      applyAt: NEXT_DUE_DATE,
    });
    expect(urutan).toEqual(["cancel", "sync"]);
  });

  // Staff can schedule any change, a downgrade included; the customer's
  // cancel button must not undo it.
  it("refuses to cancel a change staff scheduled", async () => {
    const { service, cancelCustomerRequestedPackage } = buildDependencies({
      customer: buildCustomer({
        pendingPackageId: "pkg-lebih-murah",
        pendingPackageApplyAt: NEXT_DUE_DATE,
        pendingPackageByCustomer: false,
        pendingPackage: { id: "pkg-lebih-murah", name: "Hemat" },
      }),
    });

    await expectUpgradeError(
      service.cancelUpgrade(CUSTOMER_ID),
      "PACKAGE_CHANGE_BY_STAFF",
    );
    expect(cancelCustomerRequestedPackage).not.toHaveBeenCalled();
    expect(mockNotifyPackageUpgradeCancelled).not.toHaveBeenCalled();
  });

  // Staff may replace the request between the read and the write; the clear
  // itself must refuse then, not the earlier read.
  it("refuses when staff replaced the request before it was cleared", async () => {
    const {
      service,
      cancelCustomerRequestedPackage,
      syncCycleInvoiceAfterCancel,
    } = buildDependencies({
      customer: buildCustomer({
        pendingPackageId: TARGET_PACKAGE_ID,
        pendingPackageApplyAt: NEXT_DUE_DATE,
        pendingPackageByCustomer: true,
        pendingPackage: { id: TARGET_PACKAGE_ID, name: "Standard" },
      }),
    });
    cancelCustomerRequestedPackage.mockResolvedValue(false);

    await expectUpgradeError(
      service.cancelUpgrade(CUSTOMER_ID),
      "PACKAGE_CHANGE_BY_STAFF",
    );
    expect(mockNotifyPackageUpgradeCancelled).not.toHaveBeenCalled();
    expect(syncCycleInvoiceAfterCancel).not.toHaveBeenCalled();
  });

  it("rejects when there is nothing to cancel", async () => {
    const { service, cancelCustomerRequestedPackage } = buildDependencies({});

    await expectUpgradeError(
      service.cancelUpgrade(CUSTOMER_ID),
      "NO_PENDING_UPGRADE",
    );
    expect(cancelCustomerRequestedPackage).not.toHaveBeenCalled();
  });
});
