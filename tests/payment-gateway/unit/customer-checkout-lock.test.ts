import { beforeEach, describe, expect, it, vi } from "vitest";

const palsu = vi.hoisted(() => ({
  acquireLock: vi.fn(),
  release: vi.fn(),
}));

vi.mock("@/lib/distributed-lock", () => ({ acquireLock: palsu.acquireLock }));

import {
  tryWithCustomerCheckoutLock,
  withCustomerCheckoutLock,
} from "@/modules/payment-gateway/services/customer-checkout-lock";

describe("kunci checkout pelanggan", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    palsu.acquireLock.mockResolvedValue(palsu.release);
  });

  it("kunci checkout dipegang per pelanggan selama checkout dibuat", async () => {
    const task = vi.fn().mockResolvedValue("checkout");

    await expect(withCustomerCheckoutLock("cust-1", task)).resolves.toBe(
      "checkout",
    );

    expect(palsu.acquireLock).toHaveBeenCalledWith(
      "checkout:cust-1",
      expect.objectContaining({ ttlSeconds: 120 }),
    );
    expect(palsu.release).toHaveBeenCalledTimes(1);
  });

  it("kunci dilepas walau pembuatan checkout gagal", async () => {
    await expect(
      withCustomerCheckoutLock("cust-1", () =>
        Promise.reject(new Error("gateway")),
      ),
    ).rejects.toThrow("gateway");
    expect(palsu.release).toHaveBeenCalledTimes(1);
  });

  it("kunci yang sedang dipegang perangkat lain menolak dengan 409", async () => {
    palsu.acquireLock.mockResolvedValue(null);
    const task = vi.fn();

    await expect(
      withCustomerCheckoutLock("cust-1", task),
    ).rejects.toMatchObject({ status: 409 });
    expect(task).not.toHaveBeenCalled();
  });

  // Penyapu checkout memakai kunci yang sama tanpa galat 409: pelanggan yang
  // sibuk diurus pada putaran berikutnya.
  it("percobaan tanpa kunci tidak menjalankan tugasnya dan tidak melempar", async () => {
    palsu.acquireLock.mockResolvedValue(null);
    const task = vi.fn();

    await expect(tryWithCustomerCheckoutLock("cust-1", task)).resolves.toEqual({
      isAcquired: false,
    });
    expect(task).not.toHaveBeenCalled();
  });

  it("percobaan dengan kunci mengembalikan hasil tugas lalu melepasnya", async () => {
    await expect(
      tryWithCustomerCheckoutLock("cust-1", async () => 3),
    ).resolves.toEqual({ isAcquired: true, value: 3 });
    expect(palsu.release).toHaveBeenCalledTimes(1);
  });
});
