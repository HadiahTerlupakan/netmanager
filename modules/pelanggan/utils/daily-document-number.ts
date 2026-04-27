const PAD_CHAR = "0";

/** Membuat nomor dokumen harian dengan format existing prefix-YYYYMMDD-SEQ. */
export function formatDailyDocumentNumber(params: {
  prefix: string;
  date: Date;
  count: number;
  sequenceWidth: number;
}): string {
  const dateStr = params.date.toISOString().slice(0, 10).replace(/-/g, "");
  const sequence = String(params.count + 1).padStart(
    params.sequenceWidth,
    PAD_CHAR,
  );

  return `${params.prefix}-${dateStr}-${sequence}`;
}
