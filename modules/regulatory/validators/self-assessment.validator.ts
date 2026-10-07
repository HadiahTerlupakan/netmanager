import { z } from "zod";

import { AppError } from "@/lib/errors";
import { parametersOf, type LicenseScheme } from "../domain/license-schemes";

/** Tahun laporan; batas bawah = tahun data work order tertua yang masuk akal. */
const MIN_REPORT_YEAR = 2020;

/**
 * Jenis izin yang dilaporkan. Wajib dikirim pemanggil — satu tenant bisa
 * memegang dua izin, jadi menebak salah satunya berisiko menampilkan atau
 * menimpa isian izin yang keliru.
 */
export const licenseSchemeSchema = z.enum(["JARTAPLOK_PS", "ISP"]);

/**
 * Site yang dilaporkan, dipisah koma. Kosong/absen berarti seluruh site tenant.
 *
 * Penyelenggara bisa memegang izin yang hanya mencakup sebagian wilayah, jadi
 * melaporkan seluruh site akan menyalahi angka yang semestinya dilaporkan.
 */
const siteIdsSchema = z
  .string()
  .trim()
  .optional()
  .transform((value) =>
    value
      ? value
          .split(",")
          .map((id) => id.trim())
          .filter(Boolean)
      : undefined,
  );

export const selfAssessmentQuerySchema = z.object({
  skema: licenseSchemeSchema,
  siteIds: siteIdsSchema,
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
  .refine((value) => !value || /^https?:\/\//i.test(value), {
    message: "Link harus diawali http:// atau https://",
  })
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
      .refine((value) => !value || /^\d{4}-\d{2}-\d{2}$/.test(value), {
        message: "Tanggal izin tidak valid",
      })
      .default(""),
    licenseAttachmentUrl: optionalUrl
      .transform((value) => value ?? "")
      .default(""),
    signingCity: text,
    directorName: text,
  }),
  // Kunci parameter bergantung jenis izin, jadi bentuknya peta bebas di sini
  // dan kesesuaian kuncinya diperiksa `pastikanKunciSesuaiSkema` setelah skema
  // diketahui. Nilainya tetap divalidasi ketat.
  yearly: z.object({
    manualAchievements: z.record(z.string(), optionalPercent),
    supportingLinks: z.record(z.string(), optionalUrl),
  }),
});

/**
 * Tolak kunci parameter yang bukan milik skema yang sedang dilaporkan.
 *
 * Tanpa ini isian satu izin bisa menyelinap ke izin lain lewat payload yang
 * dirakit sendiri — tersimpan diam-diam dan ikut tercetak ke dokumen resmi.
 */
export function pastikanKunciSesuaiSkema(
  scheme: LicenseScheme,
  yearly: {
    manualAchievements: Record<string, unknown>;
    supportingLinks: Record<string, unknown>;
  },
): void {
  const dikenal = new Set(
    parametersOf(scheme).map((parameter) => parameter.key),
  );
  const manualAsing = Object.keys(yearly.manualAchievements).filter(
    (key) => !dikenal.has(key),
  );
  const linkAsing = Object.keys(yearly.supportingLinks).filter(
    (key) => !dikenal.has(key),
  );
  const asing = [...new Set([...manualAsing, ...linkAsing])];

  if (asing.length > 0) {
    throw new AppError(
      `Parameter tidak dikenal untuk izin ${scheme}: ${asing.join(", ")}`,
      400,
      "VALIDATION_ERROR",
    );
  }
}
