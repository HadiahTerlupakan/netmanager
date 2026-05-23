import { z } from "zod";

export const BARANG_VALIDATION = {
  NAMA: { MIN: 3, MAX: 200 },
  SATUAN: { MIN: 1, MAX: 50 },
} as const;

export const BARANG_JENIS = ["HABIS_PAKAI", "ASET"] as const;
export type BarangJenis = (typeof BARANG_JENIS)[number];

export const BARANG_KATEGORI_ASET = [
  "ELEKTRONIK",
  "KENDARAAN",
  "FURNITURE",
  "BANGUNAN",
  "LAINNYA",
] as const;
export type BarangKategoriAset = (typeof BARANG_KATEGORI_ASET)[number];

/**
 * Trim whitespace dan strip semua HTML tag dari input string.
 * Untuk defense-in-depth saja — server tetap harus validasi & escape ulang.
 */
export function sanitizeBarangInput(input: string): string {
  return input.trim().replace(/<[^>]*>/g, "");
}

const namaSchema = z
  .string({ message: "Nama barang harus diisi" })
  .transform(sanitizeBarangInput)
  .pipe(
    z
      .string()
      .min(BARANG_VALIDATION.NAMA.MIN, {
        message: `Nama barang minimal ${BARANG_VALIDATION.NAMA.MIN} karakter`,
      })
      .max(BARANG_VALIDATION.NAMA.MAX, {
        message: `Nama barang maksimal ${BARANG_VALIDATION.NAMA.MAX} karakter`,
      }),
  );

const satuanSchema = z
  .string({ message: "Satuan barang harus diisi" })
  .transform(sanitizeBarangInput)
  .pipe(
    z
      .string()
      .min(BARANG_VALIDATION.SATUAN.MIN, {
        message: `Satuan minimal ${BARANG_VALIDATION.SATUAN.MIN} karakter`,
      })
      .max(BARANG_VALIDATION.SATUAN.MAX, {
        message: `Satuan maksimal ${BARANG_VALIDATION.SATUAN.MAX} karakter`,
      }),
  );

export const barangFormSchema = z
  .object({
    nama: namaSchema,
    satuan: satuanSchema,
    jenis: z.enum(BARANG_JENIS).default("HABIS_PAKAI"),
    kategoriAset: z.string().nullable().optional(),
    isWorkOrderMaterial: z.boolean().optional().default(false),
    minStokDefault: z.number().int().min(0).optional().default(0),
  })
  .superRefine((data, ctx) => {
    if (data.jenis === "ASET") {
      const kategori = data.kategoriAset?.trim();
      if (!kategori) {
        ctx.addIssue({
          code: "custom",
          path: ["kategoriAset"],
          message: "Kategori aset harus dipilih untuk barang jenis ASET",
        });
      }
    }
  });

export type BarangFormInput = z.input<typeof barangFormSchema>;
export type BarangFormOutput = z.output<typeof barangFormSchema>;

/**
 * Helper untuk komponen form: jalankan parse dan kembalikan
 * Record<field, errorMessage> agar bisa di-render per-field.
 */
export function validateBarangForm(input: {
  nama: string;
  satuan: string;
  jenis?: string;
  kategoriAset?: string | null;
}): { valid: boolean; errors: Record<string, string> } {
  const result = barangFormSchema.safeParse({
    nama: input.nama,
    satuan: input.satuan,
    jenis: input.jenis ?? "HABIS_PAKAI",
    kategoriAset: input.kategoriAset ?? null,
  });

  if (result.success) {
    return { valid: true, errors: {} };
  }

  const errors: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const field = issue.path.join(".") || "_root";
    if (!errors[field]) errors[field] = issue.message;
  }
  return { valid: false, errors };
}
