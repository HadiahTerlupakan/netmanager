import { z } from "zod";

export const JASA_STATUS = ["ACTIVE", "INACTIVE"] as const;
export const JASA_SATUAN = [
  "job",
  "titik",
  "unit",
  "jam",
  "hari",
  "bulan",
] as const;
export const JASA_KATEGORI_PPH = ["jasa", "sewa", "sewa_tanah"] as const;

const JASA_BATAS = {
  KODE: 50,
  NAMA: 200,
  SATUAN: 30,
  DESKRIPSI: 1000,
} as const;

// Pesan dibaca staf: sebut kolomnya, masalahnya, dan apa yang harus dilakukan.
export const jasaCreateSchema = z.object({
  kode: z
    .string({ error: "Kode jasa harus berupa tulisan." })
    .trim()
    .min(1, {
      error:
        "Kode jasa kosong. Isi kodenya, atau hapus isian kode supaya dibuat otomatis.",
    })
    .max(JASA_BATAS.KODE, {
      error: `Kode jasa terlalu panjang. Paling banyak ${JASA_BATAS.KODE} huruf.`,
    })
    .optional(),
  nama: z
    .string({
      error:
        "Nama jasa belum diisi. Tulis nama jasanya, contoh: Pemasangan Tiang.",
    })
    .trim()
    .min(1, {
      error:
        "Nama jasa belum diisi. Tulis nama jasanya, contoh: Pemasangan Tiang.",
    })
    .max(JASA_BATAS.NAMA, {
      error: `Nama jasa terlalu panjang. Paling banyak ${JASA_BATAS.NAMA} huruf.`,
    }),
  satuan: z
    .string({
      error:
        "Satuan jasa belum dipilih. Pilih satuannya, contoh: job, titik, jam.",
    })
    .trim()
    .min(1, {
      error:
        "Satuan jasa belum dipilih. Pilih satuannya, contoh: job, titik, jam.",
    })
    .max(JASA_BATAS.SATUAN, {
      error: `Satuan jasa terlalu panjang. Paling banyak ${JASA_BATAS.SATUAN} huruf.`,
    })
    .default("job"),
  supplierId: z.string().trim().nullable().optional(),
  hargaEstimasi: z.coerce
    .number({
      error:
        "Harga perkiraan harus diisi angka, tanpa titik atau huruf. Contoh: 150000.",
    })
    .min(0, {
      error:
        "Harga perkiraan tidak boleh minus. Isi 0 kalau belum tahu harganya.",
    })
    .default(0),
  kategoriPph: z
    .enum(JASA_KATEGORI_PPH, {
      error: "Kategori pajak (PPh) tidak dikenal. Pilih dari daftar yang ada.",
    })
    .nullable()
    .optional(),
  deskripsi: z
    .string()
    .trim()
    .max(JASA_BATAS.DESKRIPSI, {
      error: `Keterangan jasa terlalu panjang. Paling banyak ${JASA_BATAS.DESKRIPSI} huruf.`,
    })
    .nullable()
    .optional(),
  status: z
    .enum(JASA_STATUS, {
      error: "Status jasa tidak dikenal. Pilih Aktif atau Nonaktif.",
    })
    .default("ACTIVE"),
});

export const jasaUpdateSchema = jasaCreateSchema.partial();

export type JasaCreateInput = z.infer<typeof jasaCreateSchema>;
export type JasaUpdateInput = z.infer<typeof jasaUpdateSchema>;
