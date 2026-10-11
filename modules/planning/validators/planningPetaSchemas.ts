import { z } from "zod";

/** Rasio splitter yang sah untuk ODC; disalin dari components/map/node-form-utils.ts. */
export const RASIO_SPLITTER_ODC = [
  "1:2",
  "1:4",
  "1:8",
  "1:16",
  "1:32",
  "1:64",
] as const;

/** Rasio splitter yang sah untuk ODP; disalin dari components/map/node-form-utils.ts. */
export const RASIO_SPLITTER_ODP = [
  "1:2",
  "1:4",
  "1:8",
  "1:16",
  "1:32",
] as const;

const MAKS_PANJANG_NAMA_TITIK = 120;
const MAKS_PANJANG_CATATAN = 500;
const MAKS_PANJANG_JENIS_KABEL = 40;

const latitudeSchema = z
  .number()
  .min(-90, "Latitude di luar rentang")
  .max(90, "Latitude di luar rentang");
const longitudeSchema = z
  .number()
  .min(-180, "Longitude di luar rentang")
  .max(180, "Longitude di luar rentang");

/**
 * Rasio splitter wajib diisi dan tidak punya nilai bawaan.
 *
 * Form peta operasional memilihkan `1:8` otomatis. Di dokumen anggaran, field
 * yang tidak pernah disentuh perencana akan diam-diam menjadi jumlah barang
 * yang dibeli — jadi di sini pilihan harus eksplisit.
 */
export const buatTitikRencanaSchema = z
  .object({
    type: z.enum(["odp", "odc"]),
    name: z
      .string()
      .min(1, "Nama titik wajib diisi")
      .max(MAKS_PANJANG_NAMA_TITIK),
    latitude: latitudeSchema,
    longitude: longitudeSchema,
    splitter: z.string().min(1, "Rasio splitter wajib dipilih"),
    notes: z.string().max(MAKS_PANJANG_CATATAN).optional().nullable(),
  })
  .superRefine((nilai, ctx) => {
    const sah: readonly string[] =
      nilai.type === "odc" ? RASIO_SPLITTER_ODC : RASIO_SPLITTER_ODP;
    if (!sah.includes(nilai.splitter)) {
      ctx.addIssue({
        code: "custom",
        path: ["splitter"],
        message: `Rasio splitter untuk ${nilai.type.toUpperCase()} harus salah satu dari ${sah.join(", ")}`,
      });
    }
  });

/** Jalur kabel rencana; `waypoints` berupa pasangan [latitude, longitude]. */
export const buatJalurRencanaSchema = z.object({
  source: z.string().min(1),
  target: z.string().min(1),
  fiberType: z.string().min(1).max(MAKS_PANJANG_JENIS_KABEL),
  waypoints: z.array(z.tuple([latitudeSchema, longitudeSchema])).default([]),
  distance: z.number().nonnegative().optional().nullable(),
  notes: z.string().max(MAKS_PANJANG_CATATAN).optional().nullable(),
});

/** Persentase cadangan kabel yang ditambahkan di atas panjang jalur. */
export const ubahCadanganKabelSchema = z.object({
  spareKabelPersen: z
    .number()
    .min(0, "Cadangan kabel minimal 0 persen")
    .max(100, "Cadangan kabel maksimal 100 persen"),
});

/**
 * Body POST penerbitan material. Cadangan kabel opsional: bila tidak dikirim,
 * nilai yang tersimpan di rencana dipakai apa adanya.
 */
export const terbitkanMaterialSchema = ubahCadanganKabelSchema.partial();

export type BuatTitikRencanaInput = z.infer<typeof buatTitikRencanaSchema>;
export type BuatJalurRencanaInput = z.infer<typeof buatJalurRencanaSchema>;
