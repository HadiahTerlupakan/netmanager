import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Kunci checkout yang sedang dipegang pelanggan dijawab dengan pesan portal
 * ("Pembayaran Anda sedang diproses di perangkat lain"); aksi admin menerima
 * pesannya sendiri, tanpa menelan penolakan 409 dari aksinya.
 */

const palsu = vi.hoisted(() => ({ withCustomerCheckoutLock: vi.fn() }));

vi.mock("@/modules/payment-gateway", () => ({
  withCustomerCheckoutLock: palsu.withCustomerCheckoutLock,
}));
vi.mock("@/lib/tenant-context", () => ({
  runAsSystemContext: (_reason: string, task: () => Promise<unknown>) => task(),
}));

import { createRouteServiceError } from "@/lib/api/route-service-error";
import { runAdminActionUnderCustomerCheckoutLock } from "@/modules/finance/services/customer-checkout-lock";

const CUSTOMER_BUSY =
  "Pembayaran Anda sedang diproses di perangkat lain. Coba lagi sebentar lagi.";

const holdsLock = (task: () => Promise<unknown>) => task();

describe("runAdminActionUnderCustomerCheckoutLock", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("kunci yang dipegang pelanggan dijawab dengan pesan untuk admin", async () => {
    palsu.withCustomerCheckoutLock.mockRejectedValue(
      createRouteServiceError(CUSTOMER_BUSY, 409),
    );
    const task = vi.fn();

    await expect(
      runAdminActionUnderCustomerCheckoutLock("cust-1", "void-invoice", task),
    ).rejects.toMatchObject({
      status: 409,
      message:
        "Pelanggan sedang memproses pembayaran untuk tagihan ini. Coba lagi beberapa saat lagi.",
    });
    expect(task).not.toHaveBeenCalled();
  });

  it("penolakan 409 dari aksinya sendiri diteruskan apa adanya", async () => {
    palsu.withCustomerCheckoutLock.mockImplementation(
      (_customerId: string, task: () => Promise<unknown>) => holdsLock(task),
    );
    const refusal = createRouteServiceError(
      "Tagihan INV-1 tidak dibatalkan karena sudah menerima pembayaran.",
      409,
    );

    await expect(
      runAdminActionUnderCustomerCheckoutLock("cust-1", "cancel-invoice", () =>
        Promise.reject(refusal),
      ),
    ).rejects.toBe(refusal);
  });

  it("hasil aksi dikembalikan bila kuncinya didapat", async () => {
    palsu.withCustomerCheckoutLock.mockImplementation(
      (_customerId: string, task: () => Promise<unknown>) => holdsLock(task),
    );

    await expect(
      runAdminActionUnderCustomerCheckoutLock("cust-1", "delete-invoice", () =>
        Promise.resolve("dihapus"),
      ),
    ).resolves.toBe("dihapus");
  });
});
