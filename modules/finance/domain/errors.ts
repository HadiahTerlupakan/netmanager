/** Kesalahan domain untuk operasi kas & bank. */

/** Saldo akun sumber tidak mencukupi untuk ditarik sebesar `requested`. */
export class InsufficientBalanceError extends Error {
  constructor(
    readonly accountId: string,
    readonly requested: number,
    readonly available: number,
  ) {
    super("Saldo tidak cukup untuk melakukan transfer");
    this.name = "InsufficientBalanceError";
  }
}

/** Akun kas/bank yang dirujuk tidak ada (atau di luar tenant pemanggil). */
export class FinancialAccountNotFoundError extends Error {
  constructor(readonly accountId: string) {
    super("Akun keuangan tidak ditemukan");
    this.name = "FinancialAccountNotFoundError";
  }
}
