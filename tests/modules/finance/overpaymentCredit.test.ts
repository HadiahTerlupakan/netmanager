import { beforeEach, describe, expect, it, vi } from "vitest";

import { prismaMock } from "../../setup";

const palsu = vi.hoisted(() => ({ onPaymentOverpaid: vi.fn() }));

vi.mock("@/modules/events", () => ({
  BillingEventDispatcher: { onPaymentOverpaid: palsu.onPaymentOverpaid },
}));

import {
  creditOverpaidPayments,
  creditPaymentOverpayment,
} from "@/modules/finance/services/overpayment-credit";

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
  ubah: Partial<
    Pick<PaymentTagihan, "gatewayStatus" | "kelebihanBayar" | "discountAmount">
  > = {},
): PaymentTagihan => ({
  id,
  amount: TAGIHAN,
  discountAmount: 0n,
  gatewayStatus: "PAID",
  kelebihanBayar: null,
  notes: "Payment via Mobile App",
  ...ubah,
});

function tagihanDenganPembayaran(payments: PaymentTagihan[], status = "PAID") {
  // Baris payment dikunci lebih dulu untuk membaca tagihannya saat ini.
  prismaMock.$queryRaw
    .mockResolvedValueOnce([{ invoiceId: "inv-1" }] as never)
    .mockResolvedValueOnce([] as never);
  prismaMock.invoice.findUnique.mockResolvedValue({
    status,
    totalAmount: TAGIHAN,
    payment: payments,
  } as never);
}

const VA_TERLAMBAT = { id: "p-bri", pelangganId: "cust-1", tenantId: "t1" };

/**
 * VA lama tetap bisa dibayar setelah pelanggan mengganti metode (Duitku tidak
 * bisa menutupnya). Membayar keduanya dulu melunasi invoice dua kali: uang
 * kedua diterima diam-diam (INV/2026/10/30-A47FC1A7D3F4, Rp 22.200 untuk
 * tagihan Rp 11.100).
 */
describe("kelebihan bayar menjadi saldo kredit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.payment.updateMany.mockResolvedValue({ count: 1 } as never);
  });

  it("menjadi saldo kredit pelanggan dan memberi tahu pelanggan", async () => {
    tagihanDenganPembayaran([payment("p-bca"), payment("p-bri")]);

    await creditOverpaidPayments([VA_TERLAMBAT]);

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

  // Dua pelunasan telat untuk invoice yang sama bisa membaca jumlah terbayar
  // yang sama; payment lalu invoice dikunci sebelum pembayarannya dibaca.
  it("menghitung kelebihan di bawah kunci baris payment lalu invoice", async () => {
    tagihanDenganPembayaran([payment("p-bca"), payment("p-bri")]);

    await creditOverpaidPayments([VA_TERLAMBAT]);

    const [kunciPayment, kunciInvoice] = prismaMock.$queryRaw.mock.calls as [
      TemplateStringsArray,
      ...unknown[],
    ][];
    expect(kunciPayment[0].join("?")).toMatch(
      /FROM "Payment" WHERE "id" = \? FOR UPDATE/,
    );
    expect(kunciPayment.slice(1)).toEqual(["p-bri"]);
    expect(kunciInvoice[0].join("?")).toMatch(
      /FROM "Invoice" WHERE "id" = \? FOR UPDATE/,
    );
    expect(kunciInvoice.slice(1)).toEqual(["inv-1"]);
    expect(prismaMock.$queryRaw.mock.invocationCallOrder[1]).toBeLessThan(
      prismaMock.invoice.findUnique.mock.invocationCallOrder[0],
    );
  });

  it("pembayaran yang pas tidak mengubah saldo", async () => {
    tagihanDenganPembayaran([
      payment("p-bri"),
      payment("p-lama", { gatewayStatus: "CANCELLED" }),
    ]);

    await creditOverpaidPayments([VA_TERLAMBAT]);

    expect(prismaMock.payment.updateMany).not.toHaveBeenCalled();
    expect(prismaMock.pelanggan.update).not.toHaveBeenCalled();
  });

  it("kelebihan yang sudah dikreditkan tidak dikreditkan lagi (retry webhook)", async () => {
    tagihanDenganPembayaran([
      payment("p-bca"),
      payment("p-bri", { kelebihanBayar: TAGIHAN }),
    ]);

    await creditOverpaidPayments([VA_TERLAMBAT]);

    expect(prismaMock.pelanggan.update).not.toHaveBeenCalled();
    expect(palsu.onPaymentOverpaid).not.toHaveBeenCalled();
  });

  it("saldo yang gagal ditambah melepas tandanya agar retry bisa mengkreditkan", async () => {
    tagihanDenganPembayaran([payment("p-bca"), payment("p-bri")]);
    prismaMock.pelanggan.update.mockRejectedValueOnce(new Error("db down"));

    await expect(creditOverpaidPayments([VA_TERLAMBAT])).rejects.toThrow(
      "db down",
    );

    expect(prismaMock.payment.update).toHaveBeenCalledWith({
      where: { id: "p-bri" },
      data: { kelebihanBayar: null, notes: "Payment via Mobile App" },
    });
    expect(palsu.onPaymentOverpaid).not.toHaveBeenCalled();
  });

  // Tagihan batal tidak terutang: seluruh uangnya menjadi saldo, tetapi
  // potongan kupon bukan uang dan tidak ikut dikreditkan.
  it("uang untuk tagihan yang dibatalkan seluruhnya menjadi saldo, tanpa potongan kupon", async () => {
    tagihanDenganPembayaran(
      [payment("p-bri", { discountAmount: 1000n })],
      "CANCELLED",
    );

    const kredit = await creditPaymentOverpayment(VA_TERLAMBAT, {
      notify: false,
      note: (amount) => `Tagihan batal; ${amount} ke saldo`,
    });

    expect(kredit).toBe(TAGIHAN);
    expect(prismaMock.payment.updateMany).toHaveBeenCalledWith({
      where: { id: "p-bri", kelebihanBayar: null },
      data: {
        kelebihanBayar: TAGIHAN,
        notes: "Payment via Mobile App\nTagihan batal; 11100 ke saldo",
      },
    });
    expect(palsu.onPaymentOverpaid).not.toHaveBeenCalled();
  });

  it("payment yang uangnya belum diterima tidak pernah dikreditkan", async () => {
    tagihanDenganPembayaran([
      payment("p-bca"),
      payment("p-lain"),
      payment("p-bri", { gatewayStatus: "PENDING" }),
    ]);

    const kredit = await creditPaymentOverpayment(VA_TERLAMBAT, {
      notify: true,
    });

    expect(kredit).toBe(0n);
    expect(prismaMock.payment.updateMany).not.toHaveBeenCalled();
    expect(prismaMock.pelanggan.update).not.toHaveBeenCalled();
  });
});
