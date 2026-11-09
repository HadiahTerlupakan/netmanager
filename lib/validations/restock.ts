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

/** Batas isian catatan belanja (satu kali belanja di satu toko). */
export const RESTOCK_PURCHASE_LIMITS = {
  storeName: 120,
  notes: 500,
  fotoNota: 5,
  /** Panjang maksimal satu alamat foto nota hasil unggahan. */
  fotoNotaUrl: 2048,
  /** Jumlah barang maksimal dalam satu catatan belanja. */
  items: 200,
  unitPrice: 1_000_000_000,
  buyerName: 100,
  /** Panjang maksimal data URL tanda tangan dari link belanja. */
  signatureDataUrl: 280_000,
} as const;

const STORE_NAME_EMPTY = "Nama toko belum diisi. Tulis nama tokonya.";
const PURCHASE_LINE_BROKEN =
  "Data barang tidak lengkap. Muat ulang halaman, lalu coba lagi.";

const restockPurchaseLineSchema = z.object({
  purchaseOrderItemId: z
    .string({ error: PURCHASE_LINE_BROKEN })
    .trim()
    .min(1, { error: PURCHASE_LINE_BROKEN }),
  quantity: jumlahMinimalSatu("Jumlah dibeli"),
  unitPrice: z
    .number({ error: "Harga harus diisi angka." })
    .min(0, { error: "Harga tidak boleh minus." })
    .max(RESTOCK_PURCHASE_LIMITS.unitPrice, {
      error: "Harga terlalu besar. Periksa lagi angkanya.",
    })
    .nullable()
    .optional(),
});

/**
 * Teks polos tanpa karakter kontrol (`\p{Cc}`) maupun karakter format
 * (`\p{Cf}`: pembalik arah U+202E/U+202D, karakter tak terlihat). Nama toko
 * dan nama pembeli adalah bukti siapa yang belanja di garis waktu dan PDF,
 * jadi tampilannya tidak boleh bisa dibalik atau disamarkan.
 */
const SINGLE_LINE_PLAIN_TEXT = /^[^\p{Cc}\p{Cf}]*$/u;
/** Sama seperti di atas, tetapi catatan boleh berisi baris baru dan tab. */
const MULTI_LINE_PLAIN_TEXT = /^(?:[^\p{Cc}\p{Cf}]|[\n\r\t])*$/u;

const purchaseStoreNameSchema = z
  .string({ error: STORE_NAME_EMPTY })
  .trim()
  .min(1, { error: STORE_NAME_EMPTY })
  .max(RESTOCK_PURCHASE_LIMITS.storeName, {
    error: `Nama toko terlalu panjang. Paling banyak ${RESTOCK_PURCHASE_LIMITS.storeName} huruf.`,
  })
  .regex(SINGLE_LINE_PLAIN_TEXT, {
    error: "Nama toko berisi huruf yang tidak bisa dipakai.",
  });

const purchaseDateSchema = z.iso.date({
  error: "Tanggal belanja belum diisi atau tidak terbaca.",
});

const purchaseNotesSchema = z
  .string()
  .trim()
  .max(RESTOCK_PURCHASE_LIMITS.notes, {
    error: `Catatan terlalu panjang. Paling banyak ${RESTOCK_PURCHASE_LIMITS.notes} huruf.`,
  })
  .regex(MULTI_LINE_PLAIN_TEXT, {
    error: "Catatan berisi huruf yang tidak bisa dipakai.",
  })
  .nullable()
  .optional()
  .transform((value) => (value ? value : null));

const purchaseLinesSchema = z
  .array(restockPurchaseLineSchema, {
    error: "Daftar barang tidak terbaca. Muat ulang halaman, lalu coba lagi.",
  })
  .min(1, {
    error:
      "Belum ada barang yang dicentang. Centang barang yang dibeli di toko ini.",
  })
  .max(RESTOCK_PURCHASE_LIMITS.items, {
    error: `Barang terlalu banyak. Paling banyak ${RESTOCK_PURCHASE_LIMITS.items} barang dalam satu belanja.`,
  });

/** Nama orang yang belanja; karakter kontrol ditolak, spasi dirapikan. */
const buyerNameSchema = z
  .string({ error: "Isi nama Anda." })
  .trim()
  .min(1, { error: "Isi nama Anda." })
  .max(RESTOCK_PURCHASE_LIMITS.buyerName, {
    error: `Nama terlalu panjang. Paling banyak ${RESTOCK_PURCHASE_LIMITS.buyerName} huruf.`,
  })
  .regex(SINGLE_LINE_PLAIN_TEXT, {
    error: "Nama berisi huruf yang tidak bisa dipakai.",
  })
  .transform((value) => value.replace(/\s+/g, " "));

/** Token link belanja: 32 byte acak dalam base64url (43 karakter). */
const purchaseLinkTokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);

/** Tolak barang yang tercantum dua kali dalam satu catatan belanja. */
function refineUniquePurchaseLines(
  value: { items: Array<{ purchaseOrderItemId: string }> },
  ctx: z.RefinementCtx,
): void {
  const seen = new Set<string>();
  value.items.forEach((item, index) => {
    if (seen.has(item.purchaseOrderItemId)) {
      ctx.addIssue({
        code: "custom",
        path: ["items", index],
        message: "Barang ini tercantum dua kali. Hapus salah satunya.",
      });
    }
    seen.add(item.purchaseOrderItemId);
  });
}

/** Schema catatan belanja: satu toko, satu tanggal, beberapa barang. */
export const restockPurchaseRecordSchema = z
  .object({
    storeName: purchaseStoreNameSchema,
    supplierId: z.string().trim().min(1).nullable().optional(),
    purchasedAt: purchaseDateSchema,
    notes: purchaseNotesSchema,
    /** Nama yang belanja; kosong berarti nama pencatat. */
    buyerName: z.preprocess(
      (value) =>
        typeof value === "string" && value.trim() === "" ? null : value,
      buyerNameSchema.nullable().optional(),
    ),
    fotoNota: z
      .array(
        z.string().min(1).max(RESTOCK_PURCHASE_LIMITS.fotoNotaUrl, {
          error: "Foto nota tidak terbaca. Hapus fotonya, lalu unggah ulang.",
        }),
      )
      .max(RESTOCK_PURCHASE_LIMITS.fotoNota, {
        error: `Foto nota paling banyak ${RESTOCK_PURCHASE_LIMITS.fotoNota}.`,
      })
      .default([]),
    items: purchaseLinesSchema,
  })
  .superRefine(refineUniquePurchaseLines);

/** Batas alasan pembatalan catatan belanja. */
export const PURCHASE_VOID_REASON_LIMITS = { min: 5, max: 500 } as const;

/** Body POST .../purchases/[recordId]/void: alasan wajib diisi. */
export const restockPurchaseVoidSchema = z.object({
  reason: z
    .string({ error: "Tulis alasan pembatalan." })
    .trim()
    .min(PURCHASE_VOID_REASON_LIMITS.min, {
      error: `Alasan pembatalan minimal ${PURCHASE_VOID_REASON_LIMITS.min} huruf.`,
    })
    .max(PURCHASE_VOID_REASON_LIMITS.max, {
      error: `Alasan pembatalan paling banyak ${PURCHASE_VOID_REASON_LIMITS.max} huruf.`,
    }),
});

/** Batas ukuran body permintaan dari link belanja (termasuk tanda tangan). */
export const MAX_PUBLIC_PURCHASE_BODY_BYTES = 320 * 1024;

const PUBLIC_FORM_UNREADABLE =
  "Isian tidak terbaca. Muat ulang halaman, lalu coba lagi.";

/** Isian di luar daftar field ditolak dengan pesan awam. */
const rejectUnknownFields = {
  error: (issue: { code?: string }) =>
    issue.code === "unrecognized_keys" ? PUBLIC_FORM_UNREADABLE : undefined,
};

/** Permintaan daftar belanja dari link tanpa login. */
export const publicPurchaseListSchema = z.strictObject(
  { token: purchaseLinkTokenSchema },
  rejectUnknownFields,
);

/** Hanya token; dibaca lebih dulu sebelum isian lain diperiksa. */
export const publicPurchaseTokenSchema = z.object({
  token: purchaseLinkTokenSchema,
});

const SIGNATURE_MISSING = "Tanda tangan dulu di kotak tanda tangan.";

/** Catatan belanja dari link tanpa login: nama dan tanda tangan wajib. */
export const publicPurchaseRecordSchema = z
  .strictObject(
    {
      token: purchaseLinkTokenSchema,
      clientRequestId: z.uuid({ error: PUBLIC_FORM_UNREADABLE }),
      buyerName: buyerNameSchema,
      storeName: purchaseStoreNameSchema,
      purchasedAt: purchaseDateSchema,
      notes: purchaseNotesSchema,
      signatureDataUrl: z
        .string({ error: SIGNATURE_MISSING })
        .startsWith("data:image/png;base64,", { error: SIGNATURE_MISSING })
        .max(RESTOCK_PURCHASE_LIMITS.signatureDataUrl, {
          error: "Tanda tangan terlalu besar. Hapus, lalu tanda tangan ulang.",
        }),
      items: purchaseLinesSchema,
    },
    rejectUnknownFields,
  )
  .superRefine(refineUniquePurchaseLines);

/** Di payload catatan belanja, `items` berisi barang. */
export const RESTOCK_PURCHASE_RECORD_LIST_LABELS: Readonly<
  Record<string, string>
> = {
  items: "Barang",
};

export type RestockPurchaseRecordInput = z.infer<
  typeof restockPurchaseRecordSchema
>;
export type PublicPurchaseRecordInput = z.infer<
  typeof publicPurchaseRecordSchema
>;
