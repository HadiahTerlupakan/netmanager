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

const UNKNOWN_LIFECYCLE_ACTION_MESSAGE =
  "Tindakan ini tidak dikenal. Pilih Setujui atau Tolak, lalu coba lagi.";
const DECISION_NOTE_MAX_LENGTH = 500;
const LINE_NOTE_MAX_LENGTH = 255;
const STALE_LINE_MESSAGE =
  "Data baris pengajuan tidak lengkap. Muat ulang halaman, lalu putuskan lagi.";

const lineDecisionShape = {
  itemId: z
    .string({ error: STALE_LINE_MESSAGE })
    .trim()
    .min(1, { error: STALE_LINE_MESSAGE }),
  keputusan: z.enum(["APPROVED", "REJECTED"], {
    error: "Pilih Setujui atau Tolak untuk baris ini.",
  }),
  jumlah: jumlahMinimalSatu("Jumlah yang disetujui").optional(),
  catatan: z
    .string({ error: "Catatan baris harus berupa tulisan." })
    .trim()
    .max(LINE_NOTE_MAX_LENGTH, {
      error: `Catatan baris paling panjang ${LINE_NOTE_MAX_LENGTH} karakter.`,
    })
    .optional(),
};

/** Baris yang disetujui wajib menyebut jumlah yang disetujui. */
function hasApprovedQuantity(line: {
  keputusan: "APPROVED" | "REJECTED";
  jumlah?: number;
}): boolean {
  return line.keputusan === "REJECTED" || line.jumlah !== undefined;
}

const APPROVED_QUANTITY_REQUIRED = {
  message: "Jumlah yang disetujui belum diisi. Isi angka 1 atau lebih.",
  path: ["jumlah"],
};

const restockBarangDecisionSchema = z
  .object({
    ...lineDecisionShape,
    barangIdPengganti: z
      .string({ error: "Barang pengganti tidak terbaca. Pilih ulang." })
      .trim()
      .min(1, { error: "Barang pengganti tidak terbaca. Pilih ulang." })
      .nullable()
      .optional(),
  })
  .refine(hasApprovedQuantity, APPROVED_QUANTITY_REQUIRED);

const restockJasaDecisionSchema = z
  .object(lineDecisionShape)
  .refine(hasApprovedQuantity, APPROVED_QUANTITY_REQUIRED);

const restockRejectSchema = z.object({
  action: z.literal("REJECT"),
  catatan: z
    .string({ error: "Alasan penolakan belum diisi. Tulis kenapa ditolak." })
    .trim()
    .min(1, { error: "Alasan penolakan belum diisi. Tulis kenapa ditolak." })
    .max(DECISION_NOTE_MAX_LENGTH, {
      error: `Catatan keputusan paling panjang ${DECISION_NOTE_MAX_LENGTH} karakter.`,
    }),
});

const restockApproveSchema = z.object({
  action: z.literal("APPROVE"),
  catatan: z
    .string({ error: "Catatan persetujuan harus berupa tulisan." })
    .trim()
    .max(DECISION_NOTE_MAX_LENGTH, {
      error: `Catatan keputusan paling panjang ${DECISION_NOTE_MAX_LENGTH} karakter.`,
    })
    .optional(),
  items: z.array(restockBarangDecisionSchema, {
    error:
      "Keputusan per barang belum terkirim. Muat ulang halaman, lalu putuskan lagi.",
  }),
  jasaItems: z.array(restockJasaDecisionSchema).default([]),
});

/**
 * Schema untuk lifecycle action (PATCH): tolak seluruh pengajuan dengan
 * alasan, atau setujui dengan keputusan per baris barang dan jasa.
 */
export const restockLifecycleSchema = z.discriminatedUnion(
  "action",
  [restockRejectSchema, restockApproveSchema],
  { error: UNKNOWN_LIFECYCLE_ACTION_MESSAGE },
);

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

const BODY_UNREADABLE_MESSAGE =
  "Data yang dikirim tidak terbaca. Muat ulang halaman, lalu coba lagi.";

/** Batas panjang alasan pembatalan pengajuan (dipakai juga modal Batalkan Pengajuan). */
export const RESTOCK_CANCEL_REASON_LIMITS = { min: 5, max: 255 } as const;

/** Alasan tidak dikirim, kosong, atau terlalu pendek: satu pesan yang menyebut caranya. */
const CANCEL_REASON_TOO_SHORT_MESSAGE = `Tulis alasan pembatalan, paling sedikit ${RESTOCK_CANCEL_REASON_LIMITS.min} huruf.`;

/**
 * Body PATCH /api/inventory/restock/requests/[id] dengan `action: "CANCEL"`:
 * admin membatalkan pengajuan yang sudah disetujui, dengan alasan. Route
 * memilih skema dari `action`; Setujui/Tolak tetap memakai
 * {@link restockLifecycleSchema}. Field di luar daftar berarti kiriman yang
 * rusak, jadi pengguna diminta memuat ulang halaman.
 */
export const restockCancelSchema = z.strictObject(
  {
    action: z.literal("CANCEL", { error: BODY_UNREADABLE_MESSAGE }),
    alasan: z
      .string({ error: CANCEL_REASON_TOO_SHORT_MESSAGE })
      .trim()
      .min(RESTOCK_CANCEL_REASON_LIMITS.min, {
        error: CANCEL_REASON_TOO_SHORT_MESSAGE,
      })
      .max(RESTOCK_CANCEL_REASON_LIMITS.max, {
        error: `Alasan pembatalan terlalu panjang. Paling banyak ${RESTOCK_CANCEL_REASON_LIMITS.max} huruf.`,
      }),
  },
  { error: BODY_UNREADABLE_MESSAGE },
);

/**
 * Kiriman Masukkan Barang dari tab halaman Restock versi lama yang masih
 * membawa field tindakan yang sudah dihapus.
 */
const OUTDATED_PAGE_MESSAGE =
  "Tindakan ini sudah tidak tersedia. Muat ulang halaman, lalu coba lagi.";

/** Pesan untuk masalah pada objek body Masukkan Barang itu sendiri, menurut kodenya. */
const RECEIVE_BODY_MESSAGES: Readonly<Record<string, string>> = {
  invalid_type: BODY_UNREADABLE_MESSAGE,
  unrecognized_keys: OUTDATED_PAGE_MESSAGE,
};

const PHOTO_UNREADABLE_MESSAGE =
  "Foto bukti tidak terbaca. Unggah ulang fotonya, lalu simpan.";

/** Jumlah barang yang masuk gudang: angka bulat, boleh 0. */
const enteredQuantitySchema = z
  .number({ error: "Jumlah barang yang masuk harus diisi angka." })
  .int({ error: "Jumlah barang yang masuk harus angka bulat, tanpa koma." })
  .min(0, { error: "Jumlah barang yang masuk tidak boleh minus." });

/** Peta barangId → teks (barang pengganti atau alasan kelebihan); boleh kosong. */
const barangTextMapSchema = z
  .record(z.string(), z.string({ error: BODY_UNREADABLE_MESSAGE }), {
    error: BODY_UNREADABLE_MESSAGE,
  })
  .default({});

/**
 * Body PATCH /api/inventory/restock/requests/[id]/receive (Masukkan Barang):
 * jumlah masuk per barangId, barang pengganti (barangId asal → pengganti),
 * alasan kelebihan per barangId, dan foto bukti. Sekali simpan langsung
 * menyelesaikan pengajuan, jadi field lain (termasuk field dari halaman versi
 * lama) ditolak dengan pesan muat ulang supaya tab lama tidak menutup
 * pengajuan diam-diam.
 */
export const restockReceiveSchema = z.strictObject(
  {
    items: z.record(z.string(), enteredQuantitySchema, {
      error: BODY_UNREADABLE_MESSAGE,
    }),
    substitutions: barangTextMapSchema,
    overReceipts: barangTextMapSchema,
    fotoBukti: z
      .array(
        z
          .string({ error: PHOTO_UNREADABLE_MESSAGE })
          .min(1, { error: PHOTO_UNREADABLE_MESSAGE }),
        { error: PHOTO_UNREADABLE_MESSAGE },
      )
      .default([]),
  },
  {
    error: (issue: { code?: string }) =>
      RECEIVE_BODY_MESSAGES[issue.code ?? ""],
  },
);

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
export type RestockCancelInput = z.infer<typeof restockCancelSchema>;
export type RestockReceiveInput = z.infer<typeof restockReceiveSchema>;
