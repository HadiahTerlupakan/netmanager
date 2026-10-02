import { formatInTimeZone } from "date-fns-tz";

import { getTimezoneSync } from "@/lib/utils/get-timezone";

const PAD_CHAR = "0";
const FORMAT_TANGGAL_NOMOR = "yyyyMMdd";

/**
 * Membuat nomor dokumen harian dengan format existing prefix-YYYYMMDD-SEQ.
 * Tanggal mengikuti zona waktu tenant — sama dengan batas "hari ini" pada
 * penghitung urutan (`toStartOfDay`) — agar urutan yang direset tengah malam
 * lokal tidak bentrok dengan nomor kemarin (tanggal UTC tertinggal s.d. 7 jam).
 */
export function formatDailyDocumentNumber(params: {
  prefix: string;
  date: Date;
  count: number;
  sequenceWidth: number;
  timezone?: string;
}): string {
  const dateStr = formatInTimeZone(params.date, params.timezone ?? getTimezoneSync(), FORMAT_TANGGAL_NOMOR);
  const sequence = String(params.count + 1).padStart(
    params.sequenceWidth,
    PAD_CHAR,
  );

  return `${params.prefix}-${dateStr}-${sequence}`;
}

const PREFIX_TIKET = "TKT";
const LEBAR_URUTAN_TIKET = 5;

/** Nomor tiket keluhan harian (TKT-YYYYMMDD-00001); `count` = tiket hari ini sejauh ini. */
export function formatNomorTiket(count: number, date = new Date()): string {
  return formatDailyDocumentNumber({ prefix: PREFIX_TIKET, date, count, sequenceWidth: LEBAR_URUTAN_TIKET });
}
