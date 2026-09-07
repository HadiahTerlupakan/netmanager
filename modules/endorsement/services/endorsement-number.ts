/**
 * Penomoran surat pengesahan: `PGS/<YYYYMM>/<urut>`.
 *
 * Urutan direset tiap bulan supaya nomornya tetap pendek dan mudah dirujuk
 * dalam percakapan. Keunikan sesungguhnya dijaga indeks unik
 * `(number, tenantId)` di database, bukan oleh fungsi ini.
 */

const PREFIX = "PGS";
const SEQUENCE_PADDING = 4;

export function buildEndorsementPeriod(date: Date = new Date()): string {
  const year = date.getUTCFullYear();
  const month = `${date.getUTCMonth() + 1}`.padStart(2, "0");

  return `${year}${month}`;
}

export function buildEndorsementNumber(
  sequence: number,
  period: string,
): string {
  return `${PREFIX}/${period}/${`${sequence}`.padStart(SEQUENCE_PADDING, "0")}`;
}

/** Ambil nomor urut dari sebuah nomor surat; 0 bila bentuknya tidak dikenali. */
export function parseEndorsementSequence(number: string): number {
  const match = /^PGS\/\d{6}\/(\d+)$/.exec(number);
  if (!match) return 0;

  return Number.parseInt(match[1]!, 10);
}

/** Nomor berikutnya untuk satu periode, dihitung dari nomor terakhir. */
export function buildNextEndorsementNumber(
  lastNumber: string | null,
  date: Date = new Date(),
): string {
  const period = buildEndorsementPeriod(date);
  const lastSequence = lastNumber?.includes(`/${period}/`)
    ? parseEndorsementSequence(lastNumber)
    : 0;

  return buildEndorsementNumber(lastSequence + 1, period);
}
