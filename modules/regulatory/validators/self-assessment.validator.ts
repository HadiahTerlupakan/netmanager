import { z } from "zod";

/** Tahun laporan; batas bawah = tahun data work order tertua yang masuk akal. */
const MIN_REPORT_YEAR = 2020;

export const selfAssessmentQuerySchema = z.object({
  year: z.coerce
    .number()
    .int()
    .min(MIN_REPORT_YEAR)
    .refine((year) => year <= new Date().getFullYear(), {
      message: "Tahun laporan tidak boleh di masa depan",
    }),
});

const MAX_FIELD = 300;
const MAX_URL = 1000;
const MAX_PERCENT = 100;

const text = z.string().trim().max(MAX_FIELD).default("");
const optionalUrl = z
  .string()
  .trim()
  .max(MAX_URL)
  .refine((value) => !value || /^https?:\/\//i.test(value), { message: "Link harus diawali http:// atau https://" })
  .optional();
const optionalPercent = z
  .string()
  .trim()
  .refine(
    (value) => {
      if (!value) return true;
      const percent = Number(value.replace(",", "."));
      return Number.isFinite(percent) && percent >= 0 && percent <= MAX_PERCENT;
    },
    { message: "Capaian harus angka 0–100" },
  )
  .optional();

/** Formulir dokumen Word: profil penyelenggara + isian tahun laporan. */
export const selfAssessmentDocumentFormSchema = z.object({
  profile: z.object({
    operatorName: text,
    licenseType: text,
    operatorAddress: text,
    licenseNumber: text,
    licenseDate: z
      .string()
      .trim()
      .refine((value) => !value || /^\d{4}-\d{2}-\d{2}$/.test(value), { message: "Tanggal izin tidak valid" })
      .default(""),
    licenseAttachmentUrl: optionalUrl.transform((value) => value ?? "").default(""),
    signingCity: text,
    directorName: text,
  }),
  yearly: z.object({
    manualAchievements: z.object({
      packetLoss: optionalPercent,
      latency: optionalPercent,
      availability: optionalPercent,
      complaints: optionalPercent,
    }),
    supportingLinks: z.object({
      packetLoss: optionalUrl,
      latency: optionalUrl,
      availability: optionalUrl,
      newInstallation: optionalUrl,
      restoration: optionalUrl,
      complaints: optionalUrl,
    }),
  }),
});
