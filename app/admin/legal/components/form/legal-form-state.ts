import { toDateInput } from "../legal-format";
import type {
  LegalDocumentDetail,
  LegalRecurrence,
} from "../legal-types";

/**
 * Nilai formulir dokumen legal dan konversinya ke payload API. Murni (tanpa
 * React) agar aturan pengisian bisa diuji langsung.
 */

export type LegalFormMode = "create" | "edit" | "renew";

export const MIN_TITLE_LENGTH = 3;
export const MIN_OBLIGATION_DESCRIPTION_LENGTH = 3;
const BYTES_PER_MEGABYTE = 1024 * 1024;
export const MAX_FILE_MEGABYTES = 20;
export const MAX_FILE_BYTES = MAX_FILE_MEGABYTES * BYTES_PER_MEGABYTE;
export const ACCEPTED_FILE_TYPES = ["application/pdf", "image/png", "image/jpeg"];

export interface ObligationDraft {
  description: string;
  dueDate: string;
  recurrence: LegalRecurrence;
}

export interface LegalFormValues {
  title: string;
  documentType: string;
  categoryId: string;
  documentNumber: string;
  partyName: string;
  startDate: string;
  endDate: string;
  /** Dokumen tanpa masa habis (NIB, akta, …): tanggal berakhir dikosongkan dengan sengaja. */
  isIndefinite: boolean;
  picUserId: string;
  picName: string;
  value: string;
  paymentScheme: string;
  guaranteeDescription: string;
  guaranteeEndDate: string;
  isAutoRenew: boolean;
  noticePeriodDays: string;
  penaltyNotes: string;
  disputeResolution: string;
  notes: string;
  obligations: ObligationDraft[];
}

export const EMPTY_OBLIGATION: ObligationDraft = {
  description: "",
  dueDate: "",
  recurrence: "NONE",
};

/**
 * Masa berlaku wajib dipilih secara sadar: lupa tanggal adalah masalah yang
 * diselesaikan modul ini, jadi "kosong karena lupa" tidak boleh sama dengan
 * "memang tanpa batas waktu".
 */
export const MISSING_VALIDITY_MESSAGE =
  "Isi tanggal berakhir, atau centang \"Berlaku tanpa batas waktu\"";

/** Dokumen korporat (akta, RUPS, surat kuasa) umumnya tidak kedaluwarsa. */
export function isIndefiniteByDefault(documentType: string): boolean {
  return documentType === "KORPORAT";
}

/** Formulir kosong untuk dokumen baru. */
export function createEmptyFormValues(): LegalFormValues {
  return {
    title: "",
    documentType: "KONTRAK",
    categoryId: "",
    documentNumber: "",
    partyName: "",
    startDate: "",
    endDate: "",
    isIndefinite: false,
    picUserId: "",
    picName: "",
    value: "",
    paymentScheme: "",
    guaranteeDescription: "",
    guaranteeEndDate: "",
    isAutoRenew: false,
    noticePeriodDays: "",
    penaltyNotes: "",
    disputeResolution: "",
    notes: "",
    obligations: [],
  };
}

/**
 * Formulir terisi dari dokumen yang ada. Untuk perpanjangan, masa berlaku
 * dikosongkan karena admin wajib menentukan periode baru.
 */
export function formValuesFromDetail(
  detail: LegalDocumentDetail,
  mode: LegalFormMode,
): LegalFormValues {
  const isRenewal = mode === "renew";

  return {
    title: detail.title,
    documentType: detail.documentType,
    categoryId: detail.categoryId ?? "",
    documentNumber: detail.documentNumber ?? "",
    partyName: detail.partyName ?? "",
    startDate: isRenewal ? "" : toDateInput(detail.startDate),
    endDate: isRenewal ? "" : toDateInput(detail.endDate),
    isIndefinite: !isRenewal && !detail.endDate,
    picUserId: detail.picUserId ?? "",
    picName: detail.picName ?? "",
    value: detail.value ?? "",
    paymentScheme: detail.paymentScheme ?? "",
    guaranteeDescription: detail.guaranteeDescription ?? "",
    guaranteeEndDate: toDateInput(detail.guaranteeEndDate),
    isAutoRenew: detail.isAutoRenew,
    noticePeriodDays: detail.noticePeriodDays?.toString() ?? "",
    penaltyNotes: detail.penaltyNotes ?? "",
    disputeResolution: detail.disputeResolution ?? "",
    notes: detail.notes ?? "",
    obligations: detail.obligations.map((obligation) => ({
      description: obligation.description,
      dueDate: toDateInput(obligation.nextDueDate),
      recurrence: obligation.recurrence as LegalRecurrence,
    })),
  };
}

/**
 * Nilai uang ketikan admin menjadi string desimal API. Mendukung gaya
 * Indonesia ("1.500.000,50") maupun titik desimal ("1500000.5").
 */
export function normalizeMoneyInput(raw: string): string | null {
  const compact = raw.replace(/\s|rp/gi, "");
  if (!compact) return null;
  if (compact.includes(",")) {
    return compact.replace(/\./g, "").replace(",", ".");
  }

  return /^\d+\.\d{1,2}$/.test(compact) ? compact : compact.replace(/\./g, "");
}

const textOrNull = (value: string) => value.trim() || null;

const isBlankObligation = (obligation: ObligationDraft) =>
  !obligation.description.trim() && !obligation.dueDate;

/** Payload JSON untuk API; isian opsional yang kosong dikirim sebagai null. */
export function buildLegalPayload(
  values: LegalFormValues,
  mode: LegalFormMode,
): Record<string, unknown> {
  const noticeDays = Number.parseInt(values.noticePeriodDays, 10);

  return {
    title: values.title.trim(),
    ...(mode === "create" && { documentType: values.documentType }),
    categoryId: values.categoryId || null,
    documentNumber: textOrNull(values.documentNumber),
    partyName: textOrNull(values.partyName),
    startDate: values.startDate || null,
    endDate: values.isIndefinite ? null : values.endDate || null,
    picUserId: values.picUserId || null,
    value: normalizeMoneyInput(values.value),
    paymentScheme: values.paymentScheme || null,
    guaranteeDescription: textOrNull(values.guaranteeDescription),
    guaranteeEndDate: values.guaranteeEndDate || null,
    isAutoRenew: values.isAutoRenew,
    noticePeriodDays: Number.isNaN(noticeDays) ? null : noticeDays,
    penaltyNotes: textOrNull(values.penaltyNotes),
    disputeResolution: textOrNull(values.disputeResolution),
    notes: textOrNull(values.notes),
    obligations: values.obligations
      .filter((obligation) => !isBlankObligation(obligation))
      .map((obligation) => ({
        description: obligation.description.trim(),
        dueDate: obligation.dueDate,
        recurrence: obligation.recurrence,
      })),
  };
}

/** Pesan galat berkas unggahan, atau null bila berkas sah. */
export function validateLegalFile(file: File): string | null {
  if (!ACCEPTED_FILE_TYPES.includes(file.type)) {
    return "Berkas harus PDF, PNG, atau JPG";
  }

  return file.size > MAX_FILE_BYTES ? `Ukuran berkas maksimal ${MAX_FILE_MEGABYTES} MB` : null;
}

/** Pesan galat pertama pada formulir, atau null bila siap dikirim. */
export function validateLegalForm(
  values: LegalFormValues,
  mode: LegalFormMode,
  file: File | null,
): string | null {
  if (values.title.trim().length < MIN_TITLE_LENGTH) {
    return `Judul minimal ${MIN_TITLE_LENGTH} karakter`;
  }
  if (mode === "create" && !file) return "Pilih berkas dokumen";
  if (file) {
    const fileError = validateLegalFile(file);
    if (fileError) return fileError;
  }
  if (mode === "renew" && !values.endDate) {
    return "Tanggal berakhir baru wajib diisi";
  }
  if (mode !== "renew" && !values.isIndefinite && !values.endDate) {
    return MISSING_VALIDITY_MESSAGE;
  }
  if (values.startDate && values.endDate && values.endDate < values.startDate) {
    return "Tanggal berakhir tidak boleh sebelum tanggal mulai";
  }
  const hasIncompleteObligation = values.obligations.some(
    (obligation) =>
      !isBlankObligation(obligation) &&
      (obligation.description.trim().length <
        MIN_OBLIGATION_DESCRIPTION_LENGTH ||
        !obligation.dueDate),
  );

  return hasIncompleteObligation
    ? `Lengkapi deskripsi (min. ${MIN_OBLIGATION_DESCRIPTION_LENGTH} karakter) dan jatuh tempo tiap kewajiban`
    : null;
}
