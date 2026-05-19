import { z } from "zod";

/** Daftar audience announcement yang valid (mirror Prisma enum). */
export const ANNOUNCEMENT_TARGETS = [
  "ALL",
  "ADMIN",
  "EMPLOYEE",
  "CUSTOMER",
] as const;

export type AnnouncementTarget = (typeof ANNOUNCEMENT_TARGETS)[number];

const TITLE_MAX_LENGTH = 200;
const CONTENT_MAX_LENGTH = 5000;

const optionalIsoDate = z
  .union([
    z.iso.datetime({ offset: true }),
    z.string().refine((s) => !Number.isNaN(Date.parse(s)), {
      message: "Tanggal tidak valid",
    }),
    z.null(),
  ])
  .optional()
  .transform((v) => (v == null || v === "" ? null : v));

/** Schema untuk membuat announcement baru. */
export const createAnnouncementSchema = z
  .object({
    title: z
      .string()
      .min(1, "Judul wajib diisi")
      .max(TITLE_MAX_LENGTH, `Judul maksimal ${TITLE_MAX_LENGTH} karakter`),
    content: z
      .string()
      .min(1, "Konten wajib diisi")
      .max(
        CONTENT_MAX_LENGTH,
        `Konten maksimal ${CONTENT_MAX_LENGTH} karakter`,
      ),
    target: z.enum(ANNOUNCEMENT_TARGETS),
    isActive: z.boolean().optional(),
    isPinned: z.boolean().optional(),
    startDate: optionalIsoDate,
    endDate: optionalIsoDate,
  })
  .superRefine((value, ctx) => {
    if (
      value.startDate &&
      value.endDate &&
      Date.parse(value.endDate) <= Date.parse(value.startDate)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["endDate"],
        message: "Tanggal berakhir harus setelah tanggal mulai",
      });
    }
  });

export type CreateAnnouncementInput = z.infer<typeof createAnnouncementSchema>;

/** Schema untuk update announcement (semua field opsional). */
export const updateAnnouncementSchema = z
  .object({
    title: z
      .string()
      .min(1, "Judul tidak boleh kosong")
      .max(TITLE_MAX_LENGTH, `Judul maksimal ${TITLE_MAX_LENGTH} karakter`)
      .optional(),
    content: z
      .string()
      .min(1, "Konten tidak boleh kosong")
      .max(CONTENT_MAX_LENGTH, `Konten maksimal ${CONTENT_MAX_LENGTH} karakter`)
      .optional(),
    target: z.enum(ANNOUNCEMENT_TARGETS).optional(),
    isActive: z.boolean().optional(),
    isPinned: z.boolean().optional(),
    startDate: optionalIsoDate,
    endDate: optionalIsoDate,
  })
  .superRefine((value, ctx) => {
    if (
      value.startDate &&
      value.endDate &&
      Date.parse(value.endDate) <= Date.parse(value.startDate)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["endDate"],
        message: "Tanggal berakhir harus setelah tanggal mulai",
      });
    }
  });

export type UpdateAnnouncementInput = z.infer<typeof updateAnnouncementSchema>;
