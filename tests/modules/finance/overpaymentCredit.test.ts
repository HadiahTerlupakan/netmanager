import { beforeEach, describe, expect, it, vi } from "vitest";

import { prismaMock } from "../../setup";

const palsu = vi.hoisted(() => ({ onPaymentOverpaid: vi.fn() }));

vi.mock("@/modules/events", () => ({
  BillingEventDispatcher: { onPaymentOverpaid: palsu.onPaymentOverpaid },
}));

import { creditCheckoutOverpayment } from "@/modules/payment-gateway/services/overpayment-credit";

const TAGIHAN = 11100n;

type PaymentTagihan = {
  id: string;
  amount: bigint;
  discountAmount: bigint;
  gatewayStatus: string | null;
  kelebihanBayar: bigint | null;
  notes: string;
};

const payment = (
  id: string,
  ubah: Partial<Pick<PaymentTagihan, "gatewayStatus" | "kelebihanBayar">> = {},
): PaymentTagihan => ({
  id,
  amount: TAGIHAN,
  discountAmount: 0n,
  gatewayStatus: "PAID",
  kelebihanBayar: null,
  notes: "Payment via Mobile App",
  ...ubah,
});

function tagihanDenganPembayaran(payments: PaymentTagihan[]) {
  prismaMock.invoice.findUnique.mockResolvedValue({
    id: "inv-1",
    invoiceNumber: "INV-1",
    totalAmount: TAGIHAN,
    payment: payments,
  } as never);
}

const CHECKOUT_TERLAMBAT = [
  {
    id: "p-bri",
    amount: TAGIHAN,
    invoiceId: "inv-1",
    tenantId: "t1",
    couponUsageId: null as string | null,
    couponId: null as string | null,
    pelangganId: "cust-1",
  },
];

/**
 * VA lama tetap bisa dibayar setelah pelanggan mengganti metode (Duitku tidak
 * bisa menutupnya). Membayar keduanya dulu melunasi invoice dua kali: uang
 * kedua diterima diam-diam (INV/2026/10/30-A47FC1A7D3F4, Rp 22.200 untuk
 * tagihan Rp 11.100).
 */
describe("kelebihan bayar dari checkout yang terlanjur dibayar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.payment.updateMany.mockResolvedValue({ count: 1 } as never);
  });

  it("menjadi saldo kredit pelanggan dan memberi tahu pelanggan", async () => {
    tagihanDenganPembayaran([payment("p-bca"), payment("p-bri")]);

    await creditCheckoutOverpayment(CHECKOUT_TERLAMBAT);

    expect(prismaMock.payment.updateMany).toHaveBeenCalledWith({
      where: { id: "p-bri", kelebihanBayar: null },
      data: {
        kelebihanBayar: TAGIHAN,
        notes: expect.stringMatching(
          /^Payment via Mobile App.*kelebihan bayar Rp 11\.100.*saldo kredit/is,
        ),
      },
    });
    expect(prismaMock.pelanggan.update).toHaveBeenCalledWith({
      where: { id: "cust-1" },
      data: { saldoKreditRupiah: { increment: TAGIHAN } },
    });
    expect(palsu.onPaymentOverpaid).toHaveBeenCalledWith({
      invoiceId: "inv-1",
      pelangganId: "cust-1",
      amount: 11100,
      tenantId: "t1",
    });
  });

  it("pembayaran yang pas tidak mengubah saldo", async () => {
    tagihanDenganPembayaran([
      payment("p-bri"),
      payment("p-lama", { gatewayStatus: "CANCELLED" }),
    ]);

    await creditCheckoutOverpayment(CHECKOUT_TERLAMBAT);

    expect(prismaMock.payment.updateMany).not.toHaveBeenCalled();
    expect(prismaMock.pelanggan.update).not.toHaveBeenCalled();
  });

  it("kelebihan yang sudah dikreditkan tidak dikreditkan lagi (retry webhook)", async () => {
    tagihanDenganPembayaran([
      payment("p-bca"),
      payment("p-bri", { kelebihanBayar: TAGIHAN }),
    ]);

    await creditCheckoutOverpayment(CHECKOUT_TERLAMBAT);

    expect(prismaMock.pelanggan.update).not.toHaveBeenCalled();
    expect(palsu.onPaymentOverpaid).not.toHaveBeenCalled();
  });

  it("saldo yang gagal ditambah melepas tandanya agar retry bisa mengkreditkan", async () => {
    tagihanDenganPembayaran([payment("p-bca"), payment("p-bri")]);
    prismaMock.pelanggan.update.mockRejectedValueOnce(new Error("db down"));

    await expect(creditCheckoutOverpayment(CHECKOUT_TERLAMBAT)).rejects.toThrow(
      "db down",
    );

    expect(prismaMock.payment.update).toHaveBeenCalledWith({
      where: { id: "p-bri" },
      data: { kelebihanBayar: null, notes: "Payment via Mobile App" },
    });
    expect(palsu.onPaymentOverpaid).not.toHaveBeenCalled();
  });
});
