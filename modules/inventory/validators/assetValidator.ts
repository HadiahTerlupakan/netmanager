import { z } from "zod";

export const ASSET_STATUSES = [
  "ACTIVE",
  "INSTALLED",
  "SOLD",
  "DISPOSED",
  "LOST",
  "REPAIR",
] as const;
export type AssetStatusValue = (typeof ASSET_STATUSES)[number];

/** Nama status aset yang dipakai di pesan untuk staf. */
export const LABEL_STATUS_ASET: Record<AssetStatusValue, string> = {
  ACTIVE: "Aktif",
  INSTALLED: "Terpasang",
  SOLD: "Terjual",
  DISPOSED: "Dibuang",
  LOST: "Hilang",
  REPAIR: "Sedang diperbaiki",
};

// Pesan dibaca staf: sebut kolomnya, masalahnya, dan apa yang harus dilakukan.

const PESAN_STATUS_TIDAK_DIKENAL =
  "Status aset tidak dikenal. Pilih status dari daftar yang ada.";

const statusAsetSchema = z.enum(ASSET_STATUSES, {
  error: PESAN_STATUS_TIDAK_DIKENAL,
});

/** Tanggal (teks atau Date) yang harus bisa dibaca sebagai tanggal sungguhan. */
function tanggalSchema(label: string) {
  return z
    .union([z.string(), z.date()], {
      error: `${label} belum diisi. Pilih tanggalnya dari kalender.`,
    })
    .transform((value) => new Date(value))
    .refine((date) => !Number.isNaN(date.getTime()), {
      error: `${label} tidak terbaca. Pilih tanggalnya dari kalender.`,
    });
}

function formatRupiah(value: number): string {
  return `Rp ${value.toLocaleString("id-ID")}`;
}

/** Schema pembuatan aset dari `POST /api/inventory/assets`. */
export const createAssetSchema = z
  .object({
    barangId: z
      .string({ error: "Barang belum dipilih. Pilih barangnya dulu." })
      .min(1, { error: "Barang belum dipilih. Pilih barangnya dulu." }),
    kodeAsset: z
      .string({ error: "Kode aset belum diisi. Tulis kode asetnya." })
      .trim()
      .min(1, { error: "Kode aset belum diisi. Tulis kode asetnya." }),
    purchaseDate: tanggalSchema("Tanggal beli"),
    purchasePrice: z
      .number({ error: "Harga beli harus diisi angka. Contoh: 2500000." })
      .min(0, { error: "Harga beli tidak boleh minus." }),
    usefulLife: z
      .number({
        error: "Umur pakai harus diisi angka bulan. Contoh: 36 untuk 3 tahun.",
      })
      .int({ error: "Umur pakai harus angka bulat (dalam bulan), tanpa koma." })
      .min(1, { error: "Umur pakai minimal 1 bulan." }),
    residualValue: z
      .number({ error: "Nilai sisa harus diisi angka. Isi 0 kalau tidak ada." })
      .min(0, {
        error:
          "Nilai sisa tidak boleh minus. Isi 0 kalau aset tidak bernilai lagi di akhir umur pakainya.",
      })
      .optional()
      .default(0),
    status: statusAsetSchema.optional(),
    location: z.string().optional(),
    assignedTo: z.string().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.residualValue <= value.purchasePrice) return;
    ctx.addIssue({
      code: "custom",
      path: ["residualValue"],
      message: `Nilai sisa (${formatRupiah(value.residualValue)}) lebih besar dari harga beli (${formatRupiah(value.purchasePrice)}). Nilai sisa harus sama atau lebih kecil dari harga beli.`,
    });
  });

/** Schema perubahan aset dari `PATCH /api/inventory/assets/[id]`. */
export const updateAssetSchema = z.object({
  kodeAsset: z.string().trim().optional(),
  status: statusAsetSchema.optional(),
  location: z.string().optional(),
  assignedTo: z.string().optional(),
});

/** Schema isi opsional `POST /api/inventory/assets/[id]/depreciate`. */
export const depreciateAssetSchema = z.object({
  date: tanggalSchema("Tanggal penyusutan").optional(),
});
