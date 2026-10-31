const SALDO_KREDIT_NOTE_PATTERN = /Saldo kredit terpakai: Rp (\d+)/;

/** Catatan tagihan yang mencatat saldo kredit yang dipakainya saat terbit. */
export function formatSaldoKreditNote(amount: bigint): string {
  return `Saldo kredit terpakai: Rp ${amount.toString()}`;
}

/**
 * Saldo kredit yang dipakai tagihan saat terbit, dibaca dari catatan yang
 * ditulis `formatSaldoKreditNote` dan dibatasi potongan tagihannya. Potongan
 * lain (diskon manual admin pada tagihan buatan admin) bukan saldo, jadi
 * tidak pernah dikembalikan atau disebut sebagai saldo.
 */
export function readSaldoKreditUsed(invoice: {
  notes?: string | null;
  discountAmount: bigint;
}): bigint {
  const match = invoice.notes?.match(SALDO_KREDIT_NOTE_PATTERN);
  if (!match) return 0n;
  const recorded = BigInt(match[1]);
  const discount = BigInt(invoice.discountAmount);
  return recorded < discount ? recorded : discount;
}
