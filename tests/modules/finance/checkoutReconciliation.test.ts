import { beforeEach, describe, expect, it, vi } from "vitest";

import { prismaMock } from "../../setup";

const palsu = vi.hoisted(() => ({
  checkStatus: vi.fn(),
  settle: vi.fn(),
}));

vi.mock("@/modules/payment-gateway/services/PaymentGatewayService", () => ({
  PaymentGatewayManager: class {
    checkPaymentStatus = palsu.checkStatus;
  },
}));

vi.mock("@/modules/payment-gateway/services/gateway-status-settlement", () => ({
  settleCheckoutPaidAtGateway: palsu.settle,
}));

import {
  reconcileCheckout,
  selectGatewayOrderPayment,
} from "@/modules/payment-gateway/services/checkout-reconciliation";
import { GatewayTransactionNotFoundError } from "@/modules/payment-gateway/services/provider-interface";

const payment = (id: string, reference: string) => ({
  id,
  reference,
  gatewayProvider: "BC",
  tenantId: "t1",
});

/**
 * Penyapu checkout dulu menutup checkout yang lewat batas waktu tanpa
 * bertanya ke gateway, sehingga pembayaran yang callback-nya hilang dicatat
 * kedaluwarsa dan pelanggannya diberi tahu "pembayaran gagal".
 */
describe("rekonsiliasi checkout dengan gateway", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    palsu.settle.mockResolvedValue(true);
    prismaMock.payment.findMany.mockResolvedValue([]);
  });

  // Checkout lama memakai payment Rp 0 (PAID sejak dibuat) sebagai orderId;
  // tanpa payment itu, reference yang ditanyakan tidak dikenal gateway.
  it("orderId pada payment checkout yang sudah PAID tetap ditanyakan", async () => {
    prismaMock.payment.findMany
      .mockResolvedValueOnce([{ checkoutId: "c1" }])
      .mockResolvedValueOnce([payment("p0", "PAY-0"), payment("p1", "PAY-a")]);
    palsu.checkStatus.mockResolvedValue({ status: "PAID", amount: 100000 });

    await expect(reconcileCheckout([payment("p1", "PAY-a")])).resolves.toEqual({
      outcome: "PAID",
    });
    expect(palsu.checkStatus.mock.calls[0][1]).toBe("PAY-0");
    expect(palsu.settle).toHaveBeenCalledWith(
      expect.objectContaining({ paymentId: "p0" }),
    );
  });

  it("menanyakan orderId checkout lebih dulu: reference terkecil", async () => {
    palsu.checkStatus.mockResolvedValue({ status: "PENDING" });

    await reconcileCheckout([payment("p2", "PAY-b"), payment("p1", "PAY-a")]);

    expect(palsu.checkStatus.mock.calls).toEqual([
      ["DUITKU", "PAY-a", "t1", {}],
    ]);
    expect(
      selectGatewayOrderPayment([
        payment("p2", "PAY-b"),
        payment("p1", "PAY-a"),
      ])?.id,
    ).toBe("p1");
  });

  it("checkout yang sudah dibayar dilunasi lewat jalur yang sama dengan webhook", async () => {
    const paid = { orderId: "PAY-a", status: "PAID", amount: 100000 };
    palsu.checkStatus.mockResolvedValue(paid);

    await expect(reconcileCheckout([payment("p1", "PAY-a")])).resolves.toEqual({
      outcome: "PAID",
    });
    expect(palsu.settle).toHaveBeenCalledWith({
      paymentId: "p1",
      status: paid,
    });
  });

  // Checkout lama (sebelum orderId dipilih dari reference terkecil) bisa
  // terdaftar di gateway dengan reference lain.
  it("reference yang tidak dikenal gateway dilewati ke reference berikutnya", async () => {
    palsu.checkStatus
      .mockRejectedValueOnce(new GatewayTransactionNotFoundError("not found"))
      .mockResolvedValueOnce({ status: "PAID", amount: 200000 });

    await expect(
      reconcileCheckout([payment("p1", "PAY-a"), payment("p2", "PAY-b")]),
    ).resolves.toEqual({ outcome: "PAID" });
    expect(palsu.settle).toHaveBeenCalledWith(
      expect.objectContaining({ paymentId: "p2" }),
    );
  });

  it("gateway yang tidak bisa ditanya membuat status tidak diketahui", async () => {
    palsu.checkStatus.mockRejectedValue(new Error("connect ETIMEDOUT"));

    await expect(
      reconcileCheckout([payment("p1", "PAY-a"), payment("p2", "PAY-b")]),
    ).resolves.toEqual({ outcome: "UNKNOWN" });
    expect(palsu.checkStatus).toHaveBeenCalledTimes(1);
    expect(palsu.settle).not.toHaveBeenCalled();
  });

  // Snap Midtrans yang ditinggalkan sebelum kanal dipilih tidak pernah ada
  // di Core API; tanpa ini checkout-nya menunggu selamanya.
  it("gateway yang tidak mengenal satu pun orderId berarti belum dibayar", async () => {
    palsu.checkStatus.mockRejectedValue(
      new GatewayTransactionNotFoundError("not found"),
    );

    await expect(
      reconcileCheckout([payment("p1", "PAY-a"), payment("p2", "PAY-b")]),
    ).resolves.toEqual({ outcome: "UNPAID", gatewayStatus: "EXPIRED" });
    expect(palsu.checkStatus).toHaveBeenCalledTimes(2);
  });

  it("checkout tanpa reference atau gateway tidak bisa ditanyakan", async () => {
    await expect(
      reconcileCheckout([
        { ...payment("p1", "PAY-a"), gatewayProvider: null as string | null },
      ]),
    ).resolves.toEqual({ outcome: "UNKNOWN" });
    expect(palsu.checkStatus).not.toHaveBeenCalled();
  });

  it.each(["PENDING", "EXPIRED", "CANCELLED", "FAILED"])(
    "status %s berarti belum dibayar",
    async (status) => {
      palsu.checkStatus.mockResolvedValue({ status });

      await expect(
        reconcileCheckout([payment("p1", "PAY-a")]),
      ).resolves.toEqual({ outcome: "UNPAID", gatewayStatus: status });
      expect(palsu.settle).not.toHaveBeenCalled();
    },
  );

  it("pelunasan yang ditolak (nominal berbeda) tidak dianggap lunas maupun belum dibayar", async () => {
    palsu.checkStatus.mockResolvedValue({ status: "PAID", amount: 1 });
    palsu.settle.mockResolvedValue(false);

    await expect(reconcileCheckout([payment("p1", "PAY-a")])).resolves.toEqual({
      outcome: "UNKNOWN",
    });
  });

  it("batas waktu pemanggil diteruskan ke gateway", async () => {
    palsu.checkStatus.mockResolvedValue({ status: "PENDING" });

    await reconcileCheckout([payment("p1", "PAY-a")], { timeoutMs: 10_000 });

    expect(palsu.checkStatus).toHaveBeenCalledWith("DUITKU", "PAY-a", "t1", {
      timeoutMs: 10_000,
    });
  });
});
