import { describe, expect, it } from "vitest";

import { buildInvoicePaidLines } from "@/modules/accounting/services/event-handlers/invoice-paid-lines";

const COA = {
  piutang: "piutang",
  defaultBank: "bank",
  gatewayBalance: "saldo-gateway",
  gatewayFee: "beban-gateway",
  accountCoa: new Map([["rek-bca", "coa-bca"]]),
};

const line = (coaId: string, side: "DEBIT" | "CREDIT", amount: string) => ({
  coaId,
  side,
  amount,
});

/**
 * Jurnal pelunasan dulu Debit Bank / Kredit Piutang sebesar total invoice:
 * kupon ikut dihitung uang masuk, dana gateway dicatat di Bank, dan biaya
 * gateway tidak dibukukan.
 */
describe("buildInvoicePaidLines", () => {
  it("QRIS Duitku: dana bersih ke Saldo Payment Gateway, biaya jadi beban", () => {
    expect(
      buildInvoicePaidLines(
        [{ amount: 11100n, gatewayFee: 78n, accountId: null, isGateway: true }],
        COA,
      ),
    ).toEqual([
      line("saldo-gateway", "DEBIT", "11022"),
      line("beban-gateway", "DEBIT", "78"),
      line("piutang", "CREDIT", "11100"),
    ]);
  });

  it("transfer manual masuk ke rekening yang dipilih pelanggan", () => {
    expect(
      buildInvoicePaidLines(
        [
          {
            amount: 100000n,
            gatewayFee: null,
            accountId: "rek-bca",
            isGateway: false,
          },
        ],
        COA,
      ),
    ).toEqual([
      line("coa-bca", "DEBIT", "100000"),
      line("piutang", "CREDIT", "100000"),
    ]);
  });

  // Potongan kupon sudah mengkredit Piutang lewat jurnal kupon; di sini hanya
  // uang yang dibayar pelanggan.
  it("invoice berkupon hanya mengkredit Piutang sebesar uang yang masuk", () => {
    const lines = buildInvoicePaidLines(
      [{ amount: 90000n, gatewayFee: null, accountId: null, isGateway: false }],
      COA,
    );

    expect(lines).toEqual([
      line("bank", "DEBIT", "90000"),
      line("piutang", "CREDIT", "90000"),
    ]);
  });

  it("beberapa pembayaran dijumlah per akun, refund dan nol diabaikan", () => {
    expect(
      buildInvoicePaidLines(
        [
          {
            amount: 5000n,
            gatewayFee: null,
            accountId: null,
            isGateway: false,
          },
          {
            amount: 6100n,
            gatewayFee: null,
            accountId: null,
            isGateway: false,
          },
          {
            amount: -2000n,
            gatewayFee: null,
            accountId: null,
            isGateway: false,
          },
        ],
        COA,
      ),
    ).toEqual([
      line("bank", "DEBIT", "11100"),
      line("piutang", "CREDIT", "11100"),
    ]);
  });

  it("invoice lunas seluruhnya oleh kupon tidak menghasilkan jurnal penerimaan", () => {
    expect(
      buildInvoicePaidLines(
        [{ amount: 0n, gatewayFee: null, accountId: null, isGateway: false }],
        COA,
      ),
    ).toEqual([]);
  });
});
