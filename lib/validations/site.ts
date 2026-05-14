import { z } from "zod";

/** Schema untuk membuat site baru */
export const siteCreateSchema = z.object({
  name: z.string().trim().min(1, "Nama site wajib diisi"),
  code: z.string().trim().min(1, "Kode site wajib diisi"),
  address: z.string().trim().optional(),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
  attendanceRadius: z.number().min(0, "Radius tidak boleh negatif").optional(),
  isActive: z.boolean().optional(),
});

/** Schema untuk update site (semua field opsional) */
export const siteUpdateSchema = z.object({
  name: z.string().trim().min(1, "Nama site wajib diisi").optional(),
  code: z.string().trim().min(1, "Kode site wajib diisi").optional(),
  address: z.string().trim().optional(),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
  attendanceRadius: z.number().min(0, "Radius tidak boleh negatif").optional(),
  isActive: z.boolean().optional(),
});

export type SiteCreateInput = z.infer<typeof siteCreateSchema>;
export type SiteUpdateInput = z.infer<typeof siteUpdateSchema>;
