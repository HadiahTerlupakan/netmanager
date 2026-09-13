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
  });
  const cancelPendingPackage = vi.fn().mockResolvedValue({
    id: CUSTOMER_ID,
    found: true,
    hasPendingPackage: true,
  });
  const repository = {
    cancelPendingPackage,
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
  } as never);

  return { service, repository, applyPackageChange, cancelPendingPackage };
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
    });
    expect(result).toEqual({
      scheduledFor: NEXT_DUE_DATE,
      package: { id: TARGET_PACKAGE_ID, nama: "Standard", harga: 250_000 },
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
    const { service, cancelPendingPackage } = buildDependencies({
      customer: buildCustomer({
        pendingPackageId: TARGET_PACKAGE_ID,
        pendingPackageApplyAt: NEXT_DUE_DATE,
        pendingPackage: { id: TARGET_PACKAGE_ID, name: "Standard" },
      }),
    });

    const result = await service.cancelUpgrade(CUSTOMER_ID);

    expect(cancelPendingPackage).toHaveBeenCalledWith(CUSTOMER_ID);
    expect(result).toEqual({ cancelled: true });
    expect(mockNotifyPackageUpgradeCancelled).toHaveBeenCalledWith({
      customerId: CUSTOMER_ID,
      customerName: "Test Customer",
      targetPackageName: "Standard",
      siteId: CUSTOMER_SITE_ID,
      tenantId: "tenant-1",
    });
  });

  it("rejects when there is nothing to cancel", async () => {
    const { service, cancelPendingPackage } = buildDependencies({});

    await expectUpgradeError(
      service.cancelUpgrade(CUSTOMER_ID),
      "NO_PENDING_UPGRADE",
    );
    expect(cancelPendingPackage).not.toHaveBeenCalled();
  });
});
