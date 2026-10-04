import type {
  LegalDocumentEntity,
  LegalDocumentStatus,
  LegalObligationEntity,
} from "./entities/LegalDocument";

/**
 * Aturan modul legal — fungsi murni, tanpa I/O.
 *
 * Semua perhitungan hari memakai tanggal kalender WIB, supaya "H-7" berarti
 * tujuh hari kalender bagi admin di Indonesia, bukan selisih 7×24 jam UTC.
 */

/** Dokumen dianggap "segera berakhir" mulai 90 hari sebelum tanggal berakhir. */
export const SOON_WINDOW_DAYS = 90;

/** Ambang pengingat (hari sebelum tenggat), dari yang paling longgar. */
export const REMINDER_THRESHOLDS = [90, 30, 7, 0] as const;

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const DAYS_PER_WEEK = 7;
const ISO_THURSDAY_OFFSET = 3;

export type DeadlineKind = "END" | "NOTICE" | "GUARANTEE" | "OBLIGATION";

export interface LegalDeadline {
  kind: DeadlineKind;
  date: Date;
  daysLeft: number;
  /** Kunci stabil untuk idempotensi pengingat, mis. "END:2026-12-31". */
  key: string;
  label: string;
}

/** Nomor hari kalender WIB (hari sejak epoch). */
export function toWibDayNumber(date: Date): number {
  return Math.floor((date.getTime() + WIB_OFFSET_MS) / MS_PER_DAY);
}

/** Selisih hari kalender WIB dari `now` ke `date` (negatif = sudah lewat). */
export function daysUntil(date: Date, now: Date): number {
  return toWibDayNumber(date) - toWibDayNumber(now);
}

/** Tanggal kalender WIB dalam format YYYY-MM-DD. */
export function toWibDateKey(date: Date): string {
  return new Date(date.getTime() + WIB_OFFSET_MS).toISOString().slice(0, 10);
}

/** Status dokumen, diturunkan dari tanggal dan riwayatnya. */
export function deriveStatus(
  document: Pick<LegalDocumentEntity, "terminatedAt" | "renewedById" | "endDate">,
  now: Date = new Date(),
): LegalDocumentStatus {
  if (document.terminatedAt) return "DIAKHIRI";
  if (document.renewedById) return "DIPERPANJANG";
  if (!document.endDate) return "AKTIF";

  const daysLeft = daysUntil(document.endDate, now);
  if (daysLeft < 0) return "KEDALUWARSA";
  if (daysLeft <= SOON_WINDOW_DAYS) return "SEGERA_BERAKHIR";

  return "AKTIF";
}

/** Dokumen yang tenggatnya masih perlu dipantau (belum diakhiri/diperpanjang). */
export function isMonitored(
  document: Pick<LegalDocumentEntity, "terminatedAt" | "renewedById">,
): boolean {
  return !document.terminatedAt && !document.renewedById;
}

function addMonths(date: Date, months: number): Date {
  const next = new Date(date);
  next.setUTCMonth(next.getUTCMonth() + months);
  return next;
}

/**
 * Jatuh tempo berikutnya sebuah kewajiban. Kewajiban berulang yang sudah
 * lewat dimajukan per bulan/tahun sampai jatuh di hari ini atau sesudahnya.
 */
export function nextObligationDate(
  obligation: Pick<LegalObligationEntity, "dueDate" | "recurrence">,
  now: Date,
): Date {
  if (obligation.recurrence === "NONE") return obligation.dueDate;

  const stepMonths = obligation.recurrence === "MONTHLY" ? 1 : 12;
  let occurrence = obligation.dueDate;
  while (daysUntil(occurrence, now) < 0) {
    occurrence = addMonths(occurrence, stepMonths);
  }

  return occurrence;
}

function subtractDays(date: Date, days: number): Date {
  return new Date(date.getTime() - days * MS_PER_DAY);
}

function buildDeadline(
  kind: DeadlineKind,
  date: Date,
  label: string,
  now: Date,
  keySuffix = "",
): LegalDeadline {
  return {
    kind,
    date,
    daysLeft: daysUntil(date, now),
    key: `${kind}${keySuffix}:${toWibDateKey(date)}`,
    label,
  };
}

/**
 * Semua tenggat dokumen yang masih dipantau: tanggal berakhir, batas
 * pemberitahuan (tanggal berakhir − masa pemberitahuan), berakhirnya jaminan,
 * dan jatuh tempo berikutnya tiap kewajiban.
 */
export function listDeadlines(
  document: Pick<
    LegalDocumentEntity,
    | "terminatedAt"
    | "renewedById"
    | "endDate"
    | "noticePeriodDays"
    | "isAutoRenew"
    | "guaranteeEndDate"
    | "obligations"
  >,
  now: Date = new Date(),
): LegalDeadline[] {
  if (!isMonitored(document)) return [];

  const deadlines: LegalDeadline[] = [];
  if (document.endDate) {
    deadlines.push(buildDeadline("END", document.endDate, "Masa berlaku berakhir", now));
  }
  if (document.endDate && document.noticePeriodDays) {
    deadlines.push(
      buildDeadline(
        "NOTICE",
        subtractDays(document.endDate, document.noticePeriodDays),
        document.isAutoRenew
          ? "Batas pemberitahuan — lewat dari ini kontrak diperpanjang otomatis"
          : "Batas pemberitahuan ke pihak lain",
        now,
      ),
    );
  }
  if (document.guaranteeEndDate) {
    deadlines.push(
      buildDeadline("GUARANTEE", document.guaranteeEndDate, "Jaminan berakhir", now),
    );
  }
  for (const obligation of document.obligations) {
    deadlines.push(
      buildDeadline(
        "OBLIGATION",
        nextObligationDate(obligation, now),
        obligation.description,
        now,
        `:${obligation.id}`,
      ),
    );
  }

  return deadlines;
}

/**
 * Ambang pengingat yang berlaku untuk sisa hari tertentu: ambang terketat yang
 * sudah terlampaui. Dokumen yang baru diinput 20 hari sebelum tenggat langsung
 * mendapat pengingat H-30, tidak menunggu H-7. Null bila di luar 90 hari atau
 * tenggat sudah lewat.
 */
export function reminderThresholdFor(daysLeft: number): string | null {
  if (daysLeft < 0 || daysLeft > SOON_WINDOW_DAYS) return null;

  const threshold = [...REMINDER_THRESHOLDS]
    .reverse()
    .find((limit) => daysLeft <= limit);

  return threshold === undefined ? null : `H${threshold}`;
}

/** Kunci pengingat mingguan untuk dokumen kedaluwarsa, mis. "OVERDUE:2026-W41". */
export function overdueWeekKey(now: Date): string {
  const day = new Date(toWibDayNumber(now) * MS_PER_DAY);
  const weekday = (day.getUTCDay() + 6) % DAYS_PER_WEEK;
  const thursday = new Date(day.getTime() + (ISO_THURSDAY_OFFSET - weekday) * MS_PER_DAY);
  const yearStart = Date.UTC(thursday.getUTCFullYear(), 0, 1);
  const week = Math.ceil(((thursday.getTime() - yearStart) / MS_PER_DAY + 1) / DAYS_PER_WEEK);

  return `OVERDUE:${thursday.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

/** Tenggat yang perlu tindakan: dalam 90 hari ke depan, atau berakhir yang sudah lewat. */
export function isActionable(deadline: LegalDeadline): boolean {
  if (deadline.daysLeft > SOON_WINDOW_DAYS) return false;

  return deadline.daysLeft >= 0 || deadline.kind === "END";
}

/** Awal hari kalender WIB, digeser `offsetDays` hari; batas query berbasis tanggal. */
export function wibDayStart(now: Date, offsetDays = 0): Date {
  return new Date((toWibDayNumber(now) + offsetDays) * MS_PER_DAY - WIB_OFFSET_MS);
}
