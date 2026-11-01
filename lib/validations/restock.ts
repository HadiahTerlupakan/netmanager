import { z, type ZodError } from "zod";

// Pesan di file ini dibaca petugas gudang: sebut apa yang salah dan apa yang
// harus dilakukan, dengan kata sehari-hari.

/** Jumlah minta/terima: angka bulat paling sedikit 1. */
function jumlahMinimalSatu(label: string) {
  return z
    .number({ error: `${label} harus diisi angka.` })
    .int({ error: `${label} harus angka bulat, tanpa koma.` })
    .min(1, { error: `${label} paling sedikit 1.` });
}

const restockItemSchema = z.object({
  barangId: z
    .string({ error: "Barangnya belum dipilih. Pilih barangnya dulu." })
    .trim()
    .min(1, { error: "Barangnya belum dipilih. Pilih barangnya dulu." }),
  jumlah: jumlahMinimalSatu("Jumlah barang").optional(),
  quantity: jumlahMinimalSatu("Jumlah barang").optional(),
  keterangan: z.string().trim().nullable().optional(),
});

const restockJasaItemSchema = z.object({
  jasaId: z
    .string({ error: "Jasanya belum dipilih. Pilih jasanya dulu." })
    .trim()
    .min(1, { error: "Jasanya belum dipilih. Pilih jasanya dulu." }),
  jumlah: jumlahMinimalSatu("Jumlah jasa").default(1),
  hargaPerUnit: z
    .number({ error: "Harga jasa harus diisi angka." })
    .min(0, { error: "Harga jasa tidak boleh minus." })
    .default(0)
    .optional(),
  keterangan: z.string().trim().nullable().optional(),
});

const restockRequestShape = {
  gudangId: z
    .string({ error: "Gudang tujuan belum dipilih. Pilih gudangnya dulu." })
    .trim()
    .min(1, { error: "Gudang tujuan belum dipilih. Pilih gudangnya dulu." }),
  keterangan: z
    .string({
      error: "Catatan belum diisi. Tulis untuk apa barang ini dibeli.",
    })
    .trim()
    .min(1, {
      error: "Catatan belum diisi. Tulis untuk apa barang ini dibeli.",
    }),
  items: z.array(restockItemSchema).default([]),
  jasaItems: z.array(restockJasaItemSchema).default([]),
};

const NOTHING_REQUESTED_MESSAGE =
  "Belum ada barang atau jasa yang diminta. Tambahkan paling sedikit satu barang atau jasa.";

function hasRequestedSomething(data: {
  items?: unknown[];
  jasaItems?: unknown[];
}): boolean {
  return (data.items?.length ?? 0) > 0 || (data.jasaItems?.length ?? 0) > 0;
}

/** Schema untuk membuat purchase request restock (bisa barang, jasa, atau keduanya) */
export const restockCreateSchema = z
  .object(restockRequestShape)
  .refine(hasRequestedSomething, { message: NOTHING_REQUESTED_MESSAGE });

/** Schema untuk update purchase request restock (PUT) */
export const restockUpdateSchema = z
  .object(restockRequestShape)
  .refine(hasRequestedSomething, { message: NOTHING_REQUESTED_MESSAGE });

/** Schema untuk lifecycle action (PATCH) */
export const restockLifecycleSchema = z.object({
  action: z
    .string({
      error:
        "Tindakan ini tidak dikenal. Pilih Setujui atau Tolak, lalu coba lagi.",
    })
    .trim()
    .min(1, {
      error:
        "Tindakan ini tidak dikenal. Pilih Setujui atau Tolak, lalu coba lagi.",
    }),
  catatan: z.string().trim().optional(),
});

/** Schema konfirmasi jasa selesai pada pengajuan restock. */
export const restockJasaConfirmSchema = z.object({
  items: z
    .array(
      z.object({
        jasaItemId: z
          .string({
            error:
              "Data jasa tidak lengkap. Muat ulang halaman, lalu coba lagi.",
          })
          .trim()
          .min(1, {
            error:
              "Data jasa tidak lengkap. Muat ulang halaman, lalu coba lagi.",
          }),
        tanggalSelesai: z.string().trim().nullable().optional(),
        buktiSelesai: z
          .array(z.string().min(1), {
            error:
              "Foto bukti jasa selesai belum diunggah. Unggah fotonya dulu.",
          })
          .min(1, {
            error:
              "Foto bukti jasa selesai belum diunggah. Unggah fotonya dulu.",
          }),
      }),
      {
        error: "Daftar jasa tidak terbaca. Muat ulang halaman, lalu coba lagi.",
      },
    )
    .min(1, {
      error:
        "Belum ada jasa yang dicentang. Centang jasa yang sudah selesai, lalu simpan.",
    }),
});

/** Nama daftar di payload pengajuan restock → kata untuk menyebut barisnya. */
const RESTOCK_REQUEST_LIST_LABELS: Readonly<Record<string, string>> = {
  items: "Barang",
  jasaItems: "Jasa",
};

/** Di payload konfirmasi jasa, `items` berisi jasa. */
export const RESTOCK_JASA_CONFIRM_LIST_LABELS: Readonly<
  Record<string, string>
> = {
  items: "Jasa",
};

/**
 * Gabungkan semua masalah validasi restock menjadi pesan untuk petugas,
 * satu masalah per baris. Masalah pada baris daftar disebut posisinya
 * ("Barang ke-2: …") agar petugas tahu baris mana yang harus dibetulkan.
 */
export function describeRestockValidationError(
  error: ZodError,
  listLabels: Readonly<Record<string, string>> = RESTOCK_REQUEST_LIST_LABELS,
): string {
  const lines: string[] = [];

  for (const issue of error.issues) {
    const [listName, index] = issue.path;
    const listLabel = listLabels[String(listName)];
    const line =
      listLabel && typeof index === "number"
        ? `${listLabel} ke-${index + 1}: ${issue.message}`
        : issue.message;
    if (!lines.includes(line)) lines.push(line);
  }

  return lines.join("\n");
}

interface RestockSettingsBody {
  barangId?: unknown;
  gudangId?: unknown;
  minStok?: unknown;
  maxStok?: unknown;
}

/**
 * Periksa isian pengaturan restock dan kembalikan semua masalahnya dalam
 * kalimat untuk petugas, satu per baris. `null` berarti isian siap disimpan.
 * Aturannya sama seperti sebelumnya (barang, gudang, stok minimal, dan stok
 * maksimal wajib; minimal < maksimal) — hanya pesannya yang diperjelas.
 */
export function findRestockSettingsProblems(
  body: RestockSettingsBody,
): string | null {
  const problems: string[] = [];
  if (!body.barangId)
    problems.push("Barangnya belum dipilih. Pilih barangnya dulu.");
  if (!body.gudangId)
    problems.push("Gudangnya belum dipilih. Pilih gudangnya dulu.");
  if (!body.minStok) {
    problems.push(
      "Stok minimum belum diisi atau masih 0. Isi angka 1 atau lebih.",
    );
  }
  if (!body.maxStok) {
    problems.push(
      "Stok maksimum belum diisi atau masih 0. Isi angka yang lebih besar dari stok minimum.",
    );
  }
  if (
    body.minStok &&
    body.maxStok &&
    Number(body.minStok) >= Number(body.maxStok)
  ) {
    problems.push(
      `Stok minimum (${String(body.minStok)}) harus lebih kecil dari stok maksimum (${String(body.maxStok)}). Contoh: minimum 5, maksimum 20.`,
    );
  }
  return problems.length > 0 ? problems.join("\n") : null;
}

export type RestockCreateInput = z.infer<typeof restockCreateSchema>;
export type RestockUpdateInput = z.infer<typeof restockUpdateSchema>;
export type RestockLifecycleInput = z.infer<typeof restockLifecycleSchema>;
export type RestockJasaConfirmInput = z.infer<typeof restockJasaConfirmSchema>;
